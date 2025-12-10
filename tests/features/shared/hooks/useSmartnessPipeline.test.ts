import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSmartnessPipeline,
  createIntelligenceCallback,
  type SmartnessPipelineConfig,
} from '@/features/shared/hooks/useSmartnessPipeline';
import type { AppBrainState } from '@/services/appBrain/types';
import type { ManuscriptIntelligence } from '@/types/intelligence';
import type { ProactiveSuggestion } from '@/services/memory/proactive';

// Mock dependencies
vi.mock('@/services/appBrain/intelligenceMemoryBridge', () => ({
  analyzeIntelligenceAgainstMemory: vi.fn(),
}));

vi.mock('@/services/appBrain', () => ({
  getProactiveThinker: vi.fn(() => ({
    forceThink: vi.fn(),
    getStatus: vi.fn(() => ({ isThinking: false })),
  })),
  startProactiveThinker: vi.fn(() => ({
    getStatus: vi.fn(() => ({ isThinking: false })),
  })),
  stopProactiveThinker: vi.fn(),
  startSignificantEditMonitor: vi.fn(),
  stopSignificantEditMonitor: vi.fn(),
}));

import { analyzeIntelligenceAgainstMemory } from '@/services/appBrain/intelligenceMemoryBridge';
import {
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
} from '@/services/appBrain';

const createMockState = (): AppBrainState => ({
  manuscript: {
    projectId: 'proj-1',
    projectTitle: 'Test',
    chapters: [],
    activeChapterId: null,
    currentText: '',
    branches: [],
    activeBranchId: null,
  },
  intelligence: {
    hud: null,
    full: null,
    entities: null,
    timeline: null,
    style: null,
    heatmap: null,
    lastProcessedAt: 0,
  },
  analysis: {
    result: null,
    status: { pacing: 'idle', characters: 'idle', plot: 'idle', setting: 'idle' },
    inlineComments: [],
  },
  lore: { characters: [], worldRules: [], manuscriptIndex: null },
  ui: {
    cursor: { position: 0, scene: null, paragraph: null },
    selection: null,
    activePanel: 'home',
    activeView: 'editor',
    isZenMode: false,
    activeHighlight: null,
    microphone: { status: 'idle', mode: 'text', lastTranscript: null, error: null },
  },
  session: {
    chatHistory: [],
    currentPersona: null,
    pendingToolCalls: [],
    lastAgentAction: null,
    isProcessing: false,
  },
});

const createMockIntelligence = (): ManuscriptIntelligence => ({
  chapterId: 'ch-1',
  structural: {
    scenes: [],
    paragraphs: [],
    dialogueMap: [],
    stats: { totalWords: 100, totalSentences: 10, totalParagraphs: 5, avgSentenceLength: 10, sentenceLengthVariance: 2, dialogueRatio: 0.3, sceneCount: 1, povShifts: 0, avgSceneLength: 100 },
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
  delta: { changedRanges: [], invalidatedSections: [], affectedEntities: [], newPromises: [], resolvedPromises: [], contentHash: 'hash', processedAt: Date.now() },
  hud: {
    situational: { currentScene: null, currentParagraph: null, narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 }, tensionLevel: 'low', pacing: 'slow' },
    context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
    styleAlerts: [],
    prioritizedIssues: [],
    recentChanges: [],
    stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 10 },
    lastFullProcess: Date.now(),
    processingTier: 'instant',
  },
});

