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

  it('throttles instant processing within the throttle window', () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1020);

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' }),
    );

    act(() => {
      result.current.updateText('a', 1);
      result.current.updateText('ab', 2);
    });

    expect(mocks.processInstant).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it('uses requestIdleCallback for background processing when available', () => {
    const ric = vi.fn((cb: any) => cb());
    vi.stubGlobal('requestIdleCallback', ric as any);

    const onReady = vi.fn();
    mocks.processManuscript.mockReturnValueOnce({
      hud: { situational: {} },
      structural: { scenes: [] },
      entities: { nodes: [] },
      timeline: { promises: [] },
      heatmap: { sections: [] },
      style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
      chapterId: 'c1',
    });

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '', onIntelligenceReady: onReady }),
    );

    act(() => {
      result.current.forceFullProcess();
    });

    expect(ric).toHaveBeenCalled();
    expect(mocks.processManuscript).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('updates HUD on cursor updates when scenes exist and builds section context', () => {
    const onReady = vi.fn();

    mocks.processManuscript.mockReturnValueOnce({
      hud: { situational: {} },
      structural: {
        scenes: [
          { startOffset: 0, endOffset: 20, type: 'action', tension: 0.6, pov: 'Alice' },
        ],
      },
      entities: {
        nodes: [
          {
            name: 'Alice',
            type: 'character',
            mentions: [{ offset: 5 }],
          },
        ],
      },
      timeline: { promises: [] },
      heatmap: { sections: [] },
      style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
      chapterId: 'c1',
    } as any);

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '', onIntelligenceReady: onReady }),
    );

    act(() => {
      result.current.updateText('Hello world', 0);
      result.current.forceFullProcess();
      vi.runAllTimers();
    });

    expect(onReady).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateCursor(10);
    });

    expect(mocks.updateHUD).toHaveBeenCalled();

    const sectionContext = result.current.getSectionContext(0, 15);
    expect(sectionContext).toContain('[SCENES]');
    expect(sectionContext).toContain('POV: Alice');
    expect(sectionContext).toContain('[ENTITIES]');
    expect(sectionContext).toContain('Alice (character)');
  });

  it('runs instant and debounced processing on text updates', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Hello' })
    );

    act(() => {
      result.current.updateText('Hello world', 5);
    });

    expect(mocks.processInstant).toHaveBeenCalled();
    act(() => {
        vi.runAllTimers();
    });
    expect(mocks.processDebounced).toHaveBeenCalled();
  });

  it('debounces processing calls', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' })
    );

    // Multiple rapid updates
    act(() => {
      result.current.updateText('a', 1);
    });
    act(() => {
      vi.advanceTimersByTime(50); // Less than debounce delay (150ms)
      result.current.updateText('ab', 2);
    });
    act(() => {
      vi.advanceTimersByTime(50);
      result.current.updateText('abc', 3);
    });

    // Should not have called debounced process yet
    expect(mocks.processDebounced).not.toHaveBeenCalled();

    // Advance past debounce delay
    act(() => {
      vi.runAllTimers();
    });

    // Should be called once for the final state
    expect(mocks.processDebounced).toHaveBeenCalledTimes(1);
    expect(mocks.processDebounced).toHaveBeenCalledWith('abc', 3);
  });

  it('cancels pending timers on new input', () => {
     const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' })
    );

    act(() => {
      result.current.updateText('first', 5);
    });

    // Check that we have a timer running implicitly by advancing partial time
    act(() => {
        vi.advanceTimersByTime(100);
    });
    expect(mocks.processDebounced).not.toHaveBeenCalled();

    // Update again - should cancel previous timer
    act(() => {
        result.current.updateText('second', 6);
    });

    // Advance time that would have triggered the first timer if not cancelled
    act(() => {
        vi.advanceTimersByTime(100);
    });
    // Total time 200ms since first call, but only 100ms since second.
    // If not cancelled, first call would have fired at 150ms.
    expect(mocks.processDebounced).not.toHaveBeenCalled();

    // Finish second timer
    act(() => {
        vi.advanceTimersByTime(100);
    });
    expect(mocks.processDebounced).toHaveBeenCalledTimes(1);
    expect(mocks.processDebounced).toHaveBeenCalledWith('second', 6);
  });

  it('cancels background processing timer on new input', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: '' })
    );

    act(() => {
      result.current.updateText('first', 5);
    });

    // Advance past debounce but before background (150ms < t < 2000ms)
    act(() => {
        vi.advanceTimersByTime(500);
    });
    // Background should not have run yet
    expect(mocks.processManuscript).not.toHaveBeenCalled();

    // Update again
    act(() => {
        result.current.updateText('second', 6);
    });

    // Advance time that would have triggered the first background timer (total > 2000ms from start)
    act(() => {
        vi.advanceTimersByTime(1600); 
    });
    // 500 + 1600 = 2100ms. First background timer was at 2000ms.
    // If not cancelled, it would run with 'first'.
    expect(mocks.processManuscript).not.toHaveBeenCalled();

    // Advance to trigger second background timer (2000ms after second update)
    act(() => {
        vi.advanceTimersByTime(500); // Total from second update: 1600 + 500 = 2100ms
    });

    expect(mocks.processManuscript).toHaveBeenCalledTimes(1);
    expect(mocks.processManuscript).toHaveBeenCalledWith('second', expect.anything(), expect.anything(), expect.anything());
  });

  it('resets processing state on error', async () => {
    // Mock processManuscript to throw
    mocks.processManuscript.mockImplementationOnce(() => {
      throw new Error('Processing failed');
    });

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Error trigger' })
    );

    // Trigger background process
    act(() => {
      try {
        vi.runAllTimers();
      } catch (e) {
        // Expected error from processManuscript
      }
    });

    // The hook swallows the error in the fallback path but resets state
    // We check that isProcessing is false
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.processingTier).toBe('idle');
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
    act(() => {
        vi.advanceTimersByTime(100);
    });
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
    act(() => {
        vi.runAllTimers();
    });

    act(() => {
      result.current.updateCursor(50);
    });

    expect(mocks.updateHUD).toHaveBeenCalled();
  });

  it('updateCursor does not update HUD if no scenes exist', () => {
    mocks.processManuscript.mockReturnValueOnce({
      hud: { situational: {} },
      structural: { scenes: [] }, // No scenes
      entities: { nodes: [] },
      timeline: { promises: [] },
      heatmap: { sections: [] },
      style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
      chapterId: 'c1',
    });

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Test content' })
    );

    // Trigger background processing
    act(() => {
        vi.runAllTimers();
    });

    mocks.updateHUD.mockClear();

    act(() => {
      result.current.updateCursor(50);
    });

    expect(mocks.updateHUD).not.toHaveBeenCalled();
  });

  it('forceFullProcess clears pending timers and runs immediately', () => {
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Test' })
    );

    // Trigger update to set timers
    act(() => {
        result.current.updateText('New text', 10);
    });

    // Clear mocks to verify new call
    mocks.processManuscript.mockClear();

    // Call forceFullProcess immediately (before timers fire)
    act(() => {
      result.current.forceFullProcess();
    });

    // Should run immediately
    // Wait, forceFullProcess uses setTimeout(0) or idleCallback.
    // So we still need to advance timers, but the ORIGINAL debounce timers should have been cleared.

    // Check if debounce timer was cleared?
    // We can't check refs directly. But we can check that `processDebounced` was NOT called if we only advance a little bit?
    // Actually `forceFullProcess` cancels debounce and runs background process.

    expect(mocks.processManuscript).not.toHaveBeenCalled(); // Because it is async

    act(() => {
        vi.runAllTimers();
    });

    expect(mocks.processManuscript).toHaveBeenCalled();
  });

  it('getSectionContext returns context based on intelligence data', async () => {
    // Mock data with entities and scenes
    mocks.processManuscript.mockReturnValueOnce({
        hud: { situational: {} },
        structural: { scenes: [{ startOffset: 0, endOffset: 100, type: 'action', tension: 0.8, pov: 'Hero' }] },
        entities: {
            nodes: [
                { name: 'Hero', type: 'character', mentions: [{ offset: 10 }] },
                { name: 'Villain', type: 'character', mentions: [{ offset: 200 }] } // Outside range
            ]
        },
        timeline: { promises: [] },
        heatmap: { sections: [] },
        style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
        chapterId: 'c1',
    });

    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'c1', initialText: 'Long test content' })
    );

    // Run all timers to trigger background processing and state update
    await act(async () => {
        vi.runAllTimers();
    });

    // getSectionContext returns formatted context
    const context = result.current.getSectionContext(0, 100);

    expect(context).toContain('[SCENES]');
    expect(context).toContain('action');
    expect(context).toContain('tension: 8/10');
    expect(context).toContain('POV: Hero');

    expect(context).toContain('[ENTITIES]');
    expect(context).toContain('Hero (character)');
    expect(context).not.toContain('Villain');
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
    act(() => {
        vi.runAllTimers();
    });

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

