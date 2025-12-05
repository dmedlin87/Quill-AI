import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eventBus,
  disableEventPersistence,
  enableEventPersistence,
  emitSelectionChanged,
  emitCursorMoved,
  emitChapterSwitched,
  emitTextChanged,
  emitEditMade,
  emitAnalysisCompleted,
  emitToolExecuted,
  emitNavigationRequested,
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
});

// Helper to avoid linter noise inside tests
const emitPanelSwitch = () => {
  eventBus.emit({ type: 'PANEL_SWITCHED', payload: { panel: 'chat' }, timestamp: Date.now() });
};