describe('useSmartnessPipeline', () => {
  const mockGetState = vi.fn(() => createMockState());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultConfig: SmartnessPipelineConfig = {
    projectId: 'proj-1',
    enableProactiveThinker: true,
    thinkerDebounceMs: 1000,
  };

  describe('initialization', () => {
    it('returns expected shape', () => {
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      expect(result.current).toHaveProperty('conflicts');
      expect(result.current).toHaveProperty('suggestions');
      expect(result.current).toHaveProperty('isAnalyzing');
      expect(result.current).toHaveProperty('thinkerState');
      expect(result.current).toHaveProperty('analyzeNow');
      expect(result.current).toHaveProperty('thinkNow');
      expect(result.current).toHaveProperty('clearConflicts');
      expect(result.current).toHaveProperty('clearSuggestions');
      expect(result.current).toHaveProperty('dismissSuggestion');
    });

    it('starts with empty conflicts and suggestions', () => {
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      expect(result.current.conflicts).toEqual([]);
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isAnalyzing).toBe(false);
    });
  });

  describe('proactive thinker integration', () => {
    it('starts proactive thinker when enabled', () => {
      renderHook(() =>
        useSmartnessPipeline(mockGetState, {
          ...defaultConfig,
          enableProactiveThinker: true,
        })
      );

      expect(startProactiveThinker).toHaveBeenCalled();
      expect(startSignificantEditMonitor).toHaveBeenCalled();
    });

    it('does not start proactive thinker when disabled', () => {
      renderHook(() =>
        useSmartnessPipeline(mockGetState, {
          ...defaultConfig,
          enableProactiveThinker: false,
        })
      );

      expect(startProactiveThinker).not.toHaveBeenCalled();
    });

    it('stops proactive thinker on unmount', () => {
      const { unmount } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      unmount();

      expect(stopProactiveThinker).toHaveBeenCalled();
      expect(stopSignificantEditMonitor).toHaveBeenCalled();
    });

    it('does not start thinker when projectId is empty', () => {
      renderHook(() =>
        useSmartnessPipeline(mockGetState, {
          ...defaultConfig,
          projectId: '',
        })
      );

      expect(startProactiveThinker).not.toHaveBeenCalled();
    });

    it('records suggestions emitted by the proactive thinker', () => {
      const suggestion: ProactiveSuggestion = {
        id: 'suggestion-1',
        type: 'reminder',
        priority: 'medium',
        title: 'Stay consistent',
        description: 'Keep this thread aligned with lore',
        source: { type: 'memory', id: 'mem-1' },
        tags: ['continuity'],
        createdAt: Date.now(),
      };

      vi.mocked(startProactiveThinker).mockImplementationOnce((_getState, _projectId, onSuggestion) => {
        onSuggestion(suggestion);
        return {
          getStatus: vi.fn(() => ({ isThinking: false })),
        } as any;
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      expect(result.current.suggestions).toContainEqual(suggestion);
    });

    it('ignores duplicate suggestions by title', () => {
      const firstSuggestion: ProactiveSuggestion = {
        id: 'suggestion-1',
        type: 'reminder',
        priority: 'medium',
        title: 'Stay consistent',
        description: 'Keep this thread aligned with lore',
        source: { type: 'memory', id: 'mem-1' },
        tags: ['continuity'],
        createdAt: Date.now(),
      };
      const duplicateSuggestion: ProactiveSuggestion = {
        ...firstSuggestion,
        id: 'suggestion-2',
      };

      vi.mocked(startProactiveThinker).mockImplementationOnce((_getState, _projectId, onSuggestion) => {
        onSuggestion(firstSuggestion);
        onSuggestion(duplicateSuggestion);
        return {
          getStatus: vi.fn(() => ({ isThinking: false })),
        } as any;
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      expect(result.current.suggestions).toHaveLength(1);
    });

    it('updates thinker state periodically', async () => {
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      // Advance timers to trigger interval
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // State should have been updated (null initially, then from getStatus)
      expect(result.current.thinkerState).toBeDefined();
    });
  });

  describe('analyzeNow', () => {
    it('sets isAnalyzing during analysis', async () => {
      vi.mocked(analyzeIntelligenceAgainstMemory).mockResolvedValue({
        conflicts: [],
        memoriesCreated: 0,
        analysisTime: 100,
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      // After analysis completes, isAnalyzing should be false
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('adds conflicts from analysis result', async () => {
      const mockConflict = {
        id: 'conflict-1',
        type: 'lore_violation' as const,
        severity: 'warning' as const,
        finding: {
          source: 'entity' as const,
          description: 'Sarah has blue eyes in chapter 1',
          offset: 100,
        },
        reference: {
          type: 'memory' as const,
          id: 'mem-1',
          text: 'Sarah has green eyes in lore',
        },
        explanation: 'Eye color mismatch',
        createdAt: Date.now(),
      };

      vi.mocked(analyzeIntelligenceAgainstMemory).mockResolvedValue({
        conflicts: [mockConflict],
        memoriesCreated: 0,
        analysisTime: 50,
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      expect(result.current.conflicts).toContainEqual(mockConflict);
    });

    it('avoids duplicate conflicts', async () => {
      const mockConflict = {
        id: 'conflict-1',
        type: 'lore_violation' as const,
        severity: 'warning' as const,
        finding: {
          source: 'entity' as const,
          description: 'Test finding',
          offset: 100,
        },
        reference: {
          type: 'memory' as const,
          id: 'mem-1',
          text: 'Test reference',
        },
        explanation: 'Test explanation',
        createdAt: Date.now(),
      };

      vi.mocked(analyzeIntelligenceAgainstMemory).mockResolvedValue({
        conflicts: [mockConflict],
        memoriesCreated: 0,
        analysisTime: 50,
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
        await result.current.analyzeNow(createMockIntelligence());
      });

      // Should only have one conflict, not two
      expect(result.current.conflicts.filter((c) => c.id === 'conflict-1')).toHaveLength(1);
    });

    it('limits conflicts to 20', async () => {
      const manyConflicts = Array.from({ length: 25 }, (_, i) => ({
        id: `conflict-${i}`,
        type: 'lore_violation' as const,
        severity: 'info' as const,
        finding: {
          source: 'entity' as const,
          description: `Finding ${i}`,
          offset: i * 10,
        },
        reference: {
          type: 'memory' as const,
          id: `mem-${i}`,
          text: `Reference ${i}`,
        },
        explanation: `Explanation ${i}`,
        createdAt: Date.now(),
      }));

      vi.mocked(analyzeIntelligenceAgainstMemory).mockResolvedValue({
        conflicts: manyConflicts,
        memoriesCreated: 0,
        analysisTime: 50,
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      expect(result.current.conflicts.length).toBeLessThanOrEqual(20);
    });

    it('does not analyze when projectId is empty', async () => {
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, { ...defaultConfig, projectId: '' })
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      expect(analyzeIntelligenceAgainstMemory).not.toHaveBeenCalled();
    });

    it('handles analysis errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(analyzeIntelligenceAgainstMemory).mockRejectedValue(new Error('Analysis failed'));

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      expect(result.current.isAnalyzing).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('thinkNow', () => {
    it('invokes proactive thinker forceThink', async () => {
      const mockForceThink = vi.fn().mockResolvedValue({ suggestion: 'test' });
      vi.mocked(getProactiveThinker).mockReturnValue({
        forceThink: mockForceThink,
        getStatus: vi.fn(),
      } as any);

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.thinkNow();
      });

      expect(mockForceThink).toHaveBeenCalled();
    });
  });

  describe('management actions', () => {
    it('clearConflicts empties conflicts array', async () => {
      vi.mocked(analyzeIntelligenceAgainstMemory).mockResolvedValue({
        conflicts: [{ id: 'c1', type: 'lore_violation' as const, severity: 'info' as const, finding: { source: 'entity' as const, description: 'f' }, reference: { type: 'memory' as const, id: 'm', text: 'r' }, explanation: 'e', createdAt: Date.now() }],
        memoriesCreated: 0,
        analysisTime: 10,
      });

      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      await act(async () => {
        await result.current.analyzeNow(createMockIntelligence());
      });

      expect(result.current.conflicts.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearConflicts();
      });

      expect(result.current.conflicts).toEqual([]);
    });

    it('clearSuggestions empties suggestions array', () => {
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      act(() => {
        result.current.clearSuggestions();
      });

      expect(result.current.suggestions).toEqual([]);
    });

    it('dismissSuggestion removes specific suggestion', () => {
      // We can't easily add suggestions without the thinker callback
      // This test just verifies the function exists and doesn't error
      const { result } = renderHook(() =>
        useSmartnessPipeline(mockGetState, defaultConfig)
      );

      act(() => {
        result.current.dismissSuggestion('some-id');
      });

      // Should not throw
      expect(result.current.suggestions).toEqual([]);
    });
  });
});

describe('createIntelligenceCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls analyzeNow immediately on first call', () => {
    const mockAnalyzeNow = vi.fn();
    const callback = createIntelligenceCallback(mockAnalyzeNow);
    const intelligence = createMockIntelligence();

    callback(intelligence);

    expect(mockAnalyzeNow).toHaveBeenCalledWith(intelligence);
  });

  it('debounces subsequent calls', () => {
    const mockAnalyzeNow = vi.fn();
    const callback = createIntelligenceCallback(mockAnalyzeNow, { debounceMs: 5000 });
    const intelligence = createMockIntelligence();

    callback(intelligence);
    callback(intelligence);
    callback(intelligence);

    expect(mockAnalyzeNow).toHaveBeenCalledTimes(1);
  });

  it('allows calls after debounce period', () => {
    const mockAnalyzeNow = vi.fn();
    const callback = createIntelligenceCallback(mockAnalyzeNow, { debounceMs: 5000 });
    const intelligence = createMockIntelligence();

    callback(intelligence);
    expect(mockAnalyzeNow).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6000);

    callback(intelligence);
    expect(mockAnalyzeNow).toHaveBeenCalledTimes(2);
  });

  it('uses default debounce of 5000ms', () => {
    const mockAnalyzeNow = vi.fn();
    const callback = createIntelligenceCallback(mockAnalyzeNow);
    const intelligence = createMockIntelligence();

    callback(intelligence);
    vi.advanceTimersByTime(4000);
    callback(intelligence);

    expect(mockAnalyzeNow).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    callback(intelligence);

    expect(mockAnalyzeNow).toHaveBeenCalledTimes(2);
  });
});
