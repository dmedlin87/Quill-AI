import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eventBus,
  disableEventPersistence,
  enableEventPersistence,
  emitSelectionChanged,
  emitCursorMoved,
  emitChapterSwitched,
  emitIdleStatusChanged,
  emitSignificantEditDetected,
  emitDreamingStateChanged,
  emitTextChanged,
  emitEditMade,
  emitAnalysisCompleted,
  emitToolExecuted,
  emitNavigationRequested,
  emitZenModeToggled,
  emitProactiveThinkingStarted,
  emitProactiveThinkingCompleted,
} from '@/services/appBrain';

describe('eventBus', () => {
  beforeEach(() => {
    disableEventPersistence();
    (eventBus as any).dispose?.();
  });

  afterEach(() => {
    (eventBus as any).dispose?.();
    enableEventPersistence();
  });

  beforeEach(() => {
    // Clear history between tests
    (eventBus as any).clearHistory();
    (eventBus as any).clearPersistentLog();
  });

  it('notifies type-specific and global subscribers', () => {
    const typeHandler = vi.fn();
    const globalHandler = vi.fn();

    const unsubscribeType = eventBus.subscribe('CURSOR_MOVED', typeHandler);
    const unsubscribeGlobal = eventBus.subscribeAll(globalHandler);

    emitCursorMoved(10, 'action');

    expect(typeHandler).toHaveBeenCalledTimes(1);
    expect(globalHandler).toHaveBeenCalledTimes(1);

    unsubscribeType();
    unsubscribeGlobal();
  });

  it('keeps a bounded history and returns recent events', () => {
    for (let i = 0; i < 15; i++) {
      emitTextChanged(100 + i, 1);
    }

    const recent = eventBus.getRecentEvents(10);
    expect(recent).toHaveLength(10);
    expect(recent[0].type).toBe('TEXT_CHANGED');
  });

  it('filters events by type', () => {
    emitCursorMoved(1, null);
    emitTextChanged(50, 5);
    emitCursorMoved(2, 'dialogue');

    const cursorEvents = eventBus.getEventsByType('CURSOR_MOVED', 5);

    expect(cursorEvents).toHaveLength(2);
    expect(cursorEvents.every(e => e.type === 'CURSOR_MOVED')).toBe(true);
  });

  it('formats recent events for AI context', () => {
    emitSelectionChanged('Some long selected text', 0, 20);
    emitChapterSwitched('c1', 'Opening');
    emitEditMade('user', 'Fixed typo');
    emitToolExecuted('navigate_to_text', true);
    emitNavigationRequested('Chapter 2', 123);

    const formatted = eventBus.formatRecentEventsForAI(5);

    expect(formatted).toContain('[RECENT USER ACTIVITY]');
    expect(formatted).toContain('Selected:');
    expect(formatted).toContain('Switched to "Opening"');
    expect(formatted).toContain('Edit by user: Fixed typo');
    expect(formatted).toContain('Tool "navigate_to_text" succeeded');
    expect(formatted).toContain('Navigation to: Chapter 2');
  });

  it('returns empty string when there are no events', () => {
    const formatted = eventBus.formatRecentEventsForAI(5);
    expect(formatted).toBe('');
  });

  it('stores events in the persistent change log for audits', () => {
    enableEventPersistence();
    emitTextChanged(20, 5);
    emitAnalysisCompleted('chapter-1', 'success');

    const log = eventBus.getChangeLog(5);
    expect(log.some(evt => evt.type === 'TEXT_CHANGED')).toBe(true);
    expect(log.some(evt => evt.type === 'ANALYSIS_COMPLETED')).toBe(true);
  });

  it('replays logged events to orchestrator subscribers', () => {
    enableEventPersistence();
    emitPanelSwitch();
    disableEventPersistence();
    const handler = vi.fn();

    const unsubscribe = eventBus.subscribeForOrchestrator(handler, {
      types: ['PANEL_SWITCHED'],
      replay: true,
    });

    // subscribeForOrchestrator replays synchronously
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('formats panel and zen mode events correctly', () => {
    // Panel switched event
    eventBus.emit({
      type: 'PANEL_SWITCHED',
      payload: { panel: 'outline' },
      timestamp: Date.now(),
    });

    let formatted = eventBus.formatRecentEventsForAI(1);
    expect(formatted).toContain('Panel switched to outline');

    // Zen mode toggled event via convenience emitter
    (eventBus as any).clearHistory();
    emitZenModeToggled(true as any);

    formatted = eventBus.formatRecentEventsForAI(1);
    expect(formatted).toContain('Zen mode enabled');
  });

  it('formats unknown events with a generic label', () => {
    (eventBus as any).clearHistory();

    eventBus.emit({
      type: 'SOME_UNKNOWN_EVENT' as any,
      payload: {} as any,
      timestamp: Date.now(),
    });

    const formatted = eventBus.formatRecentEventsForAI(1);
    expect(formatted).toContain('Unknown event');
  });

  it('disposes listeners and clears state', () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe('TEXT_CHANGED', handler);
    emitTextChanged(1, 1);
    expect(handler).toHaveBeenCalledTimes(1);

    eventBus.dispose();
    expect(eventBus.getRecentEvents().length).toBe(0);
    unsubscribe();
  });

  it('does not persist when persistence disabled', () => {
    const setItem = vi.spyOn(window.localStorage ?? ({} as any), 'setItem' as any).mockImplementation(() => {});
    emitTextChanged(5, 1);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('catches and logs errors from type-specific listeners', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingHandler = vi.fn(() => {
      throw new Error('Handler failed');
    });

    const unsubscribe = eventBus.subscribe('TEXT_CHANGED', failingHandler);
    emitTextChanged(10, 1);

    expect(failingHandler).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Listener error'),
      expect.any(Error)
    );

    unsubscribe();
    errorSpy.mockRestore();
  });

  it('catches and logs errors from global listeners', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingGlobal = vi.fn(() => {
      throw new Error('Global handler failed');
    });

    const unsubscribe = eventBus.subscribeAll(failingGlobal);
    emitCursorMoved(5, null);

    expect(failingGlobal).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Global listener error'),
      expect.any(Error)
    );

    unsubscribe();
    errorSpy.mockRestore();
  });

  it('handles localStorage errors gracefully on persist', () => {
    enableEventPersistence();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });

    emitTextChanged(1, 1);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EventBus] Failed to persist'),
      expect.any(Error)
    );

    setItem.mockRestore();
    warnSpy.mockRestore();
  });

  it('handles malformed JSON in localStorage gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('not valid json');

    enableEventPersistence();
    // The loadChangeLog is called at module init, but we can verify
    // the change log still works even with bad data
    const log = eventBus.getChangeLog(5);
    expect(Array.isArray(log)).toBe(true);

    getItem.mockRestore();
    warnSpy.mockRestore();
  });
});

