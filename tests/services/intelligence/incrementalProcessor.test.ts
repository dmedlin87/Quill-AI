import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rangesOverlap,
  processManuscriptIncremental,
  shouldUseIncremental,
} from '@/services/intelligence/incrementalProcessor';
import type { ManuscriptIntelligence, ManuscriptDelta, TextChange } from '@/types/intelligence';

// Mock all the intelligence processing modules
vi.mock('@/services/intelligence/structuralParser', () => ({
  parseStructure: vi.fn(),
}));

vi.mock('@/services/intelligence/entityExtractor', () => ({
  extractEntities: vi.fn(),
}));

vi.mock('@/services/intelligence/timelineTracker', () => ({
  buildTimeline: vi.fn(),
}));

vi.mock('@/services/intelligence/styleAnalyzer', () => ({
  analyzeStyle: vi.fn(),
}));

vi.mock('@/services/intelligence/voiceProfiler', () => ({
  analyzeVoices: vi.fn(),
}));

vi.mock('@/services/intelligence/heatmapBuilder', () => ({
  buildHeatmap: vi.fn(),
}));

vi.mock('@/services/intelligence/contextBuilder', () => ({
  buildHUD: vi.fn(),
}));

vi.mock('@/services/intelligence/deltaTracker', () => ({
  createDelta: vi.fn(),
  hashContent: vi.fn(),
}));

import { parseStructure } from '@/services/intelligence/structuralParser';
import { extractEntities } from '@/services/intelligence/entityExtractor';
import { buildTimeline } from '@/services/intelligence/timelineTracker';
import { analyzeStyle } from '@/services/intelligence/styleAnalyzer';
import { analyzeVoices } from '@/services/intelligence/voiceProfiler';
import { buildHeatmap } from '@/services/intelligence/heatmapBuilder';
import { buildHUD } from '@/services/intelligence/contextBuilder';
import { createDelta, hashContent } from '@/services/intelligence/deltaTracker';

// Helper to create minimal mock intelligence
const createMockIntelligence = (overrides?: Partial<ManuscriptIntelligence>): ManuscriptIntelligence => ({
  chapterId: 'ch-1',
  structural: {
    scenes: [],
    paragraphs: [],
    dialogueMap: [],
    stats: {
      totalWords: 100,
      totalSentences: 10,
      totalParagraphs: 5,
      avgSentenceLength: 10,
      sentenceLengthVariance: 2,
      dialogueRatio: 0.3,
      sceneCount: 1,
      povShifts: 0,
      avgSceneLength: 100,
    },
    processedAt: Date.now(),
  },
  entities: { nodes: [], edges: [], processedAt: Date.now() },
  timeline: { events: [], causalChains: [], promises: [], processedAt: Date.now() },
  style: {
    vocabulary: { uniqueWords: 50, totalWords: 100, avgWordLength: 5, lexicalDiversity: 0.5, topWords: [], overusedWords: [], rareWords: [] },
    syntax: { avgSentenceLength: 10, sentenceLengthVariance: 2, minSentenceLength: 3, maxSentenceLength: 20, paragraphLengthAvg: 50, dialogueToNarrativeRatio: 0.3, questionRatio: 0.1, exclamationRatio: 0.02 },
    rhythm: { syllablePattern: [], punctuationDensity: 5, avgClauseCount: 2 },
    flags: { passiveVoiceRatio: 0.1, passiveVoiceInstances: [], adverbDensity: 0.02, adverbInstances: [], filterWordDensity: 0.01, filterWordInstances: [], clicheCount: 0, clicheInstances: [], repeatedPhrases: [] },
    processedAt: Date.now(),
  },
  voice: { profiles: {}, consistencyAlerts: [] },
  heatmap: { sections: [], hotspots: [], processedAt: Date.now() },
  delta: {
    changedRanges: [],
    invalidatedSections: [],
    affectedEntities: [],
    newPromises: [],
    resolvedPromises: [],
    contentHash: 'hash123',
    processedAt: Date.now(),
  },
  hud: {
    situational: {
      currentScene: null,
      currentParagraph: null,
      narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
      tensionLevel: 'low',
      pacing: 'slow',
    },
    context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
    styleAlerts: [],
    prioritizedIssues: [],
    recentChanges: [],
    stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 10 },
    lastFullProcess: Date.now(),
    processingTier: 'instant',
  },
  ...overrides,
});

