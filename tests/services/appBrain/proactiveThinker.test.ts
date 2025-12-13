import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProactiveThinker, startProactiveThinker, stopProactiveThinker, resetProactiveThinker, ProactiveThinker, setProactiveThinkerSettingsAdapter, resetProactiveThinkerSettingsAdapter } from '../../../services/appBrain/proactiveThinker';
import { eventBus } from '../../../services/appBrain/eventBus';
import { ai } from '../../../services/gemini/client';
import { evolveBedsideNote, getVoiceProfileForCharacter, upsertVoiceProfile } from '../../../services/memory';
import { extractFacts } from '../../../services/memory/factExtractor';
import { filterNovelLoreEntities } from '../../../services/memory/relevance';
import { getImportantReminders } from '../../../services/memory/proactive';
import { searchBedsideHistory } from '../../../services/memory/bedsideHistorySearch';
import { extractTemporalMarkers } from '../../../services/intelligence/timelineTracker';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import * as intelligenceBridge from '../../../services/appBrain/intelligenceMemoryBridge';
import { VoiceMetrics } from '../../../types/intelligence';

// Hoist mocks to avoid initialization errors
vi.mock('../../../services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('../../../services/memory', () => ({
  evolveBedsideNote: vi.fn(),
  getVoiceProfileForCharacter: vi.fn(),
  upsertVoiceProfile: vi.fn(),
}));

vi.mock('../../../services/memory/factExtractor', () => ({
  extractFacts: vi.fn(),
}));

vi.mock('../../../services/memory/relevance', () => ({
  filterNovelLoreEntities: vi.fn(),
}));

vi.mock('../../../services/memory/proactive', () => ({
  getImportantReminders: vi.fn(),
}));

vi.mock('../../../services/memory/bedsideHistorySearch', () => ({
  searchBedsideHistory: vi.fn(),
}));

vi.mock('../../../services/intelligence/timelineTracker', () => ({
  extractTemporalMarkers: vi.fn(),
}));

vi.mock('../../../services/intelligence/voiceProfiler', () => ({
  generateVoiceProfile: vi.fn(),
}));

vi.mock('../../../services/appBrain/eventBus', () => ({
  eventBus: {
    subscribeAll: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn(),
  },
}));

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn().mockReturnValue({
      suggestionWeights: {},
    }),
  },
}));

vi.mock('../../../services/appBrain/contextBuilder', () => ({
  buildCompressedContext: vi.fn().mockReturnValue('Mock Context'),
}));

vi.mock('../../../services/appBrain/intelligenceMemoryBridge', () => ({
  getHighPriorityConflicts: vi.fn().mockResolvedValue([]),
  formatConflictsForPrompt: vi.fn().mockReturnValue(''),
}));

const createMockMetrics = (overrides: Partial<VoiceMetrics> = {}): VoiceMetrics => ({
  avgSentenceLength: 10,
  sentenceVariance: 5,
  contractionRatio: 0.1,
  questionRatio: 0.1,
  exclamationRatio: 0.1,
  latinateRatio: 0.1,
  uniqueWordCount: 50,
  ...overrides,
});

