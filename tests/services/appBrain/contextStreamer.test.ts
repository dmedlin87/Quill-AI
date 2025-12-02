import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextStreamer } from '@/services/appBrain/contextStreamer';
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
});
