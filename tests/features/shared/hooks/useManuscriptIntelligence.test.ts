import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useManuscriptIntelligence } from '@/features/shared/hooks/useManuscriptIntelligence';

const mockProcessInstant = vi.fn();
const mockProcessDebounced = vi.fn();
const mockProcessManuscript = vi.fn(() => ({ hud: { situational: {} }, structural: {}, timeline: [] }));
const mockUpdateHUD = vi.fn(() => ({ situational: {} }));
const mockGenerateAIContext = vi.fn(() => 'ctx');

vi.mock('@/services/intelligence', () => ({
  processInstant: (...args: any[]) => mockProcessInstant(...args),
  processDebounced: (...args: any[]) => mockProcessDebounced(...args),
  processManuscript: (...args: any[]) => mockProcessManuscript(...args),
  updateHUDForCursor: (...args: any[]) => mockUpdateHUD(...args),
  generateAIContext: (...args: any[]) => mockGenerateAIContext(...args),
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

    expect(mockProcessInstant).toHaveBeenCalled();
    vi.runAllTimers();
    expect(mockProcessDebounced).toHaveBeenCalled();
  });

  it('returns AI context using generated data', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' }),
    );

    const context = result.current.getAIContext();
    expect(mockGenerateAIContext).toHaveBeenCalled();
    expect(context).toBe('ctx');
  });
});