describe('ProactiveThinker', () => {
  const mockGetState = vi.fn();
  const mockProjectId = 'project-123';
  const mockOnSuggestion = vi.fn();
  let thinker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetProactiveThinker();
    resetProactiveThinkerSettingsAdapter();
    thinker = getProactiveThinker({ enabled: true });

    // Default mocks
    const entitiesMock = { nodes: [] };

    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '', chapters: [] },
        intelligence: {
            full: { entities: entitiesMock },
            entities: entitiesMock,
            hud: {
                context: { activeEntities: [] },
                situational: { currentScene: {} }
            },
            timeline: { events: [] }
        },
        lore: { characters: [] },
    });

    vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: JSON.stringify({ significant: false, suggestions: [] }),
    } as any);

    // Set default resolved values to prevent "undefined" errors in background tasks
    vi.mocked(evolveBedsideNote).mockResolvedValue(undefined as any);
    vi.mocked(getVoiceProfileForCharacter).mockResolvedValue(null);
    vi.mocked(upsertVoiceProfile).mockResolvedValue({} as any);
    vi.mocked(getImportantReminders).mockResolvedValue([]);
    vi.mocked(searchBedsideHistory).mockResolvedValue([]);
    vi.mocked(extractTemporalMarkers).mockReturnValue([]);
    vi.mocked(generateVoiceProfile).mockReturnValue({
        metrics: createMockMetrics(),
        impression: 'Neutral',
        speakerName: 'Unknown',
        lineCount: 0,
        signatureWords: [],
    });
    vi.mocked(filterNovelLoreEntities).mockReturnValue([]);
    vi.mocked(extractFacts).mockReturnValue([]);
  });

  afterEach(() => {
    stopProactiveThinker();
    vi.useRealTimers();
  });

  it('processes urgent events immediately and batches non-urgent events', async () => {
    const getStateSpy = vi.fn(() => mockGetState());
    const onSuggestionSpy = vi.fn();

    thinker.start(getStateSpy, mockProjectId, onSuggestionSpy);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });

    expect(vi.getTimerCount()).toBe(0);

    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(ai.models.generateContent).toHaveBeenCalledTimes(1);

    vi.mocked(ai.models.generateContent).mockClear();

    callback({ type: 'ANALYSIS_COMPLETED', payload: { section: 'full_text', status: 'success' }, timestamp: Date.now() });

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(ai.models.generateContent).toHaveBeenCalledTimes(1);
    expect(getStateSpy).toHaveBeenCalled();
    expect(onSuggestionSpy).not.toHaveBeenCalled();
  });

  it('clears timers and pending events on stop', () => {
    const unsubscribe = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockReturnValue(unsubscribe);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 5, length: 0 }, timestamp: Date.now() });

    expect(thinker.getStatus().pendingEvents).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(1);

    thinker.stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(thinker.getStatus().pendingEvents).toHaveLength(0);
  });

  it('is a no-op when disabled', () => {
    resetProactiveThinker();

    const disabledThinker = getProactiveThinker({ enabled: false });

    disabledThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    expect(eventBus.subscribeAll).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(disabledThinker.getStatus().pendingEvents).toHaveLength(0);
  });

  it('should be a singleton', () => {
    const t1 = getProactiveThinker();
    const t2 = getProactiveThinker();
    expect(t1).toBe(t2);
  });

  it('should subscribe to event bus on start', () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    expect(eventBus.subscribeAll).toHaveBeenCalled();
  });

  it('should unsubscribe on stop', () => {
    const unsubscribe = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockReturnValue(unsubscribe);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    thinker.stop();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should trigger thinking after debounce when events accumulate', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 100 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 110 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 120 }, timestamp: Date.now() });

    expect(ai.models.generateContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(11000);

    expect(ai.models.generateContent).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'PROACTIVE_THINKING_STARTED' }));
    expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'PROACTIVE_THINKING_COMPLETED' }));
  });

  it('should trigger immediately for urgent events', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'ANALYSIS_COMPLETED', payload: { section: 'full_text', status: 'success' }, timestamp: Date.now() });

    await vi.advanceTimersByTimeAsync(3000);

    expect(ai.models.generateContent).toHaveBeenCalled();
  });

  it('should detect voice drift', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const entitiesMock = { nodes: [{ type: 'character', name: 'Alice' }] };
    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '"Hello there," Alice said.' },
        intelligence: {
            full: { entities: entitiesMock },
            entities: entitiesMock,
            hud: { context: { activeEntities: [] }, situational: {} },
            timeline: { events: [] }
        },
        lore: { characters: [] },
    });

    vi.mocked(generateVoiceProfile).mockReturnValue({
        metrics: createMockMetrics({ avgSentenceLength: 2 }), // Low length
        impression: 'Curt',
        speakerName: 'Alice',
        lineCount: 1,
        signatureWords: [],
    });

    vi.mocked(getVoiceProfileForCharacter).mockResolvedValue({
        metrics: createMockMetrics({ avgSentenceLength: 15 }), // High length
        impression: 'Verbose',
        speakerName: 'Alice',
        lineCount: 100,
        signatureWords: [],
    });

    vi.mocked(upsertVoiceProfile).mockResolvedValue({} as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
    await vi.advanceTimersByTimeAsync(100);

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
        type: 'voice_inconsistency',
        title: expect.stringContaining('Voice drift detected'),
    }));
  });

  it('should not detect voice drift if deviation is low', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const entitiesMock = { nodes: [{ type: 'character', name: 'Alice' }] };
    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '"Hello there," Alice said.' },
        intelligence: {
            full: { entities: entitiesMock },
            entities: entitiesMock,
            hud: { context: { activeEntities: [] }, situational: {} },
            timeline: { events: [] }
        },
        lore: { characters: [] },
    });

    vi.mocked(generateVoiceProfile).mockReturnValue({
        metrics: createMockMetrics({ avgSentenceLength: 10 }),
        impression: 'Neutral',
        speakerName: 'Alice',
        lineCount: 1,
        signatureWords: [],
    });

    vi.mocked(getVoiceProfileForCharacter).mockResolvedValue({
        metrics: createMockMetrics({ avgSentenceLength: 11 }), // Small difference
        impression: 'Verbose',
        speakerName: 'Alice',
        lineCount: 100,
        signatureWords: [],
    });

    vi.mocked(upsertVoiceProfile).mockResolvedValue({} as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });

    await vi.advanceTimersByTimeAsync(100);

    expect(mockOnSuggestion).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'voice_inconsistency',
    }));
  });

  it('should handle AI errors gracefully', async () => {
    vi.mocked(ai.models.generateContent).mockRejectedValue(new Error('AI Error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Thinking failed'), '', expect.any(Error));
  });

  it('should use long term memory context', async () => {
    vi.mocked(searchBedsideHistory).mockResolvedValue([
      { note: { id: '1', text: 'Old memory', createdAt: Date.now() }, similarity: 0.9 }
    ] as any);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.stringContaining('Old memory'),
    }));
  });

  it('should detect timeline conflicts', async () => {
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

      const mockState = {
          manuscript: {
              projectId: mockProjectId,
              activeChapterId: 'ch1',
              currentText: 'It was Monday morning.'
          },
          intelligence: {
              timeline: {
                  events: [
                      {
                          chapterId: 'ch1',
                          offset: 0,
                          temporalMarker: 'Sunday night',
                          description: 'It was Sunday night.'
                      }
                  ]
              },
              full: { entities: { nodes: [] } },
              hud: { context: { activeEntities: [] }, situational: {} }
          },
      };
      mockGetState.mockReturnValue(mockState);

      vi.mocked(extractTemporalMarkers)
          .mockReturnValueOnce([{ category: 'day', normalized: 'monday', marker: 'Monday', offset: 0, sentence: 'It was Monday morning.' }])
          .mockReturnValueOnce([{ category: 'day', normalized: 'sunday', marker: 'Sunday', offset: 0, sentence: 'It was Sunday night.' }]);

      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 600, chapterId: 'ch1' }, timestamp: Date.now() });

      await vi.advanceTimersByTimeAsync(100);

      expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
          type: 'timeline_conflict',
          title: 'Timeline conflict detected',
      }));
  });

  it('should detect lore suggestions', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const entitiesMock = { nodes: [{ type: 'object', name: 'Magic Sword', mentionCount: 3 }] };
    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: 'ch1' },
        intelligence: {
            full: { entities: entitiesMock },
            entities: entitiesMock,
            hud: { context: { activeEntities: [] }, situational: {} },
            timeline: { events: [] }
        },
        lore: { characters: [] },
    });

    vi.mocked(filterNovelLoreEntities).mockReturnValue([{
        name: 'Magic Sword',
        type: 'object',
        firstMention: 10
    }]);

    vi.mocked(extractFacts).mockReturnValue([{
        subject: 'Magic Sword',
        predicate: 'is',
        object: 'shiny',
        confidence: 0.9,
        sourceOffset: 10,
        sourceType: 'entity'
    }]);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100, chapterId: 'ch1' }, timestamp: Date.now() });

    // Trigger think
    await vi.advanceTimersByTimeAsync(11000);

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
        type: 'lore_discovery',
        title: expect.stringContaining('Magic Sword'),
    }));
  });

  it('should handle chapter transition with issues and watched entities', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    await callback({
      type: 'CHAPTER_CHANGED',
      payload: {
          projectId: mockProjectId,
          chapterId: 'ch1',
          title: 'Chapter 1',
          issues: [{ description: 'Pacing issue', severity: 'error' }],
          watchedEntities: [{ name: 'Hero', priority: 'high', reason: 'development' }]
      },
      timestamp: Date.now()
    });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Pacing issue'),
      expect.any(Object)
    );
    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Hero'),
      expect.any(Object)
    );
  });

  it('handles chapter transition with no issues or watched entities', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    await callback({
      type: 'CHAPTER_CHANGED',
      payload: {
        projectId: mockProjectId,
        chapterId: 'ch2',
        title: 'Chapter 2',
        issues: [],
        watchedEntities: [],
      },
      timestamp: Date.now(),
    });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Now in chapter: "Chapter 2"'),
      expect.objectContaining({ changeReason: 'chapter_transition', chapterId: 'ch2' }),
    );
    const callText = vi.mocked(evolveBedsideNote).mock.calls[0]?.[1] as string;
    expect(callText).not.toContain('Chapter issues to watch');
    expect(callText).not.toContain('Watched entities');
  });

  it('formats chapter issues and watched entities without optional metadata', async () => {
    vi.mocked(evolveBedsideNote).mockClear();
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    await callback({
      type: 'CHAPTER_CHANGED',
      payload: {
        projectId: mockProjectId,
        chapterId: 'ch3',
        title: 'Chapter 3',
        issues: [{ description: 'Continuity check' }],
        watchedEntities: [{ name: 'Hero' }],
      },
      timestamp: Date.now(),
    });

    const planText = vi.mocked(evolveBedsideNote).mock.calls[0]?.[1] as string;
    expect(planText).toContain('- Continuity check');
    expect(planText).toContain('- Hero');
    expect(planText).not.toContain('[');
    expect(planText).not.toContain('—');
  });

  it('should evolve bedside note when reminders are present', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    vi.mocked(getImportantReminders).mockResolvedValue([
        { title: 'Unresolved Plot', description: 'Resolve the cliffhanger', priority: 'high', id: '1', type: 'plot', source: { type: 'memory', id: '1' }, createdAt: 0, tags: [] }
    ]);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: JSON.stringify({
            significant: true,
            suggestions: [],
            reasoning: 'Significant reasoning',
        }),
    } as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(evolveBedsideNote).toHaveBeenCalledWith(
        mockProjectId,
        expect.stringContaining('Unresolved Plot'),
        expect.objectContaining({ changeReason: 'proactive_thinking' })
    );
  });

  it('should apply adaptive relevance weights correctly', async () => {
    setProactiveThinkerSettingsAdapter({
        getSuggestionWeights: () => ({
            plot: 0.1, // Should mute or lower priority
            character: 1.0, // Normal
            pacing: 1.9, // Boost
            style: 1.0,
            continuity: 1.0,
            lore_discovery: 1.0,
            timeline_conflict: 1.0,
            voice_inconsistency: 1.0,
            other: 1.0,
        }),
    });

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: JSON.stringify({
            significant: true,
            suggestions: [
                { title: 'Pacing Issue', type: 'pacing', priority: 'low' },
                { title: 'Plot Hole', type: 'plot', priority: 'high' }
            ],
        }),
    } as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Pacing Issue',
        priority: 'high',
    }));

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Plot Hole',
        priority: 'low',
    }));
  });

  it('should prioritize suggestions based on configured weights', async () => {
    setProactiveThinkerSettingsAdapter({
        getSuggestionWeights: () => ({
            plot: 0.1,      // Should mute
            style: 2.0,     // Should boost
            character: 1.0, // Neutral
            // ... defaults for others
            pacing: 1.0, continuity: 1.0, lore_discovery: 1.0,
            timeline_conflict: 1.0, voice_inconsistency: 1.0, other: 1.0,
        }),
    });

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: JSON.stringify({
            significant: true,
            suggestions: [
                { title: 'Plot Item', type: 'plot', priority: 'high' },
                { title: 'Style Item', type: 'style', priority: 'low' },
            ],
        }),
    } as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 0 }, timestamp: Date.now() });

    await thinker.forceThink();

    const calls = mockOnSuggestion.mock.calls;
    const styleCall = calls.find(c => c[0].title === 'Style Item');
    const plotCall = calls.find(c => c[0].title === 'Plot Item');

    expect(styleCall).toBeDefined();
    expect(plotCall).toBeDefined();

    expect(styleCall[0].priority).toMatch(/high|medium/);
    expect(plotCall[0].priority).toMatch(/low|medium/);
  });

  it('should fetch long term memory context with matches', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const entitiesMock = { nodes: [] };
    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId },
        intelligence: {
            full: { entities: entitiesMock },
            entities: entitiesMock,
            hud: {
                context: { activeEntities: [{ name: 'Alice' }] },
                situational: { currentScene: { type: 'Action' } }
            }
        }
    });

    vi.mocked(searchBedsideHistory).mockResolvedValue([
        { note: { id: '1', text: 'Important memory', createdAt: Date.now() }, similarity: 0.9 }
    ] as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(searchBedsideHistory).toHaveBeenCalledWith(
        mockProjectId,
        expect.stringContaining('Alice'),
        expect.any(Object)
    );
    expect(searchBedsideHistory).toHaveBeenCalledWith(
        mockProjectId,
        expect.stringContaining('Action'),
        expect.any(Object)
    );

    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.stringContaining('Important memory'),
    }));
  });

  it('should handle no long term memory matches', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    vi.mocked(searchBedsideHistory).mockResolvedValue([]);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.not.stringContaining('LONG-TERM MEMORY'),
    }));
  });

  it('should handle malformed AI responses gracefully', async () => {
    // 1. ARRANGE
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    // Mock AI returning broken JSON
    vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: '{ "significant": true, "suggestions": [ ... incomplete json',
    } as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 0 }, timestamp: Date.now() });

    // 2. ACT
    const result = await thinker.forceThink();

    // 3. ASSERT
    // It should not throw, should return safe default, and log a warning
    expect(result).toEqual(expect.objectContaining({
      suggestions: [],
      significant: false
    }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse'), expect.anything());

    warnSpy.mockRestore();
  });

  it('caps pending events at maxBatchSize', () => {
    const cappedThinker = new ProactiveThinker({
      enabled: true,
      maxBatchSize: 3,
      minEventsToThink: 1,
      debounceMs: 10_000,
    });

    cappedThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    for (let i = 0; i < 5; i += 1) {
      callback({
        type: 'TEXT_CHANGED',
        payload: { delta: 1, length: 100 + i },
        timestamp: Date.now(),
      });
    }

    const status = cappedThinker.getStatus();
    expect(status.pendingEvents.length).toBe(3);

    cappedThinker.stop();
  });

  it('logs bedside evolve failures during thinking', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      text: JSON.stringify({
        significant: true,
        suggestions: [{ title: 'Issue', description: 'desc', priority: 'medium', type: 'plot' }],
      }),
    } as any);
    vi.mocked(getImportantReminders).mockResolvedValue([{ title: 'R', description: 'D' } as any]);
    vi.mocked(evolveBedsideNote).mockRejectedValue(new Error('fail evolve'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Bedside evolve failed'), expect.anything());

    warnSpy.mockRestore();
  });

  it('returns null when forcing think without setup or events', async () => {
    expect(await thinker.forceThink()).toBeNull();

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    expect(await thinker.forceThink()).toBeNull();
  });

  it('should evolve bedside note on significant edit after cooldown', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Trigger significant edits
    callback({ type: 'TEXT_CHANGED', payload: { delta: 600, length: 0 }, timestamp: Date.now() });

    // Initial state: not past cooldown (lastEditEvolveAt = 0) but cooldown check depends on (now - 0) > 5 mins
    // Wait, lastEditEvolveAt is 0 initially.
    // SIGNIFICANT_EDIT_COOLDOWN_MS is 5 * 60 * 1000.
    // If now is small (Date.now() defaults to near 0 with fake timers?), then now - 0 might be small.
    // Actually, Date.now() starts at some value.
    // Let's advance time to ensure we are past cooldown.

    // Force time to be large enough initially or advance it.
    // By default, lastEditEvolveAt is 0.
    // So if Date.now() is > 300,000, the first check passes.

    vi.setSystemTime(new Date().getTime() + 400_000); // Ensure we are past the initial cooldown relative to 0

    callback({ type: 'TEXT_CHANGED', payload: { delta: 600, length: 0 }, timestamp: Date.now() });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Significant edits detected'),
      expect.objectContaining({ changeReason: 'significant_edit' })
    );
  });

  it('includes active chapter details when evolving bedside note for significant edits', async () => {
    vi.mocked(evolveBedsideNote).mockClear();
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    mockGetState.mockReturnValue({
      manuscript: {
        projectId: mockProjectId,
        activeChapterId: 'ch1',
        currentText: '',
        chapters: [{ id: 'ch1', title: 'Chapter One' }],
      },
      intelligence: {
        full: { entities: { nodes: [] } },
        entities: { nodes: [] },
        hud: { context: { activeEntities: [] }, situational: { currentScene: {} } },
        timeline: { events: [] },
      },
      lore: { characters: [] },
    });

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    vi.setSystemTime(new Date().getTime() + 400_000);
    callback({ type: 'TEXT_CHANGED', payload: { delta: 600, length: 0 }, timestamp: Date.now() });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('in "Chapter One"'),
      expect.objectContaining({
        changeReason: 'significant_edit',
        extraTags: expect.arrayContaining(['chapter:ch1', 'edit:significant']),
      }),
    );
  });

  it('does not trigger conflict detection when within timeline check cooldown', async () => {
    vi.mocked(extractTemporalMarkers).mockClear();

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const mockState = {
      manuscript: {
        projectId: mockProjectId,
        activeChapterId: 'ch1',
        currentText: 'It was Monday morning.',
      },
      intelligence: {
        timeline: {
          events: [
            {
              chapterId: 'ch1',
              offset: 0,
              temporalMarker: 'Sunday night',
              description: 'It was Sunday night.',
            },
          ],
        },
        full: { entities: { nodes: [] } },
        entities: { nodes: [] },
        hud: { context: { activeEntities: [] }, situational: {} },
      },
      lore: { characters: [] },
    };

    mockGetState.mockReturnValue(mockState);

    vi.mocked(extractTemporalMarkers)
      .mockReturnValueOnce([
        { category: 'day', normalized: 'monday', marker: 'Monday', offset: 0, sentence: 'It was Monday morning.' },
      ])
      .mockReturnValueOnce([
        { category: 'day', normalized: 'sunday', marker: 'Sunday', offset: 0, sentence: 'It was Sunday night.' },
      ]);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 600 }, timestamp: Date.now() });
    expect(extractTemporalMarkers).toHaveBeenCalled();

    vi.mocked(extractTemporalMarkers).mockClear();
    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 600 }, timestamp: Date.now() });
    expect(extractTemporalMarkers).not.toHaveBeenCalled();
  });

  it('does not trigger conflict detection when no temporal markers are found', async () => {
    vi.mocked(extractTemporalMarkers).mockReturnValueOnce([]);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    mockGetState.mockReturnValue({
      manuscript: {
        projectId: mockProjectId,
        activeChapterId: 'ch1',
        currentText: 'No markers here.',
      },
      intelligence: {
        timeline: { events: [] },
        full: { entities: { nodes: [] } },
        entities: { nodes: [] },
        hud: { context: { activeEntities: [] }, situational: {} },
      },
      lore: { characters: [] },
    });

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 600 }, timestamp: Date.now() });

    expect(mockOnSuggestion).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'timeline_conflict' }));
  });

  it('extractDialogueBlocks skips empty quotes', () => {
    const blocks = (thinker as any).extractDialogueBlocks('"          "');
    expect(blocks).toEqual([]);
  });

  it('inferDialogueSpeaker uses attribution fallback and returns candidate when unknown', () => {
    const speaker = (thinker as any).inferDialogueSpeaker('"Hello" said Bob.', ['Alice']);
    expect(speaker).toBe('Bob');
  });

  it('inferDialogueSpeaker returns exact known character when attribution matches case-insensitively', () => {
    const speaker = (thinker as any).inferDialogueSpeaker('"Hello" said bob.', ['Bob']);
    expect(speaker).toBe('Bob');
  });

  it('injects detected conflicts into proactive thinking prompt', async () => {
    vi.mocked((intelligenceBridge as any).getHighPriorityConflicts).mockResolvedValueOnce([{ id: 'c1' }]);
    vi.mocked((intelligenceBridge as any).formatConflictsForPrompt).mockReturnValueOnce('CONFLICTS');

    vi.mocked(ai.models.generateContent).mockImplementationOnce(async (args: any) => {
      expect(args.contents).toContain('DETECTED CONFLICTS');
      expect(args.contents).toContain('CONFLICTS');
      return { text: JSON.stringify({ significant: false, suggestions: [] }) } as any;
    });

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();
  });

  it('skips bedside evolve when significant but there are no suggestions or reminders', async () => {
    vi.mocked(evolveBedsideNote).mockClear();
    vi.mocked(getImportantReminders).mockResolvedValueOnce([]);
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: JSON.stringify({ significant: true, suggestions: [] }),
    } as any);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(evolveBedsideNote).not.toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Proactive opportunities'),
      expect.anything(),
    );
  });

  it('formats empty event list for prompt', () => {
    expect((thinker as any).formatEventsForPrompt([])).toBe('No recent events.');
  });

  it('mutes suggestions when adaptive weight is near zero', () => {
    setProactiveThinkerSettingsAdapter({
      getSuggestionWeights: () => ({
        plot: 0.0,
        character: 1.0,
        pacing: 1.0,
        style: 1.0,
        continuity: 1.0,
        lore_discovery: 1.0,
        timeline_conflict: 1.0,
        voice_inconsistency: 1.0,
        other: 1.0,
      }),
    });

    const filtered = (thinker as any).applyAdaptiveRelevance([
      {
        id: 's1',
        type: 'related_memory',
        priority: 'high',
        title: 'Plot item',
        description: 'desc',
        source: { type: 'memory', id: 'x' },
        tags: ['plot'],
        createdAt: 0,
      },
    ]);

    expect(filtered).toEqual([]);
  });

  it('should check timeline conflicts on significant edit after cooldown', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    // Setup state to pass checks
    const mockState = {
        manuscript: {
            projectId: mockProjectId,
            activeChapterId: 'ch1',
            currentText: 'New text',
            chapters: []
        },
        intelligence: {
            timeline: { events: [] },
            full: { entities: { nodes: [] } },
            hud: { context: { activeEntities: [] }, situational: {} }
        },
    };
    mockGetState.mockReturnValue(mockState);

    vi.mocked(extractTemporalMarkers).mockReturnValue([{
        category: 'day', normalized: 'new', marker: 'new', offset: 0, sentence: 's'
    }]);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Ensure past cooldown
    vi.setSystemTime(new Date().getTime() + 40_000);

    await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });

    // Just verifying that it ran without error and updated lastTimelineCheckAt
    // We can check if it called extractTemporalMarkers
    expect(extractTemporalMarkers).toHaveBeenCalledWith('New text');
  });

  // Coverage expansions
  describe('Coverage Expansions', () => {

    it('does not start when disabled via config', () => {
      // Test config.enabled check in start()
      const disabledThinker = new ProactiveThinker({ enabled: false });
      const spy = vi.spyOn(eventBus, 'subscribeAll');
      disabledThinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      expect(spy).not.toHaveBeenCalled();
    });

    it('forceThink returns null if not initialized', async () => {
      // Covers `if (!this.getState || !this.projectId)` in forceThink
      const t = new ProactiveThinker();
      expect(await t.forceThink()).toBeNull();
    });

    it('maybeUpdateBedsideNotes handles missing dependencies', () => {
      // Covers `if (!this.projectId || !this.getState)` in maybeUpdateBedsideNotes
      const t = new ProactiveThinker();
      // @ts-ignore
      t.handleEvent({ type: 'TEXT_CHANGED' });
      // Should not throw and just return
    });

    it('handleSignificantEdit respects threshold and cooldown', () => {
      // Covers `if (!exceededThreshold || !pastCooldown)`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

      // We need to set time > 300000 to pass initial cooldown check if lastEditEvolveAt=0
      vi.setSystemTime(400_000);

      // 1. Small delta (below 500)
      callback({ type: 'TEXT_CHANGED', payload: { delta: 100, length: 0 }, timestamp: Date.now() });
      expect(evolveBedsideNote).not.toHaveBeenCalled();

      // 2. Large delta, but recently evolved (if we trigger one first)
      // Trigger a success first
      callback({ type: 'TEXT_CHANGED', payload: { delta: 600, length: 0 }, timestamp: Date.now() });
      expect(evolveBedsideNote).toHaveBeenCalledTimes(1);
      vi.mocked(evolveBedsideNote).mockClear();

      // Now lastEditEvolveAt = 400,000.
      // Advance just a bit
      vi.setSystemTime(400_100);
      callback({ type: 'TEXT_CHANGED', payload: { delta: 600, length: 0 }, timestamp: Date.now() });
      // Should fail cooldown
      expect(evolveBedsideNote).not.toHaveBeenCalled();
    });

    it('detectConflicts exits early on missing data', async () => {
      // Covers `if (!timeline || !activeChapterId)` and `if (!currentText)`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      vi.setSystemTime(10_000_000); // Past cooldown

      // 1. No timeline
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: 'ch1', currentText: 'Txt' },
        intelligence: { timeline: null } // No timeline
      });
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      expect(extractTemporalMarkers).not.toHaveBeenCalled();

      // 2. No activeChapterId
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: null, currentText: 'Txt' },
        intelligence: { timeline: { events: [] } }
      });
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      expect(extractTemporalMarkers).not.toHaveBeenCalled();

      // 3. No currentText
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: 'ch1', currentText: '' },
        intelligence: { timeline: { events: [] } }
      });
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      expect(extractTemporalMarkers).not.toHaveBeenCalled();
    });

    it('detectConflicts handles missing baseText', async () => {
      // Covers `if (!baseText) continue;`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      vi.setSystemTime(20_000_000);

      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: 'ch1', currentText: 'Monday' },
        intelligence: {
            timeline: {
                events: [
                    { chapterId: 'ch1', offset: 0, temporalMarker: null, description: null } // Both null
                ]
            },
            full: { entities: { nodes: [] } }
        },
      });
      vi.mocked(extractTemporalMarkers).mockReturnValue([{ category: 'day', normalized: 'monday', marker: 'Monday', offset: 0, sentence: '' }]);

      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });

      // Should run but find no historical markers, so no conflict
      expect(mockOnSuggestion).not.toHaveBeenCalled();
    });

    it('detectConflicts handles new marker (no previous)', async () => {
      // Covers `if (!previous)`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      vi.setSystemTime(30_000_000);

      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, activeChapterId: 'ch1', currentText: 'Tuesday' },
        intelligence: {
            timeline: { events: [] }, // No history
            full: { entities: { nodes: [] } }
        },
      });
      vi.mocked(extractTemporalMarkers).mockReturnValue([{ category: 'day', normalized: 'tuesday', marker: 'Tuesday', offset: 0, sentence: '' }]);

      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });

      expect(mockOnSuggestion).not.toHaveBeenCalled();
    });

    it('detectVoiceConsistency handles missing data', async () => {
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

      // 1. No quotes in text -> `if (!text.includes('"'))`
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: 'No quotes here' },
        intelligence: { full: { entities: { nodes: [] } }, entities: { nodes: [] } },
        lore: { characters: [] },
      });
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      expect(generateVoiceProfile).not.toHaveBeenCalled();

      // 2. No speaker found -> `if (!speaker)`
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '"Unknown voice."' },
        intelligence: { full: { entities: { nodes: [] } }, entities: { nodes: [] } },
        lore: { characters: [] },
      });
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      expect(upsertVoiceProfile).not.toHaveBeenCalled();

      // 3. No baseline profile -> `if (!baseline)`
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '"Hello, this is a much longer sentence to satisfy the regex length requirement." Alice said.' },
        intelligence: { full: { entities: { nodes: [] } }, entities: { nodes: [{ type: 'character', name: 'Alice' }] } },
        lore: { characters: [] },
      });
      vi.mocked(getVoiceProfileForCharacter).mockResolvedValue(null);
      await callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      // Should call upsert but not generate suggestion
      expect(upsertVoiceProfile).toHaveBeenCalled();
      expect(mockOnSuggestion).not.toHaveBeenCalled();
    });

    it('detectLoreSuggestions exits early', async () => {
      // 1. No significant edit -> `if (!sawSignificantEdit)`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      // We need to trigger think without significant edit event?
      // But think is triggered by events.
      // If we send only TEXT_CHANGED (not significant), it might trigger if we force it?
      // `detectLoreSuggestions` is called in `performThinking`.
      // So let's forceThink with pending events that are NOT significant edits.
      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      callback({ type: 'TEXT_CHANGED', payload: { delta: 1, length: 0 }, timestamp: Date.now() });
      // Manual force think
      await thinker.forceThink();
      // Should not call filterNovelLoreEntities
      expect(filterNovelLoreEntities).not.toHaveBeenCalled();

      // 2. No entities -> `if (!intelligence?.entities?.nodes?.length)`
      mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId },
        intelligence: { full: { entities: { nodes: [] } } }, // Empty nodes
        lore: { characters: [] }
      });
      // Add significant edit event to pending
      callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 100 }, timestamp: Date.now() });
      await thinker.forceThink();
      expect(filterNovelLoreEntities).not.toHaveBeenCalled();
    });

    it('parseThinkingResult handles invalid JSON', async () => {
      // Covers `if (!parsed)`
      thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
      vi.mocked(ai.models.generateContent).mockResolvedValue({ text: 'invalid json' } as any);

      const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
      callback({ type: 'TEXT_CHANGED', payload: { delta: 10, length: 0 }, timestamp: Date.now() });

      const result = await thinker.forceThink();
      expect(result.suggestions).toEqual([]);
      expect(result.significant).toBe(false);
    });

    it('clearDebounceTimer handles null timer', () => {
      // Covers `if (!this.debounceTimer)`
      // This is private. We can check via side effects or just rely on 'stop' test which calls it.
      // 'stop' test already calls it. If timer is null, it returns.
      // We can verify no error is thrown.
      const t = new ProactiveThinker();
      t.stop(); // calls clearDebounceTimer with null
    });

    it('canEvolveBedside handles config disabled', () => {
      // Covers `if (!this.config.allowBedsideEvolve)`
      // Implicitly tested via `maybeEvolveBedsideNote`
      const t = new ProactiveThinker({ allowBedsideEvolve: false });
      t.start(mockGetState, mockProjectId, mockOnSuggestion);
      // @ts-ignore - accessing private
      t.maybeEvolveBedsideNote('test', {});
      expect(evolveBedsideNote).not.toHaveBeenCalled();
    });

    it('maybeEvolveBedsideNote checks projectId and evolve capability', async () => {
      // Covers `if (!this.projectId || !this.canEvolveBedside())`
      const t = new ProactiveThinker();
      // No start() called, so projectId is null.
      // @ts-ignore
      await t.maybeEvolveBedsideNote('test', {});
      expect(evolveBedsideNote).not.toHaveBeenCalled();
    });

    it('applyAdaptiveRelevance mutes and reprioritizes suggestions using weights', () => {
      setProactiveThinkerSettingsAdapter({
        getSuggestionWeights: () => ({
          plot: 0.0,
          character: 0.4,
          pacing: 0.2,
          style: 1.6,
          continuity: 2.0,
          lore_discovery: 1.0,
          timeline_conflict: 1.0,
          voice_inconsistency: 1.0,
          other: 1.0,
        }),
      });

      const t = new ProactiveThinker({ enabled: true });
      const suggestions = [
        { type: 'related_memory', tags: ['plot'], priority: 'high', text: 'plot' },
        { type: 'character', priority: 'high', text: 'character' },
        { type: 'pacing', priority: 'high', text: 'pacing' },
        { type: 'style', priority: 'low', text: 'style' },
        { type: 'continuity', priority: 'medium', text: 'continuity' },
        { type: 'other', priority: 'medium', text: 'other' },
      ] as any[];

      // @ts-ignore - private helper for deterministic coverage
      const weighted = t.applyAdaptiveRelevance(suggestions);

      // Hard-mute plot suggestion
      expect(weighted.some((s: any) => s.text === 'plot')).toBe(false);

      // Reprioritized outputs should be sorted by priority
      const priorities = weighted.map((s: any) => s.priority);
      expect(priorities[0]).toBe('high');
      expect(priorities).toContain('low');

      const byText = Object.fromEntries(weighted.map((s: any) => [s.text, s.priority]));
      expect(byText.character).toBe('medium'); // high -> medium (weight < 0.5)
      expect(byText.pacing).toBe('low'); // high -> low (weight < 0.3)
      expect(byText.style).toBe('medium'); // low -> medium (weight > 1.5)
      expect(byText.continuity).toBe('high'); // forced high (weight > 1.8)
    });

    it('getSuggestionCategory maps related_memory tags and falls back to other', () => {
      const t = new ProactiveThinker({ enabled: true });

      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: ['plot'] })).toBe('plot');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: ['character'] })).toBe('character');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: ['pacing'] })).toBe('pacing');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: ['style'] })).toBe('style');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: ['continuity'] })).toBe('continuity');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'related_memory', tags: [] })).toBe('other');
      // @ts-ignore
      expect(t.getSuggestionCategory({ type: 'voice_inconsistency' })).toBe('voice_inconsistency');
    });

    it('formatAge emits day/hour/minute/just-now variants', () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
      const t = new ProactiveThinker({ enabled: true });

      // @ts-ignore
      expect(t.formatAge(Date.now() - 2 * 86400000)).toBe('2d ago');
      // @ts-ignore
      expect(t.formatAge(Date.now() - 3 * 3600000)).toBe('3h ago');
      // @ts-ignore
      expect(t.formatAge(Date.now() - 15 * 60000)).toBe('15m ago');
      // @ts-ignore
      expect(t.formatAge(Date.now() - 5000)).toBe('just now');
    });
  });
});
