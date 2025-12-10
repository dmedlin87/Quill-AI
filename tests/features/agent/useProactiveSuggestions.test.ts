import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import useProactiveSuggestions from '@/features/agent/hooks/useProactiveSuggestions';
import type { ProactiveSuggestion } from '@/services/memory/proactive';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  startThinker: vi.fn(),
  stopThinker: vi.fn(),
  generate: vi.fn<
    [],
    Parameters<typeof import('@/services/memory/proactive').generateSuggestionsForChapter>
  >(),
  markLoreDismissed: vi.fn(),
}));

vi.mock('@/services/appBrain', () => ({
  eventBus: { subscribe: mocks.subscribe },
  startProactiveThinker: mocks.startThinker,
  stopProactiveThinker: mocks.stopThinker,
  getProactiveThinker: () => ({ forceThink: vi.fn() }),
}));

vi.mock('@/services/memory/proactive', () => ({
  generateSuggestionsForChapter: (...args: any[]) => mocks.generate(...args),
  getImportantReminders: vi.fn(),
}));

vi.mock('@/services/memory/relevance', () => ({
  markLoreEntityDismissed: (...args: any[]) => mocks.markLoreDismissed(...args),
}));

vi.mock('@/services/memory', () => ({
  createMemory: vi.fn(),
  evolveBedsideNote: vi.fn(),
}));

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: { getState: () => ({ openLoreDraft: vi.fn() }) },
}));

function buildSuggestion(
  id: string,
  sourceId: string,
  overrides: Partial<ProactiveSuggestion> = {}
): ProactiveSuggestion {
  return {
    id,
    type: 'related_memory',
    priority: 'medium',
    title: `Suggestion ${id}`,
    description: 'description',
    source: { type: 'memory', id: sourceId, name: `Source ${sourceId}` },
    tags: [],
    createdAt: Date.now(),
    ...overrides,
  } as ProactiveSuggestion;
}

describe('useProactiveSuggestions (timers & merging)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.subscribe.mockReturnValue(() => {});
    mocks.generate.mockReset();
    mocks.markLoreDismissed.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('dismissSuggestion clears timers and records lore dismissals', async () => {
    const loreSuggestion = buildSuggestion('l1', 'source-1', {
      type: 'lore_discovery',
      metadata: { entityName: 'Ancient Tree' },
    });

    mocks.generate.mockResolvedValue([loreSuggestion]);

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', autoDismissMs: 1000 })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      result.current.dismissSuggestion('l1');
    });

    expect(result.current.suggestions).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.markLoreDismissed).toHaveBeenCalledWith('Ancient Tree');
  });

  it('auto-dismisses suggestions after the configured timeout', async () => {
    const suggestion = buildSuggestion('s1', 'source-1');
    mocks.generate.mockResolvedValue([suggestion]);

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', autoDismissMs: 50 })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
    });

    expect(result.current.suggestions).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.suggestions).toHaveLength(0);
  });

  it('merges unique suggestions by source id and respects maxSuggestions', async () => {
    mocks.generate
      .mockResolvedValueOnce([
        buildSuggestion('s1', 'source-1'),
        buildSuggestion('s2', 'source-2'),
      ])
      .mockResolvedValueOnce([
        buildSuggestion('s3', 'source-1'),
        buildSuggestion('s4', 'source-3'),
        buildSuggestion('s5', 'source-4'),
      ]);

    const { result } = renderHook(() =>
      useProactiveSuggestions({ projectId: 'p1', maxSuggestions: 3, autoDismissMs: 0 })
    );

    await act(async () => {
      await result.current.checkForSuggestions('c1', 'Chapter 1');
      await result.current.checkForSuggestions('c2', 'Chapter 2');
    });

    expect(result.current.suggestions).toHaveLength(3);
    expect(result.current.suggestions.map(s => s.source.id)).toEqual([
      'source-1',
      'source-2',
      'source-3',
    ]);
  });
});
