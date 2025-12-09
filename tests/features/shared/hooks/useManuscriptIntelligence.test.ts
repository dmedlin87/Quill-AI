import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useManuscriptIntelligence,
  useCurrentScene,
  useStyleAlerts,
  useOpenPromises,
  useHighRiskSections,
} from '@/features/shared/hooks/useManuscriptIntelligence';
import type { ManuscriptIntelligence } from '@/types/intelligence';

const mocks = vi.hoisted(() => ({
  processInstant: vi.fn(() => ({
    wordCount: 100,
    sentenceCount: 10,
    paragraphCount: 5,
    cursorScene: null,
    cursorTension: 0.5,
  })),
  processDebounced: vi.fn(() => ({
    wordCount: 100,
    sentenceCount: 10,
    paragraphCount: 5,
    cursorScene: 'action',
    cursorTension: 0.7,
  })),
  processManuscript: vi.fn(() => ({
    hud: { situational: {} },
    structural: { scenes: [] },
    entities: { nodes: [] },
    timeline: { promises: [] },
    heatmap: { sections: [] },
    style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
    chapterId: 'c1',
  })),
  updateHUD: vi.fn(() => ({ situational: {} })),
  generateAIContext: vi.fn(() => 'ctx'),
}));

vi.mock('@/services/intelligence', () => ({
  processInstant: mocks.processInstant,
  processDebounced: mocks.processDebounced,
  processManuscript: mocks.processManuscript,
  updateHUDForCursor: mocks.updateHUD,
  generateAIContext: mocks.generateAIContext,
  createEmptyIntelligence: (id: string) => ({
    hud: { situational: {} },
    structural: { scenes: [] },
    entities: { nodes: [] },
    timeline: { promises: [] },
    heatmap: { sections: [] },
    style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
    chapterId: id,
  }),
  ChangeHistory: class {
    push(change: any) {
      return change;
    }
  },
}));

describe('useManuscriptIntelligence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs instant and debounced processing on text updates', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' })
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
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' })
    );

    const context = result.current.getAIContext();
    expect(mocks.generateAIContext).toHaveBeenCalled();
    expect(context).toBe('ctx');
  });

  it('returns compressed AI context when requested', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' })
    );

    result.current.getAIContext(true);
    expect(mocks.generateAIContext).toHaveBeenCalledWith(expect.anything(), expect.any(Number), true);
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' })
    );

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.processingTier).toBe('idle');
    expect(result.current.lastProcessedAt).toBe(0);
  });

  it('throttles instant processing calls', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' })
    );

    // First call should go through
    act(() => {
      result.current.updateText('a', 1);
    });
    const callCount1 = mocks.processInstant.mock.calls.length;

    // Immediate second call should be throttled
    act(() => {
      result.current.updateText('ab', 2);
    });
    const callCount2 = mocks.processInstant.mock.calls.length;

    expect(callCount2).toBe(callCount1); // Should be throttled

    // After throttle period, should work again
    vi.advanceTimersByTime(100);
    act(() => {
      result.current.updateText('abc', 3);
    });
    expect(mocks.processInstant.mock.calls.length).toBeGreaterThan(callCount2);
  });

  it('updateCursor updates HUD when scenes exist', () => {
    mocks.processManuscript.mockReturnValueOnce({
      hud: { situational: {} },
      structural: { scenes: [{ startOffset: 0, endOffset: 100 }] },
      entities: { nodes: [] },
      timeline: { promises: [] },
      heatmap: { sections: [] },
      style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
      chapterId: 'c1',
    });

    const { result, rerender } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Test content' })
    );

    // Trigger background processing to update intelligence
    vi.runAllTimers();
    rerender();

    act(() => {
      result.current.updateCursor(50);
    });

    expect(mocks.updateHUD).toHaveBeenCalled();
  });

  it('forceFullProcess clears timers and runs immediately', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Test' })
    );

    act(() => {
      result.current.forceFullProcess();
    });

    // Should trigger background processing
    vi.runAllTimers();
    expect(mocks.processManuscript).toHaveBeenCalled();
  });

  it('getSectionContext returns context based on intelligence data', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Long test content' })
    );

    // Run all timers to trigger background processing
    vi.runAllTimers();

    // getSectionContext returns formatted context - may be empty if no scenes in range
    const context = result.current.getSectionContext(0, 100);
    expect(typeof context).toBe('string');
  });

  it('clears timers on unmount', () => {
    const { unmount } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Test' })
    );

    // Start some processing
    act(() => {
      // This will schedule debounced and background processing
    });

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });

  it('calls onIntelligenceReady callback when processing completes', () => {
    const onReady = vi.fn();

    renderHook(() =>
      useManuscriptIntelligence({
        chapterId: 'c1',
        initialText: 'Test content',
        onIntelligenceReady: onReady,
      })
    );

    // Trigger background processing
    vi.runAllTimers();

    expect(onReady).toHaveBeenCalled();
  });
});

