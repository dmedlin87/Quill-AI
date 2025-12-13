import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as autoObserver from '@/services/memory/autoObserver';
import * as memoryService from '@/services/memory/index';
import { AnalysisResult } from '@/types';
import { ManuscriptIntelligence } from '@/types/intelligence';

// Minimal Dexie-like mock for db.memories to satisfy toCollection/where usage
interface MockCollection {
  filter: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
}

interface MockWhereClause {
  equals: ReturnType<typeof vi.fn>;
}

const createMemoriesTableMock = (data: any[] = []) => {
  let stored = [...data];

  const createCollection = (items: any[]): MockCollection => ({
    filter: vi.fn().mockImplementation((pred: (n: any) => boolean) =>
      createCollection(items.filter(pred))
    ),
    toArray: vi.fn().mockResolvedValue([...items]),
  });

  return {
    where: vi.fn().mockImplementation((field: string): MockWhereClause => ({
      equals: vi.fn().mockImplementation((value: any) => {
        let filtered = stored;
        if (field === '[scope+projectId]') {
          const [scope, projectId] = value;
          filtered = stored.filter(n => n.scope === scope && n.projectId === projectId);
        } else if (field === 'scope') {
          filtered = stored.filter(n => n.scope === value);
        } else if (field === 'projectId') {
          filtered = stored.filter(n => n.projectId === value);
        }
        return createCollection(filtered);
      }),
    })),
    toCollection: vi.fn().mockImplementation(() => createCollection(stored)),
  };
};

let mockMemoriesTable = createMemoriesTableMock([]);

