import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useManuscriptIntelligence } from '@/features/shared/hooks/useManuscriptIntelligence';

const mocks = vi.hoisted(() => ({
  processInstant: vi.fn(),
  processDebounced: vi.fn(),
  processManuscript: vi.fn(() => ({ hud: { situational: {} }, structural: {}, timeline: [] })),
  updateHUD: vi.fn(() => ({ situational: {} })),
  generateAIContext: vi.fn(() => 'ctx'),
}));

vi.mock('@/services/intelligence', () => ({
  processInstant: mocks.processInstant,
  processDebounced: mocks.processDebounced,
  processManuscript: mocks.processManuscript,
  updateHUDForCursor: mocks.updateHUD,
  generateAIContext: mocks.generateAIContext,
  createEmptyIntelligence: (id: string) => ({ hud: { situational: {} }, structural: {}, timeline: [], chapterId: id }),
  ChangeHistory: class { push(change: any) { return change; } },
}));

describe('useManuscriptIntelligence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('runs instant and debounced processing on text updates', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' }),
    );

    act(() => {
      result.current.updateText('Hello world', 5);
    });

    expect(mocks.processInstant).toHaveBeenCalled();
    vi.runAllTimers();
    expect(mocks.processDebounced).toHaveBeenCalled();
  });

  it('returns AI context using generated data', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' }),
    );

    const context = result.current.getAIContext();
    expect(mocks.generateAIContext).toHaveBeenCalled();
    expect(context).toBe('ctx');
  });
});
