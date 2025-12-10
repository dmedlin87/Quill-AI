import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProactiveThinker, startProactiveThinker, stopProactiveThinker, resetProactiveThinker, ProactiveThinker } from '../../../services/appBrain/proactiveThinker';
import { eventBus } from '../../../services/appBrain/eventBus';
import { ai } from '../../../services/gemini/client';
import { evolveBedsideNote, getVoiceProfileForCharacter, upsertVoiceProfile } from '../../../services/memory';
import { extractFacts } from '../../../services/memory/factExtractor';
import { filterNovelLoreEntities } from '../../../services/memory/relevance';
import { getImportantReminders } from '../../../services/memory/proactive';
import { searchBedsideHistory } from '../../../services/memory/bedsideHistorySearch';
import { extractTemporalMarkers } from '../../../services/intelligence/timelineTracker';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { buildCompressedContext } from '../../../services/appBrain/contextBuilder';
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
    thinker = getProactiveThinker({ enabled: true });

    // Default mocks
    const entitiesMock = { nodes: [] };

    mockGetState.mockReturnValue({
        manuscript: { projectId: mockProjectId, currentText: '' },
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

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Thinking failed'), expect.any(Error));
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
    vi.mocked(useSettingsStore.getState).mockReturnValue({
        suggestionWeights: {
            plot: 0.1, // Should mute or lower priority
            character: 1.0, // Normal
            pacing: 1.9 // Boost
        },
    } as any);

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

  it('applies weighting rules and sorting for related memory suggestions', () => {
    vi.mocked(useSettingsStore.getState).mockReturnValue({
        suggestionWeights: {
            plot: 0.01, // Hard mute
            character: 0.4, // Downgrade from high to medium
            style: 2.0, // Boost from low to high
        },
    } as any);

    const weighted = (thinker as any).applyAdaptiveRelevance([
        { title: 'Plot callback', type: 'related_memory', tags: ['plot'], priority: 'high' },
        { title: 'Character arc', type: 'related_memory', tags: ['character'], priority: 'high' },
        { title: 'Style tweak', type: 'related_memory', tags: ['style'], priority: 'low' },
    ]);

    expect(weighted).toHaveLength(2);
    expect(weighted[0]).toMatchObject({
        title: 'Style tweak',
        priority: 'high',
    });
    expect(weighted[1]).toMatchObject({
        title: 'Character arc',
        priority: 'medium',
    });
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

  it('skips bedside evolution when disabled or cooling down', async () => {
    const disabledThinker = new ProactiveThinker({ allowBedsideEvolve: false });
    disabledThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    await (disabledThinker as any).maybeEvolveBedsideNote('Plan text', {
      changeReason: 'test',
    });

    expect(evolveBedsideNote).not.toHaveBeenCalled();

    disabledThinker.stop();

    const coolingThinker = new ProactiveThinker({ allowBedsideEvolve: true });
    coolingThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    (coolingThinker as any).state.lastBedsideEvolveAt = Date.now();

    await (coolingThinker as any).maybeEvolveBedsideNote('Plan text', {
      changeReason: 'test',
    });

    expect(evolveBedsideNote).not.toHaveBeenCalled();

    coolingThinker.stop();
  });

  it('maps categories and weighting for adaptive relevance', () => {
    vi.mocked(useSettingsStore.getState).mockReturnValue({
        suggestionWeights: {
            other: 0.01,
        },
    } as any);

    const weighted = (thinker as any).applyAdaptiveRelevance([
        { title: 'Misc item', type: 'related_memory', tags: ['other'], priority: 'high' },
        { title: 'Continuity note', type: 'continuity', priority: 'medium', tags: ['continuity'] },
    ]);

    expect(weighted).toHaveLength(1);
    expect(weighted[0]).toMatchObject({
        title: 'Continuity note',
        priority: 'medium',
    });
    expect((thinker as any).getSuggestionCategory({ type: 'related_memory', tags: ['continuity'] })).toBe('continuity');
    expect((thinker as any).getSuggestionCategory({ type: 'unknown' })).toBe('unknown');
  });

  it('formats age across ranges', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    expect((thinker as any).formatAge(now - 2 * 86400000)).toBe('2d ago');
    expect((thinker as any).formatAge(now - 2 * 3600000)).toBe('2h ago');
    expect((thinker as any).formatAge(now - 5 * 60000)).toBe('5m ago');
    expect((thinker as any).formatAge(now)).toBe('just now');
  });

  it('handles long-term memory fetch errors gracefully', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    vi.mocked(searchBedsideHistory).mockRejectedValue(new Error('fail'));

    const result = await (thinker as any).fetchLongTermMemoryContext(mockGetState());

    expect(result).toEqual({ text: '', matches: [] });
  });

  it('evolves bedside notes when allowed and logs failures', async () => {
    const cooldownThinker = new ProactiveThinker({ allowBedsideEvolve: true, bedsideCooldownMs: 0 });
    cooldownThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    await (cooldownThinker as any).maybeEvolveBedsideNote('Plan text', {
      changeReason: 'test',
    });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      'Plan text',
      expect.objectContaining({ changeReason: 'test' })
    );

    vi.mocked(evolveBedsideNote).mockRejectedValueOnce(new Error('oops'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await (cooldownThinker as any).maybeEvolveBedsideNote('Plan text', {
      changeReason: 'test',
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Bedside evolve failed:'), expect.any(Error));

    cooldownThinker.stop();
    warnSpy.mockRestore();
  });

  it('parses thinking results and handles malformed JSON', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const parsed = (thinker as any).parseThinkingResult(JSON.stringify({
      significant: true,
      suggestions: [{ title: 'Raw', description: 'Desc', priority: 'low', type: 'plot' }],
      reasoning: 'Because',
    }));

    expect(parsed).toMatchObject({
      significant: true,
      rawThinking: 'Because',
    });
    expect(parsed.suggestions[0]).toMatchObject({
      title: 'Raw',
      description: 'Desc',
      priority: 'low',
      type: 'related_memory',
      tags: ['plot'],
      source: { id: 'proactive-thinker' },
      createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fallback = (thinker as any).parseThinkingResult('{oops');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse thinking result:'), expect.any(Error));
    expect(fallback).toEqual({ suggestions: [], significant: false });
    warnSpy.mockRestore();
  });

  it('clears debounce timers and supports start helper', () => {
    const dummyState = () => mockGetState();
    const started = startProactiveThinker(dummyState, mockProjectId, mockOnSuggestion);
    (started as any).debounceTimer = setTimeout(() => {}, 1000);

    (started as any).clearDebounceTimer();

    expect((started as any).debounceTimer).toBeNull();
    stopProactiveThinker();
  });

  it('formats events and handles missing project context', async () => {
    const eventsText = (thinker as any).formatEventsForPrompt([
      { type: 'TEXT_CHANGED', payload: { delta: 1 }, timestamp: 0 },
    ]);

    expect(eventsText).toContain('TEXT_CHANGED');

    const emptyEventsText = (thinker as any).formatEventsForPrompt([]);
    expect(emptyEventsText).toBe('No recent events.');

    const noProjectThinker = new ProactiveThinker();
    vi.mocked(searchBedsideHistory).mockResolvedValue([{ note: { text: 'Memory', createdAt: Date.now(), id: '1' }, similarity: 1 } as any]);
    const result = await (noProjectThinker as any).fetchLongTermMemoryContext(mockGetState());
    expect(result).toEqual({ text: '', matches: [] });
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

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Bedside evolve failed:'), expect.any(Error));

    warnSpy.mockRestore();
  });

  it('returns null when forcing think without setup or events', async () => {
    expect(await thinker.forceThink()).toBeNull();

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    expect(await thinker.forceThink()).toBeNull();
  });
});
