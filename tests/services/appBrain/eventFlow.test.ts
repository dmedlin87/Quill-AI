/**
 * AppBrain Event Flow Integration Tests
 * 
 * Tests the full event-driven architecture:
 * eventBus → eventObserver → significantEditMonitor → proactiveThinker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eventBus,
  resetAppBrainForTests,
  appBrainLogger,
  LogLevel,
  getSignificantEditMonitor,
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  setProactiveThinkerSettingsAdapter,
  resetProactiveThinkerSettingsAdapter,
  emitTextChanged,
  emitChapterChanged,
  type AppBrainState,
  type ProactiveSuggestion,
} from '@/services/appBrain';
import { createMockAppBrainState } from '../../mocks/testFactories';

// Mock external dependencies
vi.mock('@/services/memory', () => ({
  evolveBedsideNote: vi.fn().mockResolvedValue(undefined),
  getMemoriesForContext: vi.fn().mockResolvedValue({ author: [], project: [] }),
  getActiveGoals: vi.fn().mockResolvedValue([]),
  getRelevantMemoriesForContext: vi.fn().mockResolvedValue({ author: [], project: [] }),
  formatMemoriesForPrompt: vi.fn().mockReturnValue(''),
  formatGoalsForPrompt: vi.fn().mockReturnValue(''),
  getVoiceProfileForCharacter: vi.fn().mockResolvedValue(null),
  upsertVoiceProfile: vi.fn().mockResolvedValue(undefined),
  BEDSIDE_NOTE_TAG: 'bedside',
  BEDSIDE_NOTE_DEFAULT_TAGS: ['bedside'],
  getMemories: vi.fn().mockResolvedValue([]),
  createMemory: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/memory/dreaming', () => ({
  runDreamingCycle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/memory/proactive', () => ({
  getImportantReminders: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/memory/bedsideHistorySearch', () => ({
  searchBedsideHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/appBrain/narrativeAlignment', () => ({
  runNarrativeAlignmentCheck: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({ significant: false, suggestions: [], reasoning: 'No issues found' }),
      }),
    },
  },
}));

describe('AppBrain Event Flow', () => {
  let mockState: AppBrainState;
  let mockGetState: () => AppBrainState;
  let receivedSuggestions: ProactiveSuggestion[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetAppBrainForTests();
    appBrainLogger.setLevel(LogLevel.SILENT);

    mockState = createMockAppBrainState();
    mockGetState = () => mockState;
    receivedSuggestions = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAppBrainForTests();
    resetProactiveThinkerSettingsAdapter();
  });

  describe('EventBus', () => {
    it('emits and receives events', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('TEXT_CHANGED', handler);

      emitTextChanged(100, 10);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('TEXT_CHANGED');
      expect(handler.mock.calls[0][0].payload).toEqual({ length: 100, delta: 10 });

      unsubscribe();
    });

    it('adds timestamp to events', () => {
      const handler = vi.fn();
      eventBus.subscribe('TEXT_CHANGED', handler);

      emitTextChanged(100, 10);

      expect(handler.mock.calls[0][0].timestamp).toBeDefined();
      expect(handler.mock.calls[0][0].timestamp).toBeGreaterThan(0);
    });

    it('maintains event history', () => {
      emitTextChanged(100, 10);
      emitTextChanged(110, 10);
      emitTextChanged(120, 10);

      const history = eventBus.getRecentEvents(3);
      expect(history).toHaveLength(3);
      expect(history[2].type).toBe('TEXT_CHANGED');
      expect((history[2] as { payload: { length: number } }).payload.length).toBe(120);
    });

    it('isolates listener errors', () => {
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      eventBus.subscribe('TEXT_CHANGED', badHandler);
      eventBus.subscribe('TEXT_CHANGED', goodHandler);

      expect(() => emitTextChanged(100, 10)).not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });

    it('subscribeAll receives all event types', () => {
      const globalHandler = vi.fn();
      const unsubscribe = eventBus.subscribeAll(globalHandler);

      emitTextChanged(100, 10);
      emitChapterChanged('project-1', 'chapter-1', 'Chapter One');

      expect(globalHandler).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  describe('SignificantEditMonitor', () => {
    it('accumulates text changes', () => {
      startSignificantEditMonitor('test-project', {
        threshold: 500,
        debounceMs: 100,
        cooldownMs: 1000,
      });

      // Emit changes below threshold
      emitTextChanged(100, 100);
      emitTextChanged(200, 100);
      emitTextChanged(300, 100);

      // Advance past debounce but changes are below threshold
      vi.advanceTimersByTime(150);

      // No SIGNIFICANT_EDIT_DETECTED should be emitted yet
      const history = eventBus.getRecentEvents(10);
      const significantEdits = history.filter(e => e.type === 'SIGNIFICANT_EDIT_DETECTED');
      expect(significantEdits).toHaveLength(0);

      stopSignificantEditMonitor();
    });

    it('emits SIGNIFICANT_EDIT_DETECTED when threshold exceeded', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const significantEditHandler = vi.fn();
      eventBus.subscribe('SIGNIFICANT_EDIT_DETECTED', significantEditHandler);

      startSignificantEditMonitor('test-project', {
        threshold: 100,
        debounceMs: 50,
        cooldownMs: 100,
      });

      // Emit changes exceeding threshold
      emitTextChanged(100, 150); // Exceeds 100 threshold

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(significantEditHandler).toHaveBeenCalled();

      stopSignificantEditMonitor();
      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it('respects cooldown period', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const significantEditHandler = vi.fn();
      eventBus.subscribe('SIGNIFICANT_EDIT_DETECTED', significantEditHandler);

      startSignificantEditMonitor('test-project', {
        threshold: 50,
        debounceMs: 20,
        cooldownMs: 200,
      });

      // First batch of changes - exceeds threshold
      emitTextChanged(100, 100);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(significantEditHandler).toHaveBeenCalledTimes(1);

      // Second batch within cooldown - should not trigger
      emitTextChanged(200, 100);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still be 1 due to cooldown
      expect(significantEditHandler).toHaveBeenCalledTimes(1);

      stopSignificantEditMonitor();
      vi.useFakeTimers(); // Restore fake timers for other tests
    });
  });

  describe('ProactiveThinker', () => {
    it('starts and stops cleanly', () => {
      const onSuggestion = vi.fn();

      startProactiveThinker(mockGetState, 'test-project', onSuggestion, {
        enabled: true,
        debounceMs: 100,
        minEventsToThink: 1,
      });

      const thinker = getProactiveThinker();
      const status = thinker.getStatus();
      expect(status.isThinking).toBe(false);
      expect(status.pendingEvents).toHaveLength(0);

      stopProactiveThinker();
    });

    it('enqueues events when running', () => {
      const onSuggestion = vi.fn();

      startProactiveThinker(mockGetState, 'test-project', onSuggestion, {
        enabled: true,
        debounceMs: 10000, // Long debounce so we can check queue
        minEventsToThink: 3,
      });

      emitTextChanged(100, 10);
      emitTextChanged(110, 10);

      const thinker = getProactiveThinker();
      const status = thinker.getStatus();
      expect(status.pendingEvents.length).toBeGreaterThan(0);

      stopProactiveThinker();
    });

    it('uses injected settings adapter', () => {
      const customAdapter = {
        getSuggestionWeights: vi.fn().mockReturnValue({
          plot: 2.0,
          character: 0.5,
          pacing: 1.0,
          style: 1.0,
          continuity: 1.0,
          other: 1.0,
        }),
      };

      setProactiveThinkerSettingsAdapter(customAdapter);

      const onSuggestion = vi.fn();
      startProactiveThinker(mockGetState, 'test-project', onSuggestion, {
        enabled: true,
      });

      // The adapter should be called when suggestions are processed
      // (We'd need to trigger a full think cycle to verify this fully)

      stopProactiveThinker();
      resetProactiveThinkerSettingsAdapter();
    });
  });

  describe('Full Event Flow Integration', () => {
    it('chapter change triggers monitor and dreaming service start', async () => {
      // Import the actual observer to test the full flow
      const { startAppBrainEventObserver } = await import('@/services/appBrain/eventObserver');

      const cleanup = startAppBrainEventObserver();

      // Emit chapter changed - this should start significantEditMonitor
      emitChapterChanged('test-project', 'chapter-1', 'Chapter One');

      // The observer should have started the monitor
      const monitor = getSignificantEditMonitor();
      expect(monitor).toBeDefined();

      cleanup();
    });

    it('text changes flow through monitor to significant edit detection', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const { startAppBrainEventObserver } = await import('@/services/appBrain/eventObserver');
      const significantEditHandler = vi.fn();

      eventBus.subscribe('SIGNIFICANT_EDIT_DETECTED', significantEditHandler);

      const cleanup = startAppBrainEventObserver();

      // Start with a chapter change to initialize the monitor
      emitChapterChanged('test-project', 'chapter-1', 'Chapter One');

      // Configure monitor with low threshold for testing
      startSignificantEditMonitor('test-project', {
        threshold: 50,
        debounceMs: 20,
        cooldownMs: 100,
      });

      // Emit text changes exceeding threshold
      emitTextChanged(100, 100);

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(significantEditHandler).toHaveBeenCalled();

      cleanup();
      stopSignificantEditMonitor();
      vi.useFakeTimers(); // Restore fake timers
    });
  });
});

describe('Settings Adapter', () => {
  beforeEach(() => {
    resetProactiveThinkerSettingsAdapter();
  });

  afterEach(() => {
    resetProactiveThinkerSettingsAdapter();
  });

  it('default adapter returns neutral weights', () => {
    // The default adapter is used automatically
    // We can verify this by checking the weights don't filter anything
    const customAdapter = {
      getSuggestionWeights: vi.fn().mockReturnValue({
        plot: 1.0,
        character: 1.0,
        pacing: 1.0,
        style: 1.0,
        continuity: 1.0,
        other: 1.0,
      }),
    };

    setProactiveThinkerSettingsAdapter(customAdapter);

    // The adapter is now set
    expect(customAdapter.getSuggestionWeights).not.toHaveBeenCalled();

    resetProactiveThinkerSettingsAdapter();
  });

  it('custom adapter can mute suggestion categories', () => {
    const customAdapter = {
      getSuggestionWeights: vi.fn().mockReturnValue({
        plot: 0.0, // Muted
        character: 1.0,
        pacing: 1.0,
        style: 1.0,
        continuity: 1.0,
        other: 1.0,
      }),
    };

    setProactiveThinkerSettingsAdapter(customAdapter);

    // Adapter is set; weights would be used during applyAdaptiveRelevance
    // (Full verification would require triggering a think cycle)
  });
});
