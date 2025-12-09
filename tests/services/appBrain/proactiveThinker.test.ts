import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProactiveThinker, resetProactiveThinker } from '../../../services/appBrain/proactiveThinker';
import { ai } from '../../../services/gemini/client';
import { eventBus } from '../../../services/appBrain/eventBus';
import { evolveBedsideNote, upsertVoiceProfile, getVoiceProfileForCharacter } from '../../../services/memory';
import { getImportantReminders } from '../../../services/memory/proactive';
import { searchBedsideHistory } from '../../../services/memory/bedsideHistorySearch';
import { extractTemporalMarkers } from '../../../services/intelligence/timelineTracker';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import { useSettingsStore } from '../../../features/settings/store/useSettingsStore';

// Mocks
vi.mock('../../../services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('../../../services/appBrain/eventBus', () => ({
  eventBus: {
    subscribeAll: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock('../../../services/memory', () => ({
  evolveBedsideNote: vi.fn(),
  getVoiceProfileForCharacter: vi.fn(),
  upsertVoiceProfile: vi.fn(),
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

// Use actual store or mock? Since it uses `useSettingsStore.getState()`, better mock it.
vi.mock('../../../features/settings/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

describe('ProactiveThinker', () => {
  let thinker: ProactiveThinker;
  let mockGetState: any;
  let mockOnSuggestion: any;
  const mockProjectId = 'test-project';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetProactiveThinker();

    thinker = new ProactiveThinker({
      debounceMs: 100,
      minEventsToThink: 2,
    });

    mockGetState = vi.fn().mockReturnValue({
      manuscript: {
        projectId: mockProjectId,
        activeChapterId: 'ch1',
        currentText: 'Some text',
      },
      intelligence: {
        full: { entities: { nodes: [] } },
        timeline: { events: [] },
      },
      lore: { characters: [] },
    });

    mockOnSuggestion = vi.fn();

    // Default mocks
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      suggestionWeights: { plot: 1, character: 1, pacing: 1 },
    } as any);

    vi.mocked(getImportantReminders).mockResolvedValue([]);
    vi.mocked(searchBedsideHistory).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch events and think after debounce', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);

    // Simulate events
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    subscribeCallback({ type: 'TEXT_CHANGED', payload: {}, timestamp: Date.now() });
    subscribeCallback({ type: 'TEXT_CHANGED', payload: {}, timestamp: Date.now() });

    // Mock AI response
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      text: JSON.stringify({ significant: true, suggestions: [] }),
    } as any);

    // Fast forward debounce
    await vi.advanceTimersByTimeAsync(200);

    expect(ai.models.generateContent).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'PROACTIVE_THINKING_COMPLETED',
    }));
  });

  it('should handle urgent events immediately', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    vi.mocked(ai.models.generateContent).mockResolvedValue({
      text: '{}',
    } as any);

    // Urgent event
    subscribeCallback({ type: 'ANALYSIS_COMPLETED', payload: {}, timestamp: Date.now() });

    await vi.advanceTimersByTimeAsync(200);
    expect(ai.models.generateContent).toHaveBeenCalled();
  });

  it('should detect voice drift', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    mockGetState.mockReturnValue({
      manuscript: { currentText: '"Hello there," said Bob.' },
      intelligence: { entities: { nodes: [{ type: 'character', name: 'Bob' }] } },
      lore: { characters: [] },
    });

    vi.mocked(generateVoiceProfile).mockReturnValue({
      metrics: { avgSentenceLength: 10 } as any,
      impression: 'Calm',
    });

    vi.mocked(getVoiceProfileForCharacter).mockResolvedValue({
      metrics: { avgSentenceLength: 20 } as any, // Significant difference
      impression: 'Frantic',
      projectId: mockProjectId,
      characterName: 'Bob',
      samples: [],
      lastUpdated: 0,
    });

    // Send significant edit event
    subscribeCallback({
      type: 'SIGNIFICANT_EDIT_DETECTED',
      payload: { delta: 100 },
      timestamp: Date.now()
    });

    await vi.runAllTicks(); // Process async promises

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      type: 'voice_inconsistency',
      metadata: expect.objectContaining({ speaker: 'Bob' }),
    }));
  });

  it('should detect timeline conflicts', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    mockGetState.mockReturnValue({
      manuscript: { activeChapterId: 'ch1', currentText: 'It was Tuesday.' },
      intelligence: {
        timeline: {
          events: [{
            chapterId: 'ch1',
            temporalMarker: 'It was Monday',
            normalized: 'Monday',
            offset: 0
          }]
        }
      },
    });

    vi.mocked(extractTemporalMarkers)
      .mockReturnValueOnce([{ marker: 'Tuesday', normalized: 'Tuesday', category: 'day_of_week', sentence: '', index: 0 }]) // New text
      .mockReturnValueOnce([{ marker: 'Monday', normalized: 'Monday', category: 'day_of_week', sentence: '', index: 0 }]); // Old text (called inside loop)

    // Send significant edit event
    subscribeCallback({
      type: 'SIGNIFICANT_EDIT_DETECTED',
      payload: {},
      timestamp: Date.now()
    });

    await vi.runAllTicks();

    expect(mockOnSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      type: 'timeline_conflict',
    }));
  });

  it('should handle chapter transitions by evolving bedside notes', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    subscribeCallback({
      type: 'CHAPTER_CHANGED',
      payload: {
        projectId: mockProjectId,
        chapterId: 'ch2',
        title: 'Chapter 2',
        issues: [{ description: 'Slow start' }]
      },
      timestamp: Date.now()
    });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      mockProjectId,
      expect.stringContaining('Now in chapter: "Chapter 2"'),
      expect.objectContaining({ changeReason: 'chapter_transition' })
    );
  });

  it('should evolve bedside notes on significant edits', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    mockGetState.mockReturnValue({
      manuscript: { activeChapterId: 'ch1', chapters: [{ id: 'ch1', title: 'Ch1' }] },
    });

    // Accumulate delta
    subscribeCallback({ type: 'TEXT_CHANGED', payload: { delta: 600 }, timestamp: Date.now() });

    expect(evolveBedsideNote).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Significant edits detected'),
      expect.objectContaining({ changeReason: 'significant_edit' })
    );
  });

  it('should respect adaptive relevance weights', async () => {
    thinker.start(mockGetState, mockProjectId, mockOnSuggestion);
    const subscribeCallback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];

    // Mock settings to mute 'character' suggestions
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      suggestionWeights: { character: 0.01, plot: 1 },
    } as any);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
      text: JSON.stringify({
        suggestions: [{ type: 'character', title: 'Ignored', priority: 'high' }],
      }),
    } as any);

    subscribeCallback({ type: 'TEXT_CHANGED', payload: {}, timestamp: Date.now() });
    subscribeCallback({ type: 'TEXT_CHANGED', payload: {}, timestamp: Date.now() });

    await vi.advanceTimersByTimeAsync(200);

    // Should NOT call onSuggestion because it was muted
    expect(mockOnSuggestion).not.toHaveBeenCalled();
  });
});