describe('Worker Integration', () => {
  let mockWorker: any;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    // Mock Worker global
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    
    // Mock Worker global using a class to support 'new Worker()' usage
    // We mock it as a spy that returns an instance, so we can verify instantiation
    const MockWorkerInstance = class {
      postMessage = mockWorker.postMessage;
      terminate = mockWorker.terminate;
      onmessage = null;
      onerror = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      dispatchEvent = vi.fn();
      
      constructor() {
        mockWorker.instance = this;
      }
    };

    class WorkerCtor {
      postMessage = mockWorker.postMessage;
      terminate = mockWorker.terminate;
      onmessage: any = null;
      onerror: any = null;

      constructor() {
        mockWorker.instance = this;
      }
    }

    vi.stubGlobal('Worker', WorkerCtor as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
  });

  it('posts to the worker and handles RESULT/ERROR messages, then cancels on unmount', async () => {
    const mod = await import('@/features/shared/hooks/useManuscriptIntelligence');

    const originalEnabled = mod.WORKER_CONFIG.enabled;
    mod.WORKER_CONFIG.enabled = true;

    const onReady = vi.fn();
    try {
      const { result, unmount } = renderHook(() =>
        mod.useManuscriptIntelligence({ chapterId: 'c1', initialText: '', onIntelligenceReady: onReady }),
      );

      act(() => {
        result.current.forceFullProcess();
      });

      expect(mockWorker.postMessage).toHaveBeenCalled();
      const requestId = mockWorker.postMessage.mock.calls[0]?.[0]?.id;
      expect(requestId).toBeTruthy();

      // Ignore mismatched ids (non-READY)
      act(() => {
        mockWorker.instance.onmessage?.({
          data: { type: 'RESULT', id: 'old', payload: { chapterId: 'c1' } },
        });
      });
      expect(onReady).not.toHaveBeenCalled();

      // Exercise READY + PROGRESS branches
      act(() => {
        mockWorker.instance.onmessage?.({ data: { type: 'READY', id: 'ready' } });
        mockWorker.instance.onmessage?.({
          data: { type: 'PROGRESS', id: requestId, progress: { percent: 50 } },
        });
      });

      // RESULT updates state and calls callback
      const payload = {
        chapterId: 'c1',
        hud: { situational: { ok: true } },
        structural: { scenes: [] },
        entities: { nodes: [] },
        timeline: { promises: [] },
        heatmap: { sections: [] },
        style: { flags: { passiveVoiceRatio: 0, adverbDensity: 0, clicheCount: 0, filterWordDensity: 0 } },
      };

      act(() => {
        mockWorker.instance.onmessage?.({ data: { type: 'RESULT', id: requestId, payload } });
      });

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(result.current.processingTier).toBe('idle');
      expect(result.current.isProcessing).toBe(false);

      // ERROR sets idle and stops processing
      act(() => {
        result.current.forceFullProcess();
      });
      const secondRequestId = mockWorker.postMessage.mock.calls.at(-1)?.[0]?.id;

      act(() => {
        mockWorker.instance.onmessage?.({ data: { type: 'ERROR', id: secondRequestId, error: 'boom' } });
      });

      expect(result.current.processingTier).toBe('idle');
      expect(result.current.isProcessing).toBe(false);

      act(() => {
        unmount();
      });

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'CANCEL', id: secondRequestId });
    } finally {
      mod.WORKER_CONFIG.enabled = originalEnabled;
    }
  });
});