describe('incrementalProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rangesOverlap', () => {
    it('returns true when ranges overlap', () => {
      expect(rangesOverlap({ start: 0, end: 100 }, { start: 50, end: 150 })).toBe(true);
    });

    it('returns true when one range contains another', () => {
      expect(rangesOverlap({ start: 0, end: 200 }, { start: 50, end: 100 })).toBe(true);
    });

    it('returns false when ranges do not overlap', () => {
      expect(rangesOverlap({ start: 0, end: 50 }, { start: 200, end: 300 })).toBe(false);
    });

    it('returns true for adjacent ranges with buffer', () => {
      // Default buffer is 50
      expect(rangesOverlap({ start: 0, end: 100 }, { start: 140, end: 200 })).toBe(true);
    });

    it('respects custom buffer', () => {
      expect(rangesOverlap({ start: 0, end: 100 }, { start: 150, end: 200 }, 10)).toBe(false);
      expect(rangesOverlap({ start: 0, end: 100 }, { start: 105, end: 200 }, 10)).toBe(true);
    });

    it('handles identical ranges', () => {
      expect(rangesOverlap({ start: 50, end: 100 }, { start: 50, end: 100 })).toBe(true);
    });

    it('handles zero-length ranges', () => {
      expect(rangesOverlap({ start: 50, end: 50 }, { start: 50, end: 50 })).toBe(true);
    });
  });

  describe('processManuscriptIncremental', () => {
    beforeEach(() => {
      // Set up default mock returns
      vi.mocked(hashContent).mockReturnValue('newhash');
      vi.mocked(parseStructure).mockReturnValue({
        scenes: [],
        paragraphs: [],
        dialogueMap: [],
        stats: { totalWords: 100, totalSentences: 10, totalParagraphs: 5, avgSentenceLength: 10, sentenceLengthVariance: 2, dialogueRatio: 0.3, sceneCount: 1, povShifts: 0, avgSceneLength: 100 },
        processedAt: Date.now(),
      });
      vi.mocked(extractEntities).mockReturnValue({ nodes: [], edges: [], processedAt: Date.now() });
      vi.mocked(buildTimeline).mockReturnValue({ events: [], causalChains: [], promises: [], processedAt: Date.now() });
      vi.mocked(analyzeStyle).mockReturnValue({
        vocabulary: { uniqueWords: 50, totalWords: 100, avgWordLength: 5, lexicalDiversity: 0.5, topWords: [], overusedWords: [], rareWords: [] },
        syntax: { avgSentenceLength: 10, sentenceLengthVariance: 2, minSentenceLength: 3, maxSentenceLength: 20, paragraphLengthAvg: 50, dialogueToNarrativeRatio: 0.3, questionRatio: 0.1, exclamationRatio: 0.02 },
        rhythm: { syllablePattern: [], punctuationDensity: 5, avgClauseCount: 2 },
        flags: { passiveVoiceRatio: 0.1, passiveVoiceInstances: [], adverbDensity: 0.02, adverbInstances: [], filterWordDensity: 0.01, filterWordInstances: [], clicheCount: 0, clicheInstances: [], repeatedPhrases: [] },
        processedAt: Date.now(),
      });
      vi.mocked(analyzeVoices).mockReturnValue({ profiles: {}, consistencyAlerts: [] });
      vi.mocked(buildHeatmap).mockReturnValue({ sections: [], hotspots: [], processedAt: Date.now() });
      vi.mocked(buildHUD).mockReturnValue({
        situational: { currentScene: null, currentParagraph: null, narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 }, tensionLevel: 'low', pacing: 'slow' },
        context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
        styleAlerts: [],
        prioritizedIssues: [],
        recentChanges: [],
        stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 10 },
        lastFullProcess: Date.now(),
        processingTier: 'instant',
      });
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });
    });

    it('returns previous intelligence unchanged when content hash matches', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('hash123'); // Same as prev

      const result = processManuscriptIncremental('Same text', 'ch-1', 'Same text', prevIntelligence);

      expect(result.intelligence).toBe(prevIntelligence);
      expect(result.processingStats.scenesReprocessed).toBe(0);
      expect(parseStructure).not.toHaveBeenCalled();
    });

    it('returns updated delta when no changes detected', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('newhash');
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [], // No changes
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('New text', 'ch-1', 'Old text', prevIntelligence);

      expect(result.intelligence.delta.contentHash).toBe('newhash');
      expect(parseStructure).not.toHaveBeenCalled();
    });

    it('processes incrementally when changes detected', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('newhash');
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 10, end: 20, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('Modified text here', 'ch-1', 'Original text here', prevIntelligence);

      expect(parseStructure).toHaveBeenCalled();
      expect(extractEntities).toHaveBeenCalled();
      expect(buildTimeline).toHaveBeenCalled();
      expect(buildHUD).toHaveBeenCalled();
      expect(result.processingStats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('skips style recompute for small changes', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('newhash');
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 10, end: 15, changeType: 'modify', oldText: 'hello', newText: 'world', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      processManuscriptIncremental('Small change', 'ch-1', 'Small chang', prevIntelligence);

      // Style should NOT be recomputed for small changes (<500)
      expect(analyzeStyle).not.toHaveBeenCalled();
    });

    it('processes full reanalysis for large changes', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('newhash');
      
      const largeOldText = 'A'.repeat(2000);
      const largeNewText = 'B'.repeat(2000);
      
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 0, end: 2000, changeType: 'modify', oldText: largeOldText, newText: largeNewText, timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental(largeNewText, 'ch-1', largeOldText, prevIntelligence);

      // Large changes should trigger full reprocessing including structural parser
      expect(parseStructure).toHaveBeenCalled();
      expect(result.processingStats).toBeDefined();
    });

    it('returns processing stats', () => {
      const prevIntelligence = createMockIntelligence();
      vi.mocked(hashContent).mockReturnValue('newhash');
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 10, end: 20, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('Text', 'ch-1', 'Old', prevIntelligence);

      expect(result.processingStats).toHaveProperty('scenesReprocessed');
      expect(result.processingStats).toHaveProperty('scenesReused');
      expect(result.processingStats).toHaveProperty('entitiesUpdated');
      expect(result.processingStats).toHaveProperty('entitiesReused');
      expect(result.processingStats).toHaveProperty('processingTimeMs');
    });

    it('triggers full structural reprocess when most scenes are affected', () => {
      const base = createMockIntelligence();
      const prevIntelligence = {
        ...base,
        structural: {
          ...base.structural,
          scenes: [
            { id: 's1', startOffset: 0, endOffset: 100, type: 'scene' },
            { id: 's2', startOffset: 150, endOffset: 250, type: 'scene' },
            { id: 's3', startOffset: 300, endOffset: 400, type: 'scene' },
            { id: 's4', startOffset: 450, endOffset: 550, type: 'scene' },
          ],
        },
      } as ManuscriptIntelligence;

      const reprocessedStructural = {
        ...base.structural,
        scenes: [
          { id: 'n1', startOffset: 0, endOffset: 120, type: 'scene' },
          { id: 'n2', startOffset: 200, endOffset: 320, type: 'scene' },
          { id: 'n3', startOffset: 340, endOffset: 460, type: 'scene' },
        ],
      };

      vi.mocked(parseStructure).mockReturnValueOnce(reprocessedStructural);
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [
          { start: 0, end: 90, changeType: 'modify', timestamp: Date.now() },
          { start: 160, end: 170, changeType: 'modify', timestamp: Date.now() },
          { start: 320, end: 330, changeType: 'modify', timestamp: Date.now() },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('new content for chapters', 'ch-1', 'old content', prevIntelligence);

      expect(result.intelligence.structural).toEqual(reprocessedStructural);
      expect(result.processingStats.fullReprocessReason).toBe('majority-scenes-affected');
      expect(result.processingStats.scenesReprocessed).toBe(reprocessedStructural.scenes.length);
      expect(result.processingStats.scenesReused).toBe(0);
    });

    it('reuses metadata from unaffected scenes when matching buckets', () => {
      const base = createMockIntelligence();
      const prevIntelligence = {
        ...base,
        structural: {
          ...base.structural,
          scenes: [
            { id: 's1', startOffset: 0, endOffset: 80, type: 'scene' },
            { id: 's2', startOffset: 1000, endOffset: 1100, type: 'scene', pov: 'first', location: 'Mars' },
          ],
        },
      } as ManuscriptIntelligence;

      vi.mocked(parseStructure).mockReturnValueOnce({
        ...base.structural,
        scenes: [
          { id: 'n1', startOffset: 0, endOffset: 90, type: 'scene' },
          { id: 'n2', startOffset: 1010, endOffset: 1110, type: 'scene' },
        ],
      });

      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 10, end: 20, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('updated text', 'ch-1', 'original text', prevIntelligence);
      const reusedScene = result.intelligence.structural.scenes.find(scene => scene.id === 'n2');

      expect(result.processingStats.scenesReprocessed).toBe(1);
      expect(result.processingStats.scenesReused).toBe(1);
      expect(reusedScene?.pov).toBe('first');
      expect(reusedScene?.location).toBe('Mars');
    });

    it('rebuilds entity graph when most entities are affected', () => {
      const base = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', type: 'character', name: 'A' } as any,
            { id: 'e2', type: 'character', name: 'B' } as any,
            { id: 'e3', type: 'character', name: 'C' } as any,
            { id: 'e4', type: 'character', name: 'D' } as any,
          ],
          edges: [],
          processedAt: Date.now(),
        },
      });

      const rebuiltEntities = {
        nodes: [{ id: 'n1', type: 'character', name: 'X' } as any],
        edges: [],
        processedAt: Date.now(),
      };

      vi.mocked(extractEntities).mockReturnValueOnce(rebuiltEntities);
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 0, end: 10, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: ['e1', 'e2', 'e3'],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('new text here', 'ch-1', 'old text', base);

      expect(result.intelligence.entities).toEqual(rebuiltEntities);
      expect(result.processingStats.entitiesUpdated).toBe(rebuiltEntities.nodes.length);
      expect(result.processingStats.entitiesReused).toBe(0);
    });

    it('merges evidence for unaffected entity relationships', () => {
      const base = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'alpha', type: 'character', name: 'Alpha' } as any,
            { id: 'beta', type: 'character', name: 'Beta' } as any,
            { id: 'gamma', type: 'character', name: 'Gamma' } as any,
          ],
          edges: [
            { source: 'alpha', target: 'beta', sentiment: 'positive', evidence: ['old1', 'old2'] } as any,
          ],
          processedAt: Date.now(),
        },
      });

      vi.mocked(extractEntities).mockReturnValueOnce({
        nodes: base.entities.nodes,
        edges: [{ source: 'alpha', target: 'beta', sentiment: 'positive', evidence: ['new'] } as any],
        processedAt: Date.now(),
      });

      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 500, end: 510, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: ['gamma'],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('delta text', 'ch-1', 'prev text', base);
      const mergedEdge = result.intelligence.entities.edges[0];

      expect(mergedEdge.evidence).toEqual(['old1', 'old2', 'new']);
      expect(result.processingStats.entitiesUpdated).toBe(1);
      expect(result.processingStats.entitiesReused).toBe(2);
    });

    it('recomputes style analysis when change volume is large', () => {
      const base = createMockIntelligence();
      const updatedStyle = { ...base.style, processedAt: 999 };

      vi.mocked(analyzeStyle).mockReturnValueOnce(updatedStyle);
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [
          { start: 0, end: 1000, changeType: 'modify', oldText: 'A'.repeat(600), newText: 'B'.repeat(600), timestamp: Date.now() },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('B'.repeat(1200), 'ch-1', 'A'.repeat(1200), base);

      expect(analyzeStyle).toHaveBeenCalledWith('B'.repeat(1200));
      expect(result.intelligence.style.processedAt).toBe(999);
    });

    it('forces structural rebuild when change size crosses threshold', () => {
      const base = createMockIntelligence();
      const prevIntelligence = {
        ...base,
        structural: {
          ...base.structural,
          scenes: [
            { id: 's1', startOffset: 0, endOffset: 50, type: 'scene' },
            { id: 's2', startOffset: 60, endOffset: 120, type: 'scene' },
          ],
        },
      } as ManuscriptIntelligence;

      const rebuilt = {
        ...base.structural,
        scenes: [{ id: 'n1', startOffset: 0, endOffset: 300, type: 'scene' }],
      };

      vi.mocked(parseStructure).mockReturnValueOnce(rebuilt);
      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [
          {
            start: 0,
            end: 10,
            changeType: 'modify',
            oldText: 'A'.repeat(100),
            newText: 'B'.repeat(2600),
            timestamp: Date.now(),
          },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('B'.repeat(2000), 'ch-1', 'A'.repeat(2000), prevIntelligence);

      expect(result.intelligence.structural).toEqual(rebuilt);
      expect(result.processingStats.fullReprocessReason).toBe('change-size-threshold');
      expect(result.processingStats.scenesReprocessed).toBe(rebuilt.scenes.length);
      expect(result.processingStats.scenesReused).toBe(0);
    });

    it('avoids reusing edges when affected entities participate', () => {
      const base = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'a', type: 'character', name: 'A' } as any,
            { id: 'b', type: 'character', name: 'B' } as any,
          ],
          edges: [{ source: 'a', target: 'b', sentiment: 'neutral', evidence: ['keep'] } as any],
          processedAt: Date.now(),
        },
      });

      vi.mocked(extractEntities).mockReturnValueOnce({
        nodes: base.entities.nodes,
        edges: [{ source: 'a', target: 'b', sentiment: 'negative', evidence: ['new'] } as any],
        processedAt: Date.now(),
      });

      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 20, end: 30, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: ['a'],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('some text', 'ch-1', 'prev text', base);
      const edge = result.intelligence.entities.edges[0];

      expect(edge.evidence).toEqual(['new']);
      expect(edge.sentiment).toBe('negative');
      expect(result.processingStats.entitiesReused).toBe(1);
    });

    it('leaves unmatched scenes untouched when no nearby candidate exists', () => {
      const base = createMockIntelligence({
        structural: {
          scenes: [
            { id: 's1', startOffset: 0, endOffset: 50, type: 'scene' },
            { id: 's2', startOffset: 5000, endOffset: 5100, type: 'flashback', pov: 'omniscient', location: 'Moon' },
          ],
          paragraphs: [],
          dialogueMap: [],
          stats: createMockIntelligence().structural.stats,
          processedAt: Date.now(),
        },
      });

      vi.mocked(parseStructure).mockReturnValueOnce({
        ...base.structural,
        scenes: [
          { id: 'n1', startOffset: 0, endOffset: 60, type: 'scene' },
          { id: 'n2', startOffset: 100, endOffset: 180, type: 'scene' },
        ],
      });

      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 5, end: 15, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('new story text', 'ch-1', 'previous text', base as ManuscriptIntelligence);
      const unmatched = result.intelligence.structural.scenes.find(scene => scene.id === 'n2');

      expect(unmatched?.pov).toBeUndefined();
      expect(unmatched?.location).toBeUndefined();
      expect(result.processingStats.scenesReused).toBe(1);
    });

    it('preserves new edges when no historical edge is available', () => {
      const base = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'x', type: 'character', name: 'X' } as any,
            { id: 'y', type: 'character', name: 'Y' } as any,
          ],
          edges: [],
          processedAt: Date.now(),
        },
      });

      vi.mocked(extractEntities).mockReturnValueOnce({
        nodes: base.entities.nodes,
        edges: [{ source: 'x', target: 'y', sentiment: 'neutral', evidence: ['first'] } as any],
        processedAt: Date.now(),
      });

      vi.mocked(createDelta).mockReturnValue({
        changedRanges: [{ start: 40, end: 50, changeType: 'modify', timestamp: Date.now() }],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'newhash',
        processedAt: Date.now(),
      });

      const result = processManuscriptIncremental('another text', 'ch-1', 'old text', base);

      expect(result.intelligence.entities.edges[0].evidence).toEqual(['first']);
      expect(result.processingStats.entitiesUpdated).toBe(0);
      expect(result.processingStats.entitiesReused).toBe(2);
    });
  });

  describe('shouldUseIncremental', () => {
    it('returns false when no changed ranges', () => {
      const delta: ManuscriptDelta = {
        changedRanges: [],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'hash',
        processedAt: Date.now(),
      };

      expect(shouldUseIncremental(delta, 1000)).toBe(false);
    });

    it('returns false when too many changed ranges', () => {
      const changedRanges: TextChange[] = Array.from({ length: 25 }, (_, i) => ({
        start: i * 10,
        end: i * 10 + 5,
        changeType: 'modify' as const,
        timestamp: Date.now(),
      }));

      const delta: ManuscriptDelta = {
        changedRanges,
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'hash',
        processedAt: Date.now(),
      };

      expect(shouldUseIncremental(delta, 1000)).toBe(false);
    });

    it('returns false when total change size is too large', () => {
      const delta: ManuscriptDelta = {
        changedRanges: [
          { start: 0, end: 100, changeType: 'modify', oldText: 'A'.repeat(500), newText: 'B'.repeat(500), timestamp: Date.now() },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'hash',
        processedAt: Date.now(),
      };

      expect(shouldUseIncremental(delta, 1000)).toBe(false); // 500 > 1000 * 0.3
    });

    it('returns true for small focused edits', () => {
      const delta: ManuscriptDelta = {
        changedRanges: [
          { start: 100, end: 110, changeType: 'modify', oldText: 'hello', newText: 'world', timestamp: Date.now() },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'hash',
        processedAt: Date.now(),
      };

      expect(shouldUseIncremental(delta, 1000)).toBe(true);
    });

    it('returns true for multiple small edits', () => {
      const delta: ManuscriptDelta = {
        changedRanges: [
          { start: 100, end: 110, changeType: 'modify', oldText: 'one', newText: 'two', timestamp: Date.now() },
          { start: 200, end: 210, changeType: 'modify', oldText: 'three', newText: 'four', timestamp: Date.now() },
          { start: 300, end: 310, changeType: 'modify', oldText: 'five', newText: 'six', timestamp: Date.now() },
        ],
        invalidatedSections: [],
        affectedEntities: [],
        newPromises: [],
        resolvedPromises: [],
        contentHash: 'hash',
        processedAt: Date.now(),
      };

      expect(shouldUseIncremental(delta, 1000)).toBe(true);
    });
  });
});
