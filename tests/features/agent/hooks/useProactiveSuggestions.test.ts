import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import useProactiveSuggestions from '@/features/agent/hooks/useProactiveSuggestions';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  generate: vi.fn(),
  reminders: vi.fn(),
}));

vi.mock('@/services/appBrain', () => ({
  eventBus: {
    subscribe: mocks.subscribe,
  },
}));

vi.mock('@/services/memory/proactive', () => ({
  generateSuggestionsForChapter: (...args: any[]) => mocks.generate(...args),
  getImportantReminders: (...args: any[]) => mocks.reminders(...args),
}));

describe('useProactiveSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.subscribe.mockReturnValue(() => {});
    mocks.generate.mockResolvedValue([
      { id: '1', title: 'first', source: { id: 'a' } as any },
      { id: '2', title: 'second', source: { id: 'b' } as any },
    ]);
    mocks.reminders.mockResolvedValue([{ id: 'r1', title: 'reminder', source: { id: 'r' } as any }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('ignores suggestions when disabled', async () => {
    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', enabled: false })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    expect(result.current.suggestions).toEqual([]);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('adds suggestions and auto-dismisses after timeout', async () => {
    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', autoDismissMs: 10 })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    expect(result.current.suggestions).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(15);
    });

    expect(result.current.suggestions).toHaveLength(0);
  });

  it('returns reminders and cleans up on project change', async () => {
    const { result, rerender } = renderHook(
      ({ projectId }) => useProactiveSuggestions({ projectId }),
      { initialProps: { projectId: 'p1' } }
    );

    await act(async () => {
      const reminders = await result.current.getReminders();
      expect(reminders).toHaveLength(1);
    });

    rerender({ projectId: 'p2' });

    expect(result.current.suggestions).toEqual([]);
  });

  it('handles getReminders errors gracefully', async () => {
    mocks.reminders.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1' })
    );

    await act(async () => {
      const reminders = await result.current.getReminders();
      expect(reminders).toEqual([]);
    });
  });

  it('handles checkForSuggestions errors gracefully', async () => {
    mocks.generate.mockRejectedValueOnce(new Error('Generation failed'));

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1' })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    // Should not crash, suggestions should be empty
    expect(result.current.suggestions).toEqual([]);
  });

  it('responds to CHAPTER_SWITCHED events', async () => {
    let eventCallback: ((event: any) => void) | null = null;
    mocks.subscribe.mockImplementation((eventType: string, callback: any) => {
      if (eventType === 'CHAPTER_SWITCHED') {
        eventCallback = callback;
      }
      return () => {};
    });

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1' })
    );

    // Simulate chapter switch event
    if (eventCallback) {
      await act(async () => {
        await eventCallback!({
          type: 'CHAPTER_SWITCHED',
          payload: { chapterId: 'ch-2', title: 'Chapter 2' },
          timestamp: Date.now(),
        });
      });
    }

    expect(mocks.generate).toHaveBeenCalledWith('p1', {
      chapterId: 'ch-2',
      chapterTitle: 'Chapter 2',
      content: undefined,
    });
  });

  it('returns empty reminders when no projectId', async () => {
    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: null })
    );

    await act(async () => {
      const reminders = await result.current.getReminders();
      expect(reminders).toEqual([]);
    });

    expect(mocks.reminders).not.toHaveBeenCalled();
  });

  it('dismissAll clears all suggestions and timers', async () => {
    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', autoDismissMs: 10000 })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    expect(result.current.suggestions).toHaveLength(2);

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.suggestions).toEqual([]);
  });
});
