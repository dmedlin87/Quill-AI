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
