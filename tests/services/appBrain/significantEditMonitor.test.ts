import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { emitTextChanged } from '@/services/appBrain';
import { eventBus } from '@/services/appBrain/eventBus';
import {
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
} from '@/services/appBrain/significantEditMonitor';

const memoryMocks = vi.hoisted(() => ({
  evolveBedsideNote: vi.fn(),
}));

vi.mock('@/services/memory', () => ({
  evolveBedsideNote: (...args: any[]) => memoryMocks.evolveBedsideNote(...args),
}));

describe('significantEditMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    memoryMocks.evolveBedsideNote.mockReset();
    (eventBus as any).clearHistory?.();
    (eventBus as any).clearPersistentLog?.();
  });

  afterEach(() => {
    stopSignificantEditMonitor();
    vi.useRealTimers();
  });

  it('aggregates rapid edits and triggers bedside-note update when threshold exceeded', async () => {
    startSignificantEditMonitor('project-1', { threshold: 500, debounceMs: 500 });

    emitTextChanged(1000, 200);
    emitTextChanged(1200, 200);
    emitTextChanged(1400, 200);

    expect(memoryMocks.evolveBedsideNote).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);
    expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledWith(
      'project-1',
      'Major edit detected — review continuity.',
      { changeReason: 'significant_edit' },
    );
  });

  it('does not trigger when cumulative delta stays below threshold', async () => {
    startSignificantEditMonitor('project-2', { threshold: 500, debounceMs: 500 });

    emitTextChanged(800, 100);
    emitTextChanged(900, 150);
    emitTextChanged(950, 200);

    await vi.advanceTimersByTimeAsync(500);

    expect(memoryMocks.evolveBedsideNote).not.toHaveBeenCalled();
  });

  it('handles a single large edit after debounce window', async () => {
    startSignificantEditMonitor('project-3', { threshold: 500, debounceMs: 300 });

    emitTextChanged(1500, 600);

    await vi.advanceTimersByTimeAsync(300);

    expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);
    expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledWith(
      'project-3',
      'Major edit detected — review continuity.',
      { changeReason: 'significant_edit' },
    );
  });
});
