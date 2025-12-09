import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ContextStreamer,
  getContextStreamer,
  resetContextStreamer,
  createStreamingSession,
  hasSignificantContextChange,
} from '@/services/appBrain/contextStreamer';
import { eventBus } from '@/services/appBrain/eventBus';

const { mockSubscribe, mockEmit } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    subscribe: mockSubscribe,
    emit: mockEmit,
  },
}));

describe('ContextStreamer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSubscribe.mockReset();
    mockEmit.mockReset();
    resetContextStreamer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues patches for configured events and flushes oldest when full', () => {
    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    const streamer = new ContextStreamer({ maxQueueSize: 1 });
    streamer.start();

    const baseEvent = { type: 'SELECTION_CHANGED', payload: { text: 'abc' }, timestamp: Date.now() } as any;
    listeners.SELECTION_CHANGED(baseEvent);
    listeners.SELECTION_CHANGED({ ...baseEvent, timestamp: Date.now() + 1 });

    const patches = streamer.drainPatches();
    expect(patches).toHaveLength(1);
    expect(patches[0].summary).toContain('User selected');
  });

  it('ignores events below minimum importance', () => {
    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    const streamer = new ContextStreamer({ minImportance: 'high', eventTypes: ['DOCUMENT_SAVED'] as any });
    streamer.start();

    listeners.DOCUMENT_SAVED({ type: 'DOCUMENT_SAVED', payload: {}, timestamp: Date.now() } as any);

    expect(streamer.drainPatches()).toHaveLength(0);
  });

  it('ignores events that occurred before startTimestamp', () => {
    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    vi.setSystemTime(1_000);
    const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
    streamer.start();

    const earlyEvent = {
      type: 'SELECTION_CHANGED',
      payload: { text: 'before' },
      timestamp: 999,
    } as any;
    listeners.SELECTION_CHANGED(earlyEvent);
    expect(streamer.hasPendingPatches()).toBe(false);

    const onTimeEvent = {
      ...earlyEvent,
      timestamp: 1_000,
      payload: { text: 'after' },
    } as any;
    listeners.SELECTION_CHANGED(onTimeEvent);
    expect(streamer.hasPendingPatches()).toBe(true);
  });

  it('stops, clears queue, and unsubscribes listeners', () => {
    const listeners: Record<string, (event: any) => void> = {};
    const unsub = vi.fn();
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return unsub;
    });

    const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
    streamer.start();

    const event = {
      type: 'SELECTION_CHANGED',
      payload: { text: 'abc' },
      timestamp: Date.now(),
    } as any;
    listeners.SELECTION_CHANGED(event);
    expect(streamer.hasPendingPatches()).toBe(true);

    streamer.stop();
    expect(unsub).toHaveBeenCalled();
    expect(streamer.hasPendingPatches()).toBe(false);
    expect(streamer.getNextPatch()).toBeNull();
  });

  it('formats patches for prompts and reports extra events', () => {
    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED', 'CHAPTER_SWITCHED'] as any, maxQueueSize: 5 });
    streamer.start();

    const base = { timestamp: Date.now() };
    listeners.SELECTION_CHANGED({ type: 'SELECTION_CHANGED', payload: { text: 'hello' }, ...base } as any);
    listeners.CHAPTER_SWITCHED({ type: 'CHAPTER_SWITCHED', payload: { title: 'Ch 1' }, ...base } as any);

    const formatted = streamer.formatPatchesForPrompt(1) as string;
    expect(formatted).toContain('[CONTEXT UPDATE - Events since your last message]');
    // With maxPatches = 1 only the first patch summary is emitted, plus the
    // trailing "more events" line when additional patches are queued.
    expect(formatted).toMatch(/User selected/);
    expect(formatted).toContain('more events');

    const highs = streamer.getHighImportancePatches();
    expect(highs.some(p => p.type === 'CHAPTER_SWITCHED')).toBe(true);
  });

  it('supports singleton helpers and significant change detection', () => {
    const first = getContextStreamer({ maxQueueSize: 2 });
    const second = getContextStreamer();
    expect(second).toBe(first);

    resetContextStreamer();
    const third = getContextStreamer();
    expect(third).not.toBe(first);

    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    const streamer = new ContextStreamer({ eventTypes: ['CHAPTER_SWITCHED'] as any });
    streamer.start();

    const event = {
      type: 'CHAPTER_SWITCHED',
      payload: { title: 'Ch 2' },
      timestamp: Date.now(),
    } as any;
    listeners.CHAPTER_SWITCHED(event);
    expect(hasSignificantContextChange(streamer)).toBe(true);
  });

  it('creates streaming sessions that expose updates and flags pending patches', () => {
    const listeners: Record<string, (event: any) => void> = {};
    mockSubscribe.mockImplementation((type: string, cb: any) => {
      listeners[type] = cb;
      return () => {};
    });

    const session = createStreamingSession({ eventTypes: ['SELECTION_CHANGED'] as any });
    session.start();
    expect(session.hasUpdates()).toBe(false);

    const event = {
      type: 'SELECTION_CHANGED',
      payload: { text: 'session text' },
      timestamp: Date.now(),
    } as any;
    listeners.SELECTION_CHANGED(event);

    expect(session.hasUpdates()).toBe(true);
    const updates = session.getUpdates() as string;
    expect(updates).toContain('User selected');

    session.stop();
  });

  describe('summarizeEvent - all event types', () => {
    let listeners: Record<string, (event: any) => void> = {};

    beforeEach(() => {
      listeners = {};
      mockSubscribe.mockImplementation((type: string, cb: any) => {
        listeners[type] = cb;
        return () => {};
      });
    });

    it('summarizes SELECTION_CHANGED with text', () => {
      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'Hello world selected text' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toContain('User selected: "Hello world selected text"');
    });

    it('summarizes SELECTION_CHANGED with long text (truncated)', () => {
      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      const longText = 'A'.repeat(100);
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: longText },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toContain('...');
      expect(patches[0].summary.length).toBeLessThan(100);
    });

    it('summarizes SELECTION_CHANGED without text as cleared', () => {
      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { start: 0, end: 0 },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Selection cleared');
    });

    it('summarizes CURSOR_MOVED with position and scene', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CURSOR_MOVED'] as any });
      streamer.start();
      listeners.CURSOR_MOVED({
        type: 'CURSOR_MOVED',
        payload: { position: 150, scene: 'dialogue' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Cursor moved to position 150 (dialogue scene)');
    });

    it('summarizes CURSOR_MOVED without scene', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CURSOR_MOVED'] as any });
      streamer.start();
      listeners.CURSOR_MOVED({
        type: 'CURSOR_MOVED',
        payload: { position: 50 },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Cursor moved to position 50');
    });

    it('summarizes CHAPTER_SWITCHED with title', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CHAPTER_SWITCHED'] as any });
      streamer.start();
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { chapterId: 'c1', title: 'Opening' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Switched to chapter: "Opening"');
    });

    it('summarizes CHAPTER_CHANGED with chapterId fallback', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CHAPTER_CHANGED'] as any });
      streamer.start();
      listeners.CHAPTER_CHANGED({
        type: 'CHAPTER_CHANGED',
        payload: { chapterId: 'chapter-123' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Switched to chapter: "chapter-123"');
    });

    it('summarizes BRANCH_SWITCHED with name', () => {
      const streamer = new ContextStreamer({ eventTypes: ['BRANCH_SWITCHED'] as any });
      streamer.start();
      listeners.BRANCH_SWITCHED({
        type: 'BRANCH_SWITCHED',
        payload: { branchId: 'b1', name: 'Alternative Ending' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Switched to branch: "Alternative Ending"');
    });

    it('summarizes BRANCH_SWITCHED with branchId fallback', () => {
      const streamer = new ContextStreamer({ eventTypes: ['BRANCH_SWITCHED'] as any });
      streamer.start();
      listeners.BRANCH_SWITCHED({
        type: 'BRANCH_SWITCHED',
        payload: { branchId: 'branch-456' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Switched to branch: "branch-456"');
    });

    it('summarizes ANALYSIS_COMPLETE', () => {
      const streamer = new ContextStreamer({ eventTypes: ['ANALYSIS_COMPLETE'] as any });
      streamer.start();
      listeners.ANALYSIS_COMPLETE({
        type: 'ANALYSIS_COMPLETE',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Analysis completed - new insights available');
    });

    it('summarizes MEMORY_CREATED with text', () => {
      const streamer = new ContextStreamer({ eventTypes: ['MEMORY_CREATED'] as any });
      streamer.start();
      listeners.MEMORY_CREATED({
        type: 'MEMORY_CREATED',
        payload: { text: 'John is the protagonist of the story' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toContain('New memory:');
      expect(patches[0].summary).toContain('John is the protagonist');
    });

    it('summarizes PANEL_SWITCHED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['PANEL_SWITCHED'] as any });
      streamer.start();
      listeners.PANEL_SWITCHED({
        type: 'PANEL_SWITCHED',
        payload: { panel: 'analysis' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Switched to analysis panel');
    });

    it('summarizes LORE_UPDATED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['LORE_UPDATED'] as any });
      streamer.start();
      listeners.LORE_UPDATED({
        type: 'LORE_UPDATED',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Lore Bible was updated');
    });

    it('summarizes ZEN_MODE_TOGGLED enabled', () => {
      const streamer = new ContextStreamer({ eventTypes: ['ZEN_MODE_TOGGLED'] as any });
      streamer.start();
      listeners.ZEN_MODE_TOGGLED({
        type: 'ZEN_MODE_TOGGLED',
        payload: { enabled: true },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Zen mode enabled');
    });

    it('summarizes ZEN_MODE_TOGGLED disabled', () => {
      const streamer = new ContextStreamer({ eventTypes: ['ZEN_MODE_TOGGLED'] as any });
      streamer.start();
      listeners.ZEN_MODE_TOGGLED({
        type: 'ZEN_MODE_TOGGLED',
        payload: { enabled: false },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Zen mode disabled');
    });

    it('summarizes DOCUMENT_SAVED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['DOCUMENT_SAVED'] as any });
      streamer.start();
      listeners.DOCUMENT_SAVED({
        type: 'DOCUMENT_SAVED',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Document saved');
    });

    it('summarizes unknown event type with fallback', () => {
      const streamer = new ContextStreamer({ eventTypes: ['UNKNOWN_EVENT'] as any });
      streamer.start();
      listeners.UNKNOWN_EVENT({
        type: 'UNKNOWN_EVENT',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].summary).toBe('Event: UNKNOWN_EVENT');
    });
  });

  describe('importance calculation', () => {
    let listeners: Record<string, (event: any) => void> = {};

    beforeEach(() => {
      listeners = {};
      mockSubscribe.mockImplementation((type: string, cb: any) => {
        listeners[type] = cb;
        return () => {};
      });
    });

    it('assigns high importance to CHAPTER_SWITCHED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CHAPTER_SWITCHED'] as any });
      streamer.start();
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Ch1' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('high');
    });

    it('assigns high importance to ANALYSIS_COMPLETE', () => {
      const streamer = new ContextStreamer({ eventTypes: ['ANALYSIS_COMPLETE'] as any });
      streamer.start();
      listeners.ANALYSIS_COMPLETE({
        type: 'ANALYSIS_COMPLETE',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('high');
    });

    it('assigns high importance to MEMORY_CREATED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['MEMORY_CREATED'] as any });
      streamer.start();
      listeners.MEMORY_CREATED({
        type: 'MEMORY_CREATED',
        payload: { text: 'Memory' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('high');
    });

    it('assigns medium importance to SELECTION_CHANGED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'selected' },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('medium');
    });

    it('assigns medium importance to CURSOR_MOVED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['CURSOR_MOVED'] as any });
      streamer.start();
      listeners.CURSOR_MOVED({
        type: 'CURSOR_MOVED',
        payload: { position: 10 },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('medium');
    });

    it('assigns medium importance to LORE_UPDATED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['LORE_UPDATED'] as any });
      streamer.start();
      listeners.LORE_UPDATED({
        type: 'LORE_UPDATED',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('medium');
    });

    it('assigns low importance to DOCUMENT_SAVED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['DOCUMENT_SAVED'] as any });
      streamer.start();
      listeners.DOCUMENT_SAVED({
        type: 'DOCUMENT_SAVED',
        payload: {},
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('low');
    });

    it('assigns low importance to ZEN_MODE_TOGGLED', () => {
      const streamer = new ContextStreamer({ eventTypes: ['ZEN_MODE_TOGGLED'] as any });
      streamer.start();
      listeners.ZEN_MODE_TOGGLED({
        type: 'ZEN_MODE_TOGGLED',
        payload: { enabled: true },
        timestamp: Date.now(),
      } as any);
      const patches = streamer.drainPatches();
      expect(patches[0].importance).toBe('low');
    });
  });

  describe('queue management', () => {
    let listeners: Record<string, (event: any) => void> = {};

    beforeEach(() => {
      listeners = {};
      mockSubscribe.mockImplementation((type: string, cb: any) => {
        listeners[type] = cb;
        return () => {};
      });
    });

    it('getNextPatch returns patches in FIFO order', () => {
      const streamer = new ContextStreamer({
        eventTypes: ['SELECTION_CHANGED'] as any,
        maxQueueSize: 5,
      });
      streamer.start();

      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'first' },
        timestamp: Date.now(),
      } as any);
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'second' },
        timestamp: Date.now() + 1,
      } as any);

      const first = streamer.getNextPatch();
      const second = streamer.getNextPatch();
      const third = streamer.getNextPatch();

      expect(first?.summary).toContain('first');
      expect(second?.summary).toContain('second');
      expect(third).toBeNull();
    });

    it('getPendingCount returns correct count', () => {
      const streamer = new ContextStreamer({
        eventTypes: ['SELECTION_CHANGED'] as any,
        maxQueueSize: 10,
      });
      streamer.start();

      expect(streamer.getPendingCount()).toBe(0);

      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'one' },
        timestamp: Date.now(),
      } as any);
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'two' },
        timestamp: Date.now() + 1,
      } as any);

      expect(streamer.getPendingCount()).toBe(2);
    });

    it('removes low importance patches first when queue overflows', () => {
      const streamer = new ContextStreamer({
        eventTypes: ['DOCUMENT_SAVED', 'CHAPTER_SWITCHED'] as any,
        maxQueueSize: 2,
      });
      streamer.start();

      // Add low importance event first
      listeners.DOCUMENT_SAVED({
        type: 'DOCUMENT_SAVED',
        payload: {},
        timestamp: Date.now(),
      } as any);

      // Add high importance event
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Ch1' },
        timestamp: Date.now() + 1,
      } as any);

      // Add another high importance event - should remove low importance
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Ch2' },
        timestamp: Date.now() + 2,
      } as any);

      const patches = streamer.drainPatches();
      expect(patches).toHaveLength(2);
      // Low importance DOCUMENT_SAVED should be removed
      expect(patches.every(p => p.type === 'CHAPTER_SWITCHED')).toBe(true);
    });

    it('removes oldest when no low importance patches to remove', () => {
      const streamer = new ContextStreamer({
        eventTypes: ['CHAPTER_SWITCHED'] as any,
        maxQueueSize: 2,
      });
      streamer.start();

      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'First' },
        timestamp: Date.now(),
      } as any);
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Second' },
        timestamp: Date.now() + 1,
      } as any);
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Third' },
        timestamp: Date.now() + 2,
      } as any);

      const patches = streamer.drainPatches();
      expect(patches).toHaveLength(2);
      expect(patches[0].summary).toContain('Second');
      expect(patches[1].summary).toContain('Third');
    });
  });

  describe('formatPatchesForPrompt', () => {
    let listeners: Record<string, (event: any) => void> = {};

    beforeEach(() => {
      listeners = {};
      mockSubscribe.mockImplementation((type: string, cb: any) => {
        listeners[type] = cb;
        return () => {};
      });
    });

    it('returns null when no patches exist', () => {
      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      expect(streamer.formatPatchesForPrompt()).toBeNull();
    });

    it('formats with correct icons based on importance', () => {
      const streamer = new ContextStreamer({
        eventTypes: ['DOCUMENT_SAVED', 'SELECTION_CHANGED', 'CHAPTER_SWITCHED'] as any,
        maxQueueSize: 10,
      });
      streamer.start();

      // Low importance
      listeners.DOCUMENT_SAVED({
        type: 'DOCUMENT_SAVED',
        payload: {},
        timestamp: Date.now(),
      } as any);

      // Medium importance
      listeners.SELECTION_CHANGED({
        type: 'SELECTION_CHANGED',
        payload: { text: 'text' },
        timestamp: Date.now() + 1,
      } as any);

      // High importance
      listeners.CHAPTER_SWITCHED({
        type: 'CHAPTER_SWITCHED',
        payload: { title: 'Ch1' },
        timestamp: Date.now() + 2,
      } as any);

      const formatted = streamer.formatPatchesForPrompt(10) as string;
      expect(formatted).toContain('•'); // low importance icon
      expect(formatted).toContain('📌'); // medium importance icon
      expect(formatted).toContain('⚡'); // high importance icon
    });
  });

  describe('start/stop behavior', () => {
    it('does not double-subscribe when start is called multiple times', () => {
      const listeners: Record<string, (event: any) => void> = {};
      mockSubscribe.mockImplementation((type: string, cb: any) => {
        listeners[type] = cb;
        return () => {};
      });

      const streamer = new ContextStreamer({ eventTypes: ['SELECTION_CHANGED'] as any });
      streamer.start();
      streamer.start(); // Second call should be ignored

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
