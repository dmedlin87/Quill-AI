import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as autoObserver from '@/services/memory/autoObserver';
import * as memoryService from '@/services/memory/index';
import { AnalysisResult } from '@/types';
import { ManuscriptIntelligence } from '@/types/intelligence';

// Mock the memory service dependencies
vi.mock('@/services/memory/index', () => ({
  createMemory: vi.fn(),
  getMemories: vi.fn(),
  searchMemoriesByTags: vi.fn(),
}));

describe('AutoObserver Service', () => {
  const projectId = 'test-project';
  const mockCreateMemory = memoryService.createMemory as Mock;
  const mockGetMemories = memoryService.getMemories as Mock;
  const mockIsDuplicate = vi.spyOn(autoObserver as any, 'isDuplicate');

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDuplicate.mockReset();
    mockCreateMemory.mockResolvedValue({ id: 'new-memory-id', text: 'test' });
    mockGetMemories.mockResolvedValue([]);
  });

  describe('observeCharacters', () => {
    it('should create memories for character arcs', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong.',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        pacing: {
          score: 0.8,
          analysis: 'Good',
          slowSections: [],
          fastSections: []
        },
        themes: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining("Hero's arc: Starts weak"),
        type: 'observation',
        topicTags: expect.arrayContaining(['character:hero', 'arc'])
      }));
    });

    it('should create memories for relationships', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: '',
          relationships: [{ name: 'Villain', type: 'enemy', description: 'Hates him' }],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Hero has relationship with Villain (enemy)'),
        type: 'fact',
        topicTags: expect.arrayContaining(['character:hero', 'character:villain', 'relationship'])
      }));
    });

    it('should skip duplicates if enabled', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong.',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      mockGetMemories.mockResolvedValue([
        { text: "Hero's arc: Starts weak, becomes strong.", topicTags: ['character:hero', 'arc'] }
      ]);

      const result = await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: true });

      expect(result.skipped).toBe(1);
      expect(result.created).toHaveLength(0);
      expect(mockCreateMemory).not.toHaveBeenCalled();
    });
  });

  describe('observeAnalysisResults', () => {
    it('skips duplicates when deduplication is enabled', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong and learns from mistakes.',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [{ issue: 'Plot hole here', location: 'Chapter 1' }],
        pacing: {
          score: 0.5,
          analysis: 'Okay',
          slowSections: [{ description: 'Chapter 2 is slow' }],
          fastSections: []
        },
        timestamp: Date.now()
      } as any;

      mockIsDuplicate.mockResolvedValue(true);

      const result = await autoObserver.observeAnalysisResults(analysis, {
        projectId,
        deduplicateEnabled: true,
        existingMemories: [],
        duplicateChecker: mockIsDuplicate as any,
      });

      expect(mockIsDuplicate).toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
      expect(result.created).toHaveLength(0);
      expect(mockCreateMemory).not.toHaveBeenCalled();
      expect(mockGetMemories).not.toHaveBeenCalled();
    });

    it('creates observations for characters, plot issues, and pacing data', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong and learns from mistakes.',
          relationships: [{ name: 'Sidekick', type: 'friend', description: 'Supports the hero' }],
          inconsistencies: [{ issue: 'Sometimes forgets the plan' }],
          developmentSuggestion: 'Give Hero more moments of doubt to deepen the arc.'
        }],
        plotIssues: [{
          issue: 'Plot hole here',
          location: 'Chapter 1',
          suggestion: 'Clarify the motivation'
        }],
        pacing: {
          score: 0.5,
          analysis: 'Okay',
          slowSections: [{ description: 'Chapter 2 is slow' }],
          fastSections: ['Chapter 5 is rushed']
        },
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining("Hero's arc: Starts weak"),
        topicTags: expect.arrayContaining(['character:hero', 'arc'])
      }));
      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Plot issue: Plot hole here'),
        topicTags: expect.arrayContaining(['plot', 'issue'])
      }));
      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Pacing (slow): Chapter 2 is slow'),
        topicTags: expect.arrayContaining(['pacing', 'slow'])
      }));
      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Pacing (rushed): Chapter 5 is rushed'),
        topicTags: expect.arrayContaining(['pacing', 'fast'])
      }));
    });

    it('truncates observations to maxObservations using highest importance values', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong and learns from mistakes.',
          relationships: [{ name: 'Sidekick', type: 'friend', description: 'Supports the hero' }],
          inconsistencies: [{ issue: 'Sometimes forgets the plan' }],
          developmentSuggestion: 'Give Hero more moments of doubt to deepen the arc.'
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      mockCreateMemory.mockImplementation(async payload => ({
        id: payload.text,
        text: payload.text,
        importance: payload.importance,
      }));

      const result = await autoObserver.observeAnalysisResults(analysis, {
        projectId,
        maxObservations: 2,
        deduplicateEnabled: false
      });

      expect(result.created).toHaveLength(2);
      expect(result.created.map(item => item.importance)).toEqual([0.9, 0.7]);
    });

    it('collects creation errors while continuing other observations', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong and learns from mistakes.',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [{ issue: 'Plot hole here', location: 'Chapter 1' }],
        timestamp: Date.now()
      } as any;

      mockCreateMemory
        .mockImplementationOnce(async () => { throw new Error('arc failure'); })
        .mockResolvedValueOnce({ id: 'plot', text: 'plot', importance: 0.8 });

      const result = await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('arc failure');
      expect(result.created).toHaveLength(1);
    });
  });

  describe('observePlotIssues', () => {
    it('should create memories for plot issues', async () => {
      const analysis: AnalysisResult = {
        characters: [],
        plotIssues: [{
          issue: 'Plot hole here',
          location: 'Chapter 1',
          suggestion: 'Fix it'
        }],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Plot issue: Plot hole here'),
        type: 'issue',
        topicTags: expect.arrayContaining(['plot', 'issue', 'location:chapter 1'])
      }));
    });
  });

  describe('observePacingFromAnalysis', () => {
    it('should create memories for pacing issues', async () => {
      const analysis: AnalysisResult = {
        characters: [],
        plotIssues: [],
        pacing: {
          score: 0.5,
          analysis: 'Okay',
          slowSections: [{ description: 'Chapter 2 is slow' }],
          fastSections: ['Chapter 5 is rushed']
        },
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Pacing (slow): Chapter 2 is slow'),
        type: 'issue',
        topicTags: expect.arrayContaining(['pacing', 'slow'])
      }));

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Pacing (rushed): Chapter 5 is rushed'),
        type: 'observation',
        topicTags: expect.arrayContaining(['pacing', 'fast'])
      }));
    });
  });

  describe('observeIntelligenceResults', () => {
    it('should extract entity relationships', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: {
          nodes: [
            { id: '1', name: 'Alice', type: 'character' },
            { id: '2', name: 'Bob', type: 'character' }
          ],
          edges: [
            { source: '1', target: '2', type: 'friend', coOccurrences: 5, evidence: [] }
          ]
        },
        timeline: { promises: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Alice and Bob have friend relationship'),
        topicTags: expect.arrayContaining(['character:alice', 'character:bob', 'relationship'])
      }));
    });

    it('should extract open plot threads', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: { nodes: [], edges: [] },
        timeline: {
          promises: [
            { type: 'foreshadowing', description: 'Something bad will happen', resolved: false }
          ],
          events: [],
          causalChains: []
        }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Open plot thread (foreshadowing): Something bad'),
        topicTags: expect.arrayContaining(['plot-thread', 'open', 'foreshadowing'])
      }));
    });

    it('prefetches existing memories only when deduplication requires it', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: { nodes: [], edges: [] },
        timeline: { promises: [], events: [], causalChains: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, {
        projectId,
        deduplicateEnabled: false
      });

      expect(mockGetMemories).not.toHaveBeenCalled();

      await autoObserver.observeIntelligenceResults(intelligence, {
        projectId,
        deduplicateEnabled: true
      });

      expect(mockGetMemories).toHaveBeenCalledTimes(1);
    });
  });

  describe('observeAll', () => {
    it('should process both analysis and intelligence results', async () => {
      const analysis = { characters: [], plotIssues: [] } as any;
      const intelligence = { entities: { nodes: [], edges: [] }, timeline: { promises: [] } } as any;

      const result = await autoObserver.observeAll(analysis, intelligence, { projectId });

      expect(result).toBeDefined();
      expect(mockGetMemories).toHaveBeenCalled(); // Once for dedupe context
    });
  });
});
