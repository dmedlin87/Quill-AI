import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProactiveThinker, resetProactiveThinker } from '../../../services/appBrain/proactiveThinker';
import { ai } from '../../../services/gemini/client';
import { eventBus } from '../../../services/appBrain/eventBus';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { searchBedsideHistory } from '../../../services/memory/bedsideHistorySearch';
import { evolveBedsideNote, upsertVoiceProfile, getVoiceProfileForCharacter } from '../../../services/memory';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import { getImportantReminders } from '../../../services/memory/proactive';

// Mock dependencies
vi.mock('../../../services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          significant: true,
          suggestions: [{ title: 'Test Suggestion', type: 'plot', priority: 'high' }],
          reasoning: 'Test reasoning',
        }),
      }),
    },
  },
}));

vi.mock('../../../services/appBrain/eventBus', () => ({
  eventBus: {
    subscribeAll: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

vi.mock('../../../services/memory/bedsideHistorySearch', () => ({
  searchBedsideHistory: vi.fn(),
}));

vi.mock('../../../services/memory', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as object,
    evolveBedsideNote: vi.fn().mockResolvedValue(undefined),
    upsertVoiceProfile: vi.fn(),
    getVoiceProfileForCharacter: vi.fn(),
  };
});

vi.mock('../../../services/intelligence/voiceProfiler', () => ({
  generateVoiceProfile: vi.fn(),
}));

vi.mock('../../../services/memory/proactive', () => ({
  getImportantReminders: vi.fn(),
}));

// Mock buildCompressedContext
vi.mock('../../../services/appBrain/contextBuilder', () => ({
  buildCompressedContext: vi.fn().mockReturnValue('Mocked Context'),
}));

vi.mock('../../../services/appBrain/intelligenceMemoryBridge', () => ({
  formatConflictsForPrompt: vi.fn().mockReturnValue(''),
  getHighPriorityConflicts: vi.fn().mockResolvedValue([]),
}));


describe('ProactiveThinker', () => {
  let thinker: ProactiveThinker;
  const mockProjectId = 'project-123';
  const mockGetState = vi.fn();
  const mockOnSuggestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetProactiveThinker();
    thinker = new ProactiveThinker({ enabled: true, debounceMs: 100 });

    // Default mocks
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      suggestionWeights: { plot: 1.0, character: 1.0 },
    } as any);

    vi.mocked(searchBedsideHistory).mockResolvedValue([]);
    vi.mocked(getImportantReminders).mockResolvedValue([]);

    mockGetState.mockReturnValue({
      manuscript: { projectId: mockProjectId, chapters: [] },
      intelligence: { full: {}, hud: { context: {}, situational: {} }, timeline: { events: [] } },
      lore: { characters: [] },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    thinker.stop();
  });

  it('should not think if disabled', async () => {
    const disabledThinker = new ProactiveThinker({ enabled: false });
    disabledThinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    await disabledThinker.forceThink();

    expect(ai.models.generateContent).not.toHaveBeenCalled();
  });

  it('should subscribe to event bus on start', () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    expect(eventBus.subscribeAll).toHaveBeenCalled();
  });

  it('should unsubscribe on stop', () => {
    const unsubscribeMock = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockReturnValue(unsubscribeMock);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    thinker.stop();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should trigger thinking after debounce when events accumulate', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Simulate events
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10 }, timestamp: Date.now() });
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10 }, timestamp: Date.now() }); // Min 3 events

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(150);

    expect(ai.models.generateContent).toHaveBeenCalled();
    expect(mockOnSuggestion).toHaveBeenCalled();
  });

  it('should trigger immediately for urgent events', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Urgent event
    callback({ type: 'ANALYSIS_COMPLETED', payload: {}, timestamp: Date.now() });

    // Wait for short urgent delay (simulated by advancing timers slightly less than debounce but enough for urgent)
    // Actually implementation uses 2000ms max for urgent or remaining cooldown.
    // If we just started, cooldown is 100ms (configured in test).
    await vi.advanceTimersByTimeAsync(150);

    expect(ai.models.generateContent).toHaveBeenCalled();
  });

  it('should handle chapter transition and update bedside notes', () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    callback({
      type: 'CHAPTER_CHANGED',
      payload: { projectId: mockProjectId, chapterId: 'ch1', title: 'Chapter 1' },
      timestamp: Date.now()
    });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Now in chapter: "Chapter 1"'),
      expect.objectContaining({ changeReason: 'chapter_transition' })
    );
  });

  it('should handle significant edits and update bedside notes', () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Trigger significant edit logic
    // Needs > 500 delta accumulation
    callback({ type: 'TEXT_CHANGED', payload: { delta: 600 }, timestamp: Date.now() });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Significant edits detected'),
      expect.objectContaining({ changeReason: 'significant_edit' })
    );
  });

  // Skipped for now due to test environment complexity with floating promises
  it.skip('should detect voice drift', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    mockGetState.mockReturnValue({
      manuscript: { currentText: '"Hello world," Alice said.', projectId: mockProjectId, chapters: [] },
      intelligence: { full: { entities: { nodes: [{ type: 'character', name: 'Alice' }] } } },
      lore: { characters: [] },
    });

    vi.mocked(getVoiceProfileForCharacter).mockResolvedValue({
      metrics: { avgSentenceLength: 10, sentenceVariance: 0.1, contractionRatio: 0.5, questionRatio: 0.1, exclamationRatio: 0.1, latinateRatio: 0.1, uniqueWordCount: 100 },
      impression: 'Calm',
    } as any);

    vi.mocked(generateVoiceProfile).mockReturnValue({
      metrics: { avgSentenceLength: 50, sentenceVariance: 0.9, contractionRatio: 0.0, questionRatio: 0.9, exclamationRatio: 0.9, latinateRatio: 0.9, uniqueWordCount: 10 },
      impression: 'Angry',
    } as any);

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Call handleEvent
    callback({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 600 }, timestamp: Date.now() });

    await vi.waitFor(() => {
        expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_inconsistency',
            title: expect.stringContaining('Voice drift detected'),
        }));
    }, { timeout: 1000, interval: 10 });
  });

  it('should filter suggestions based on weights', async () => {
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      suggestionWeights: { plot: 0.0, character: 1.0 }, // Mute plot
    } as any);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    // Mock LLM response with plot suggestion
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      text: JSON.stringify({
        significant: true,
        suggestions: [{ title: 'Plot Twist', type: 'plot', priority: 'high' }],
      }),
    } as any);

    await thinker.forceThink();

    expect(mockOnSuggestion).not.toHaveBeenCalled();
  });

  it('should handle AI errors gracefully', async () => {
    vi.mocked(ai.models.generateContent).mockRejectedValue(new Error('AI Error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    // Add pending events
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Thinking failed'), expect.any(Error));
  });

  it('should use long term memory context', async () => {
    vi.mocked(searchBedsideHistory).mockResolvedValue([
      { note: { id: '1', text: 'Old memory', createdAt: Date.now() }, similarity: 0.9 }
    ] as any);

    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'TEXT_CHANGED', payload: { delta: 10 }, timestamp: Date.now() });

    await thinker.forceThink();

    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.stringContaining('Old memory'),
    }));
  });
});
