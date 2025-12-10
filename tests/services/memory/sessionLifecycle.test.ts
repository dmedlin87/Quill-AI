import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  handleSessionStart,
  handleSessionEnd,
  __resetSessionLifecycleState,
  __getSessionLifecycleDebounceMs,
} from '@/services/memory/sessionLifecycle';
import type { MemoryNote } from '@/services/memory/types';

const chainMocks = vi.hoisted(() => ({
  getOrCreateBedsideNote: vi.fn(),
  evolveBedsideNote: vi.fn(),
}));

const trackerMocks = vi.hoisted(() => ({
  getSessionState: vi.fn(),
}));

vi.mock('@/services/memory/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/memory/chains')>();
  return {
    ...actual,
    getOrCreateBedsideNote: (...args: any[]) => chainMocks.getOrCreateBedsideNote(...args),
    evolveBedsideNote: (...args: any[]) => chainMocks.evolveBedsideNote(...args),
  };
});

vi.mock('@/services/memory/sessionTracker', () => ({
  getSessionState: (...args: any[]) => trackerMocks.getSessionState(...args),
}));

describe('session lifecycle bedside note hooks', () => {
  const projectId = 'proj-session';

  const bedsideNote: MemoryNote = {
    id: 'bed-1',
    scope: 'project',
    projectId,
    type: 'plan',
    text: 'Existing bedside note plan.',
    topicTags: ['meta:bedside-note'],
    importance: 0.9,
    createdAt: Date.now() - 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    __resetSessionLifecycleState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the bedside note on session start and evolves it with a focus reminder', async () => {
    chainMocks.getOrCreateBedsideNote.mockResolvedValueOnce(bedsideNote);
    chainMocks.evolveBedsideNote.mockResolvedValueOnce({ ...bedsideNote, id: 'bed-2' });

    const result = await handleSessionStart(projectId, { previousFocus: 'Resolve the cliffhanger' });

    expect(chainMocks.getOrCreateBedsideNote).toHaveBeenCalledWith(projectId);
    expect(chainMocks.evolveBedsideNote).toHaveBeenCalledWith(
      projectId,
      expect.stringContaining('Session start — remember: Resolve the cliffhanger'),
      expect.objectContaining({ changeReason: 'session_start' }),
    );
    expect(result.briefing).toContain(bedsideNote.text);
    expect(result.evolvedNote?.id).toBe('bed-2');
  });

  it('does not evolve a bedside note when no meaningful focus remains', async () => {
    chainMocks.getOrCreateBedsideNote.mockResolvedValueOnce(bedsideNote);

    const result = await handleSessionStart(projectId, { previousFocus: '   ' });

    expect(chainMocks.evolveBedsideNote).not.toHaveBeenCalled();
    expect(result.evolvedNote).toBeUndefined();
  });

  it('summarizes session changes on end with session_boundary tagging', async () => {
    const summaryNote: MemoryNote = { ...bedsideNote, id: 'bed-3', text: 'Session boundary update' };
    trackerMocks.getSessionState.mockReturnValue({
      created: [{
        id: 'mem-1',
        scope: 'project',
        projectId,
        type: 'fact',
        text: 'Added a new clue about the ring',
        topicTags: [],
        importance: 0.5,
        createdAt: Date.now(),
      }],
      updated: [{ id: 'mem-2', changes: 'Clarified antagonist motivation' }],
      deleted: ['mem-3'],
      goalsCreated: ['goal-1'],
      startedAt: Date.now() - 5000,
    });
    chainMocks.evolveBedsideNote.mockResolvedValueOnce(summaryNote);

    const result = await handleSessionEnd(projectId);

    expect(chainMocks.evolveBedsideNote).toHaveBeenCalledWith(
      projectId,
      expect.stringContaining('Session ended — key changes:'),
      { changeReason: 'session_boundary' },
    );

    const [_, summaryText] = chainMocks.evolveBedsideNote.mock.calls[0];
    expect(summaryText).toContain('Created 1 note');
    expect(summaryText).toContain('Updated 1 note');
    expect(summaryText).toContain('Deleted 1 note');
    expect(summaryText).toContain('Goals created: goal-1');
    expect(result).toBe(summaryNote);
  });

  it('returns the bedside note when session end fires during the debounce window', async () => {
    const summaryNote: MemoryNote = { ...bedsideNote, id: 'bed-4', text: 'Session boundary update' };
    trackerMocks.getSessionState.mockReturnValue({
      created: [{
        id: 'mem-4',
        scope: 'project',
        projectId,
        type: 'fact',
        text: 'Tracked change',
        topicTags: [],
        importance: 0.5,
        createdAt: Date.now(),
      }],
      updated: [],
      deleted: [],
      goalsCreated: [],
      startedAt: Date.now() - 5000,
    });
    chainMocks.getOrCreateBedsideNote.mockResolvedValue(bedsideNote);
    chainMocks.evolveBedsideNote.mockResolvedValue(summaryNote);

    const debounceMs = __getSessionLifecycleDebounceMs();
    vi.useFakeTimers();
    vi.setSystemTime(debounceMs + 1000);

    await handleSessionEnd(projectId);

    vi.setSystemTime(debounceMs + 1100);
    const result = await handleSessionEnd(projectId);

    expect(chainMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);
    expect(chainMocks.getOrCreateBedsideNote).toHaveBeenCalledTimes(1);
    expect(result).toBe(bedsideNote);
  });

  it('falls back to the bedside note when there are no session changes to summarize', async () => {
    trackerMocks.getSessionState.mockReturnValue({
      created: [],
      updated: [],
      deleted: [],
      goalsCreated: [],
      startedAt: Date.now() - 1000,
    });
    chainMocks.getOrCreateBedsideNote.mockResolvedValue(bedsideNote);

    const result = await handleSessionEnd(projectId);

    expect(chainMocks.evolveBedsideNote).not.toHaveBeenCalled();
    expect(chainMocks.getOrCreateBedsideNote).toHaveBeenCalledWith(projectId);
    expect(result).toBe(bedsideNote);
  });

  it('debounces rapid reconnects to avoid duplicate bedside note evolutions', async () => {
    vi.useFakeTimers();
    const debounceMs = __getSessionLifecycleDebounceMs();

    chainMocks.getOrCreateBedsideNote.mockResolvedValue(bedsideNote);
    chainMocks.evolveBedsideNote.mockResolvedValue(bedsideNote);

    await handleSessionStart(projectId, { previousFocus: 'Keep pacing tight' });
    await handleSessionStart(projectId, { previousFocus: 'Keep pacing tight' });
    expect(chainMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(debounceMs + 10);
    await handleSessionStart(projectId, { previousFocus: 'Keep pacing tight' });
    expect(chainMocks.evolveBedsideNote).toHaveBeenCalledTimes(2);
  });
});