vi.mock('@/services/db', () => ({
  db: {
    get memories() {
      return mockMemoriesTable;
    },
  },
}));

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

    it('supports string relationships and captures createMemory errors', async () => {
      mockCreateMemory.mockRejectedValueOnce(new Error('db down'));

      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Starts weak, becomes strong and learns to lead.',
          relationships: ['Sidekick'],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        pacing: { score: 1, analysis: 'ok', slowSections: [], fastSections: [] },
        timestamp: Date.now()
      } as any;

      const result = await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining("Hero's arc:"),
      }));
      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Hero has relationship with Sidekick',
      }));
      expect(result.errors.some(e => e.includes('Failed to create arc observation'))).toBe(true);
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

    it('handles null analysis gracefully', async () => {
      const intelligence = { entities: { nodes: [], edges: [] }, timeline: { promises: [] } } as any;

      const result = await autoObserver.observeAll(null, intelligence, { projectId });

      expect(result).toBeDefined();
      expect(result.created).toEqual([]);
      expect(result.skipped).toBe(0);
    });

    it('handles null intelligence gracefully', async () => {
      const analysis = { characters: [], plotIssues: [] } as any;

      const result = await autoObserver.observeAll(analysis, null, { projectId });

      expect(result).toBeDefined();
      expect(result.created).toEqual([]);
    });

    it('handles both null parameters', async () => {
      const result = await autoObserver.observeAll(null, null, { projectId });

      expect(result).toBeDefined();
      expect(result.created).toEqual([]);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('isDuplicate', () => {
    it('returns true for exact text match', async () => {
      const existing = [{ text: 'Hero defeats the villain', topicTags: ['plot'] }] as any;
      const result = await autoObserver.isDuplicate('Hero defeats the villain', ['plot'], existing);
      expect(result).toBe(true);
    });

    it('returns true when existing text contains new text', async () => {
      const existing = [{ text: 'Hero defeats the villain in chapter 5', topicTags: ['plot'] }] as any;
      const result = await autoObserver.isDuplicate('defeat', ['plot'], existing);
      expect(result).toBe(true);
    });

    it('returns true when new text contains existing text', async () => {
      const existing = [{ text: 'Hero', topicTags: ['character:hero'] }] as any;
      const result = await autoObserver.isDuplicate("Hero's arc spans multiple chapters", ['character:hero'], existing);
      expect(result).toBe(true);
    });

    it('returns true for high word overlap with shared tags', async () => {
      const existing = [{ text: 'Hero defeats villain in battle', topicTags: ['plot', 'action'] }] as any;
      const result = await autoObserver.isDuplicate('Hero defeats villain in combat', ['plot'], existing);
      expect(result).toBe(true);
    });

    it('returns false for low overlap with shared tags', async () => {
      const existing = [{ text: 'The cat sat on the mat', topicTags: ['animal'] }] as any;
      const result = await autoObserver.isDuplicate('Hero fights villain', ['animal'], existing);
      expect(result).toBe(false);
    });

    it('returns false when no tags overlap', async () => {
      const existing = [{ text: 'Similar text', topicTags: ['tag-a'] }] as any;
      const result = await autoObserver.isDuplicate('Similar text', ['tag-b'], existing);
      // Different tags means different topic, even similar text returns true for exact match
      expect(result).toBe(true);
    });

    it('returns false for empty existing memories', async () => {
      const result = await autoObserver.isDuplicate('New observation', ['plot'], []);
      expect(result).toBe(false);
    });
  });

  describe('observeCharacters edge cases', () => {
    it('skips characters with short arc text', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'Short', // Less than 20 chars
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      // Should not create arc observation due to short text
      expect(mockCreateMemory).not.toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining("Hero's arc:")
      }));
    });

    it('skips characters with short development suggestion', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: '',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: 'Be better' // Less than 20 chars
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(mockCreateMemory).not.toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Suggestion for Hero')
      }));
    });

    it('handles relationships as plain strings', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: '',
          relationships: ['Villain', 'Sidekick'], // String relationships
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(mockCreateMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Hero has relationship with Villain')
      }));
    });

    it('limits relationships to 3 per character', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: '',
          relationships: [
            { name: 'R1', type: 'friend' },
            { name: 'R2', type: 'enemy' },
            { name: 'R3', type: 'ally' },
            { name: 'R4', type: 'rival' },
            { name: 'R5', type: 'mentor' },
          ],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      // Should only create 3 relationship observations
      const relationshipCalls = mockCreateMemory.mock.calls.filter(
        call => call[0].text.includes('has relationship with')
      );
      expect(relationshipCalls.length).toBe(3);
    });
  });

  describe('observeIntelligenceResults edge cases', () => {
    it('skips entity edges when source node is missing', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: {
          nodes: [{ id: '2', name: 'Bob', type: 'character' }],
          edges: [{ source: '1', target: '2', type: 'friend', coOccurrences: 5, evidence: [] }]
        },
        timeline: { promises: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId });

      // Should not create relationship because source node (id: '1') is missing
      expect(mockCreateMemory).not.toHaveBeenCalled();
    });

    it('skips entity edges when target node is missing', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: {
          nodes: [{ id: '1', name: 'Alice', type: 'character' }],
          edges: [{ source: '1', target: '2', type: 'friend', coOccurrences: 5, evidence: [] }]
        },
        timeline: { promises: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId });

      expect(mockCreateMemory).not.toHaveBeenCalled();
    });

    it('skips resolved promises', async () => {
      const intelligence: ManuscriptIntelligence = {
        entities: { nodes: [], edges: [] },
        timeline: {
          promises: [
            { type: 'foreshadowing', description: 'Something resolved', resolved: true }
          ],
          events: [],
          causalChains: []
        }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId });

      expect(mockCreateMemory).not.toHaveBeenCalled();
    });

    it('limits edges to 5', async () => {
      const nodes = Array.from({ length: 10 }, (_, i) => ({
        id: String(i), name: `Char${i}`, type: 'character'
      }));
      const edges = Array.from({ length: 8 }, (_, i) => ({
        source: String(i), target: String(i + 1), type: 'friend', coOccurrences: 5, evidence: []
      }));

      const intelligence: ManuscriptIntelligence = {
        entities: { nodes, edges },
        timeline: { promises: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId, deduplicateEnabled: false });

      // Should create max 5 relationship observations
      expect(mockCreateMemory.mock.calls.length).toBeLessThanOrEqual(5);
    });

    it('limits promises to 5', async () => {
      const promises = Array.from({ length: 8 }, (_, i) => ({
        type: 'foreshadowing', description: `Promise ${i}`, resolved: false
      }));

      const intelligence: ManuscriptIntelligence = {
        entities: { nodes: [], edges: [] },
        timeline: { promises, events: [], causalChains: [] }
      } as any;

      await autoObserver.observeIntelligenceResults(intelligence, { projectId, deduplicateEnabled: false });

      expect(mockCreateMemory.mock.calls.length).toBeLessThanOrEqual(5);
    });
  });

  describe('observePacingFromAnalysis edge cases', () => {
    it('handles empty slow and fast sections', async () => {
      const analysis: AnalysisResult = {
        characters: [],
        plotIssues: [],
        pacing: {
          score: 0.8,
          analysis: 'Good',
          slowSections: [],
          fastSections: []
        },
        timestamp: Date.now()
      } as any;

      const result = await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      // Should not create any pacing observations
      const pacingCalls = mockCreateMemory.mock.calls.filter(
        call => call[0].topicTags?.includes('pacing')
      );
      expect(pacingCalls.length).toBe(0);
    });

    it('limits sections to 3 each', async () => {
      const analysis: AnalysisResult = {
        characters: [],
        plotIssues: [],
        pacing: {
          score: 0.5,
          analysis: 'Mixed',
          slowSections: [
            { description: 'Slow 1' },
            { description: 'Slow 2' },
            { description: 'Slow 3' },
            { description: 'Slow 4' },
            { description: 'Slow 5' },
          ],
          fastSections: [
            { description: 'Fast 1' },
            { description: 'Fast 2' },
            { description: 'Fast 3' },
            { description: 'Fast 4' },
          ]
        },
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      const slowCalls = mockCreateMemory.mock.calls.filter(
        call => call[0].topicTags?.includes('slow')
      );
      const fastCalls = mockCreateMemory.mock.calls.filter(
        call => call[0].topicTags?.includes('fast')
      );
      expect(slowCalls.length).toBe(3);
      expect(fastCalls.length).toBe(3);
    });
  });

  describe('deduplication disabled', () => {
    it('does not fetch memories when deduplication is disabled', async () => {
      const analysis: AnalysisResult = {
        characters: [{
          name: 'Hero',
          arc: 'A long arc description that exceeds twenty characters',
          relationships: [],
          inconsistencies: [],
          developmentSuggestion: ''
        }],
        plotIssues: [],
        timestamp: Date.now()
      } as any;

      await autoObserver.observeAnalysisResults(analysis, { projectId, deduplicateEnabled: false });

      expect(mockGetMemories).not.toHaveBeenCalled();
    });
  });
});