// Helper to avoid linter noise inside tests
const emitPanelSwitch = () => {
  eventBus.emit({ type: 'PANEL_SWITCHED', payload: { panel: 'chat' }, timestamp: Date.now() });
};

describe('eventBus branch coverage', () => {
  beforeEach(() => {
    disableEventPersistence();
    (eventBus as any).dispose?.();
    (eventBus as any).clearHistory();
    (eventBus as any).clearPersistentLog();
  });

  afterEach(() => {
    (eventBus as any).dispose?.();
    enableEventPersistence();
  });

  describe('formatEvent branches', () => {
    it('formats COMMENT_ADDED event', () => {
      eventBus.emit({
        type: 'COMMENT_ADDED',
        payload: { comment: { issue: 'This is a very long issue description that exceeds thirty characters' } as any },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Comment added:');
      expect(formatted).toContain('...');
    });

    it('formats INTELLIGENCE_UPDATED event', () => {
      eventBus.emit({
        type: 'INTELLIGENCE_UPDATED',
        payload: { tier: 'full' },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Intelligence updated (full)');
    });

    it('formats TEXT_CHANGED with negative delta (removed)', () => {
      eventBus.emit({
        type: 'TEXT_CHANGED',
        payload: { length: 50, delta: -10 },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Text removed');
      expect(formatted).toContain('10 chars');
    });

    it('formats TEXT_CHANGED with positive delta (added)', () => {
      eventBus.emit({
        type: 'TEXT_CHANGED',
        payload: { length: 60, delta: 10 },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Text added');
      expect(formatted).toContain('10 chars');
    });

    it('formats ANALYSIS_COMPLETED with error status', () => {
      eventBus.emit({
        type: 'ANALYSIS_COMPLETED',
        payload: { section: 'chapter-1', status: 'error', detail: 'Parse failed' },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Analysis failed');
      expect(formatted).toContain('Parse failed');
    });

    it('formats ANALYSIS_COMPLETED without detail', () => {
      eventBus.emit({
        type: 'ANALYSIS_COMPLETED',
        payload: { section: 'chapter-2', status: 'success' },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Analysis complete');
      expect(formatted).toContain('chapter-2');
    });

    it('formats CURSOR_MOVED without scene', () => {
      emitCursorMoved(100, null);

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Cursor at position 100');
      expect(formatted).not.toContain('scene');
    });

    it('formats CURSOR_MOVED with scene', () => {
      emitCursorMoved(200, 'dialogue');

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Cursor at position 200');
      expect(formatted).toContain('(dialogue scene)');
    });

    it('formats SELECTION_CHANGED with short text', () => {
      emitSelectionChanged('Short text', 0, 10);

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Selected: "Short text"');
      expect(formatted).not.toContain('...');
    });

    it('formats SELECTION_CHANGED with long text (truncated)', () => {
      const longText = 'This is a very long selected text that exceeds thirty characters';
      emitSelectionChanged(longText, 0, longText.length);

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Selected:');
      expect(formatted).toContain('...');
    });

    it('formats CHAPTER_CHANGED event', () => {
      eventBus.emit({
        type: 'CHAPTER_CHANGED',
        payload: { projectId: 'p1', chapterId: 'c1', title: 'My Chapter' },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Moved to chapter "My Chapter"');
    });

    it('formats TOOL_EXECUTED with failure', () => {
      emitToolExecuted('apply_edit', false);

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Tool "apply_edit" failed');
    });

    it('formats ZEN_MODE_TOGGLED disabled', () => {
      emitZenModeToggled(false as any);

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('Zen mode disabled');
    });

    it('formats PROACTIVE_THINKING_STARTED with pending events and context hint', () => {
      const longContext = 'A'.repeat(50);
      eventBus.emit({
        type: 'PROACTIVE_THINKING_STARTED',
        payload: {
          trigger: 'auto',
          pendingEvents: [
            { type: 'TEXT_CHANGED', payload: { length: 5, delta: 1 } } as any,
          ],
          contextPreview: longContext,
        },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('AI thinking started (trigger: auto');
      expect(formatted).toContain(', events: 1');
      expect(formatted).toContain('context: ' + 'A'.repeat(40));
      expect(formatted).toContain('...');
    });

    it('formats PROACTIVE_THINKING_COMPLETED with suggestions', () => {
      eventBus.emit({
        type: 'PROACTIVE_THINKING_COMPLETED',
        payload: {
          suggestionsCount: 2,
          thinkingTime: 120,
        },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('AI thinking complete (2 suggestions in 120ms)');
    });

    it('formats PROACTIVE_THINKING_COMPLETED with no suggestions', () => {
      eventBus.emit({
        type: 'PROACTIVE_THINKING_COMPLETED',
        payload: {
          suggestionsCount: 0,
          thinkingTime: 200,
        },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('AI thinking complete (no suggestions in 200ms)');
    });

    it('formats PROACTIVE_THINKING_STARTED without pending events or context', () => {
      eventBus.emit({
        type: 'PROACTIVE_THINKING_STARTED',
        payload: { trigger: 'manual' },
      });

      const formatted = eventBus.formatRecentEventsForAI(1);
      expect(formatted).toContain('AI thinking started (trigger: manual');
      expect(formatted).not.toContain(', events:');
      expect(formatted).not.toContain('context:');
    });
  });

  describe('convenience emitters', () => {
    it('emits idle status changes via helper', () => {
      emitIdleStatusChanged(false);
      const [event] = eventBus.getRecentEvents(1);
      expect(event.type).toBe('IDLE_STATUS_CHANGED');
      expect(event.payload.idle).toBe(false);
    });

    it('emits dreaming state changes via helper', () => {
      emitDreamingStateChanged(true);
      const [event] = eventBus.getRecentEvents(1);
      expect(event.type).toBe('DREAMING_STATE_CHANGED');
      expect(event.payload.active).toBe(true);
    });

    it('emits significant edit detection events via helper', () => {
      emitSignificantEditDetected(42, 'chapter-1');
      const [event] = eventBus.getRecentEvents(1);
      expect(event.type).toBe('SIGNIFICANT_EDIT_DETECTED');
      expect(event.payload.delta).toBe(42);
      expect(event.payload.chapterId).toBe('chapter-1');
    });

    it('emits proactive thinking started via helper', () => {
      emitProactiveThinkingStarted({ trigger: 'scheduler', contextPreview: 'scene' });
      const [event] = eventBus.getRecentEvents(1);
      expect(event.type).toBe('PROACTIVE_THINKING_STARTED');
      expect(event.payload.trigger).toBe('scheduler');
    });

    it('emits proactive thinking completed via helper', () => {
      emitProactiveThinkingCompleted({
        suggestionsCount: 1,
        thinkingTime: 99,
        rawThinking: 'plan',
      });
      const [event] = eventBus.getRecentEvents(1);
      expect(event.type).toBe('PROACTIVE_THINKING_COMPLETED');
      expect(event.payload.rawThinking).toBe('plan');
    });
  });

  describe('subscribeForOrchestrator branches', () => {
    it('replays all events when types not specified', () => {
      enableEventPersistence();
      emitTextChanged(10, 1);
      emitCursorMoved(5, null);
      disableEventPersistence();

      const handler = vi.fn();
      const unsubscribe = eventBus.subscribeForOrchestrator(handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it('filters events by types when specified', () => {
      enableEventPersistence();
      emitTextChanged(10, 1);
      emitCursorMoved(5, null);
      disableEventPersistence();

      const handler = vi.fn();
      const unsubscribe = eventBus.subscribeForOrchestrator(handler, {
        types: ['CURSOR_MOVED'],
        replay: true,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('does not replay when replay is false', () => {
      enableEventPersistence();
      emitTextChanged(10, 1);
      disableEventPersistence();

      const handler = vi.fn();
      const unsubscribe = eventBus.subscribeForOrchestrator(handler, { replay: false });

      expect(handler).not.toHaveBeenCalled();

      // But should receive new events
      emitCursorMoved(20, null);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });

  describe('persistence edge cases', () => {
    it('loads empty array when localStorage returns null', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      enableEventPersistence();

      const log = eventBus.getChangeLog();
      expect(Array.isArray(log)).toBe(true);

      getItem.mockRestore();
    });

    it('handles non-array JSON gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');

      enableEventPersistence();
      const log = eventBus.getChangeLog();
      expect(Array.isArray(log)).toBe(true);

      getItem.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('history bounds', () => {
    it('trims history when exceeding MAX_HISTORY', () => {
      for (let i = 0; i < 150; i++) {
        emitCursorMoved(i, null);
      }

      const history = eventBus.getRecentEvents(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('trims change log when exceeding MAX_CHANGE_LOG', () => {
      enableEventPersistence();
      for (let i = 0; i < 550; i++) {
        emitCursorMoved(i, null);
      }

      const log = eventBus.getChangeLog(1000);
      expect(log.length).toBeLessThanOrEqual(500);
    });
  });

  describe('convenience emitters', () => {
    it('publishes all helper events in order', () => {
      emitIdleStatusChanged(true);
      emitDreamingStateChanged(false);
      emitSignificantEditDetected(42, 'chapter-1');
      emitProactiveThinkingStarted({ trigger: 'auto' });
      emitProactiveThinkingCompleted({ suggestionsCount: 1, thinkingTime: 90 });

      const recent = eventBus.getRecentEvents(5);
      expect(recent.map(evt => evt.type)).toEqual([
        'IDLE_STATUS_CHANGED',
        'DREAMING_STATE_CHANGED',
        'SIGNIFICANT_EDIT_DETECTED',
        'PROACTIVE_THINKING_STARTED',
        'PROACTIVE_THINKING_COMPLETED',
      ]);
      expect(recent[2].payload.delta).toBe(42);
      expect(recent[3].payload.trigger).toBe('auto');
      expect(recent[4].payload.thinkingTime).toBe(90);
    });
  });
});
