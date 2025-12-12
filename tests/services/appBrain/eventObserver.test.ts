import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus, emitChapterChanged, startAppBrainEventObserver, emitTextChanged } from '@/services/appBrain';
import { evolveBedsideNote } from '@/services/memory';
import { eventObserverLogger } from '@/services/appBrain/logger';
import { startSignificantEditMonitor, getSignificantEditMonitor } from '@/services/appBrain/significantEditMonitor';
import { startDreamingService, stopDreamingService } from '@/services/appBrain/dreamingService';

vi.mock('@/services/memory', () => ({
  evolveBedsideNote: vi.fn(),
}));

vi.mock('@/services/appBrain/logger', () => ({
  eventObserverLogger: { warn: vi.fn() },
}));

vi.mock('@/services/appBrain/significantEditMonitor', () => ({
  startSignificantEditMonitor: vi.fn(),
  getSignificantEditMonitor: vi.fn(() => ({ handleTextChanged: vi.fn() })),
}));

vi.mock('@/services/appBrain/dreamingService', () => ({
  startDreamingService: vi.fn(),
  stopDreamingService: vi.fn(),
}));

describe('AppBrain event observer', () => {
  let stopObserver: (() => void) | null = null;

  beforeEach(() => {
    (eventBus as any).clearHistory();
    (eventBus as any).clearPersistentLog();
    vi.clearAllMocks();
    stopObserver = startAppBrainEventObserver();
  });

  afterEach(() => {
    stopObserver?.();
    stopObserver = null;
  });

  it('evolves bedside note with chapter reminders when issues or watched entities exist', async () => {
    emitChapterChanged('proj-1', 'chap-2', 'Rising Action', {
      issues: [{ description: 'Resolve the cliffhanger from Chapter 1', severity: 'warning' }],
      watchedEntities: [{ name: 'Ava', reason: 'Her arc is fragile', priority: 'high' }],
    });

    await vi.waitFor(() => expect(vi.mocked(evolveBedsideNote)).toHaveBeenCalledTimes(1));

    const [projectId, noteText, options] = vi.mocked(evolveBedsideNote).mock.calls[0];
    expect(projectId).toBe('proj-1');
    expect(noteText).toContain('Now in Chapter Rising Action');
    expect(noteText).toContain('Resolve the cliffhanger');
    expect(noteText).toContain('Ava');
    expect(options?.changeReason).toBe('chapter_transition');
  });

  it('ignores chapter changes that lack meaningful reminders', async () => {
    emitChapterChanged('proj-1', 'chap-1', 'Quiet Setup', {});

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(vi.mocked(evolveBedsideNote)).not.toHaveBeenCalled();
  });

  it('handles formatting edge cases and filters invalid items', async () => {
    emitChapterChanged('proj-1', 'chap-3', 'Edge Case', {
      issues: [
        { description: 'Plain issue missing severity' }, 
        { description: '' } as any 
      ],
      watchedEntities: [
        { name: 'Bob', reason: '' },
        { name: '' } as any
      ],
    });

    await vi.waitFor(() => expect(vi.mocked(evolveBedsideNote)).toHaveBeenCalledTimes(1));

    const [, noteText] = vi.mocked(evolveBedsideNote).mock.calls[0];
    expect(noteText).toContain('- Plain issue missing severity');
    expect(noteText).not.toContain('undefined');
    expect(noteText).toContain('- Bob');
    const lines = noteText.split('\n');
    expect(lines.filter(l => l.trim().startsWith('-')).length).toBe(2);
  });

  it('limits reminders to 5 items', async () => {
    const issues = Array.from({ length: 6 }, (_, i) => ({ description: `Issue ${i}`, severity: 'info' } as const));
    emitChapterChanged('proj-1', 'chap-4', 'Limit Test', { issues });

    await vi.waitFor(() => expect(vi.mocked(evolveBedsideNote)).toHaveBeenCalledTimes(1));

    const [, noteText] = vi.mocked(evolveBedsideNote).mock.calls[0];
    expect(noteText).toContain('Issue 4');
    expect(noteText).not.toContain('Issue 5');
  });

  it('logs warning when bedside note evolution fails', async () => {
    const error = new Error('API Error');
    vi.mocked(evolveBedsideNote).mockRejectedValueOnce(error);

    emitChapterChanged('proj-1', 'chap-5', 'Error Test', {
      issues: [{ description: 'Test' }]
    });

    await vi.waitFor(() => expect(eventObserverLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to evolve'),
      expect.objectContaining({ error })
    ));
  });

  it('manages service lifecycle on events', async () => {
    emitChapterChanged('proj-1', 'chap-6', 'Lifecycle', {});
    expect(startSignificantEditMonitor).toHaveBeenCalledWith('proj-1');
    expect(startDreamingService).toHaveBeenCalled();

    const mockMonitor = { handleTextChanged: vi.fn() };
    vi.mocked(getSignificantEditMonitor).mockReturnValue(mockMonitor as any);
    
    emitTextChanged(100, 5); // length, delta
    expect(getSignificantEditMonitor).toHaveBeenCalled();
    expect(mockMonitor.handleTextChanged).toHaveBeenCalled();
    
    /* Stop observer handling is tested implicitly via afterEach calling stopObserver */
  });
});
