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
});