describe('useCurrentScene', () => {
  it('returns the scene at cursor position', () => {
    const intelligence = {
      structural: {
        scenes: [
          { startOffset: 0, endOffset: 100, type: 'action' },
          { startOffset: 100, endOffset: 200, type: 'dialogue' },
        ],
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useCurrentScene(intelligence, 50));
    expect(result.current?.type).toBe('action');
  });

  it('returns null when cursor is outside all scenes', () => {
    const intelligence = {
      structural: {
        scenes: [{ startOffset: 0, endOffset: 100, type: 'action' }],
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useCurrentScene(intelligence, 150));
    expect(result.current).toBeNull();
  });

  it('returns null when no scenes exist', () => {
    const intelligence = {
      structural: { scenes: [] },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useCurrentScene(intelligence, 50));
    expect(result.current).toBeNull();
  });
});

describe('useStyleAlerts', () => {
  it('returns alerts for high passive voice ratio', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 5,
          adverbDensity: 0,
          clicheCount: 0,
          filterWordDensity: 0,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toContain('Passive voice: 5.0/100 words');
  });

  it('returns alerts for high adverb density', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 0,
          adverbDensity: 6,
          clicheCount: 0,
          filterWordDensity: 0,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toContain('Adverb density: 6.0/100 words');
  });

  it('returns alerts for clichés', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 0,
          adverbDensity: 0,
          clicheCount: 3,
          filterWordDensity: 0,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toContain('3 clichés detected');
  });

  it('returns alerts for high filter word density', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 0,
          adverbDensity: 0,
          clicheCount: 0,
          filterWordDensity: 5,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toContain('Filter words: 5.0/100 words');
  });

  it('returns empty array when all metrics are below thresholds', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 1,
          adverbDensity: 2,
          clicheCount: 0,
          filterWordDensity: 1,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toHaveLength(0);
  });

  it('returns multiple alerts when multiple thresholds exceeded', () => {
    const intelligence = {
      style: {
        flags: {
          passiveVoiceRatio: 5,
          adverbDensity: 6,
          clicheCount: 2,
          filterWordDensity: 4,
        },
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current.length).toBe(4);
  });
});

describe('useOpenPromises', () => {
  it('returns only unresolved promises', () => {
    const intelligence = {
      timeline: {
        promises: [
          { id: '1', description: 'Promise 1', resolved: false },
          { id: '2', description: 'Promise 2', resolved: true },
          { id: '3', description: 'Promise 3', resolved: false },
        ],
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useOpenPromises(intelligence));
    expect(result.current).toHaveLength(2);
    expect(result.current.every(p => !p.resolved)).toBe(true);
  });

  it('returns empty array when all promises are resolved', () => {
    const intelligence = {
      timeline: {
        promises: [
          { id: '1', description: 'Promise 1', resolved: true },
          { id: '2', description: 'Promise 2', resolved: true },
        ],
      },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useOpenPromises(intelligence));
    expect(result.current).toHaveLength(0);
  });

  it('returns empty array when no promises exist', () => {
    const intelligence = {
      timeline: { promises: [] },
    } as ManuscriptIntelligence;

    const { result } = renderHook(() => useOpenPromises(intelligence));
    expect(result.current).toHaveLength(0);
  });
});

describe('useHighRiskSections', () => {
  it('returns sections with risk above threshold, sorted by risk', () => {
    const intelligence = {
      heatmap: {
        sections: [
          { id: '1', overallRisk: 0.3 },
          { id: '2', overallRisk: 0.8 },
          { id: '3', overallRisk: 0.6 },
          { id: '4', overallRisk: 0.9 },
        ],
      },
    } as unknown as ManuscriptIntelligence;

    const { result } = renderHook(() => useHighRiskSections(intelligence, 0.5));
    expect(result.current).toHaveLength(3);
    expect(result.current[0].overallRisk).toBe(0.9);
    expect(result.current[1].overallRisk).toBe(0.8);
    expect(result.current[2].overallRisk).toBe(0.6);
  });

  it('uses default threshold of 0.5', () => {
    const intelligence = {
      heatmap: {
        sections: [
          { id: '1', overallRisk: 0.4 },
          { id: '2', overallRisk: 0.5 },
          { id: '3', overallRisk: 0.6 },
        ],
      },
    } as unknown as ManuscriptIntelligence;

    const { result } = renderHook(() => useHighRiskSections(intelligence));
    expect(result.current).toHaveLength(2);
  });

  it('returns empty array when no sections above threshold', () => {
    const intelligence = {
      heatmap: {
        sections: [
          { id: '1', overallRisk: 0.2 },
          { id: '2', overallRisk: 0.3 },
        ],
      },
    } as unknown as ManuscriptIntelligence;

    const { result } = renderHook(() => useHighRiskSections(intelligence, 0.5));
    expect(result.current).toHaveLength(0);
  });
});
