import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useAutoResize, useResizeObserver } from '@/features/editor/hooks/useAutoResize';

const rafSpy = vi.fn();
const cancelRafSpy = vi.fn();

const setupRaf = () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafSpy(cb);
    // Don't automatically execute callback for throttle testing
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', cancelRafSpy);
};

// Mock ResizeObserver
const observeSpy = vi.fn();
const disconnectSpy = vi.fn();
const resizeObserverCallbacks: ResizeObserverCallback[] = [];

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeObserverCallbacks.push(cb);
  }
  observe = observeSpy;
  disconnect = disconnectSpy;
  unobserve = vi.fn();
}

describe('useAutoResize', () => {
  beforeEach(() => {
    setupRaf();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rafSpy.mockReset();
    cancelRafSpy.mockReset();
    observeSpy.mockReset();
    disconnectSpy.mockReset();
    resizeObserverCallbacks.length = 0;
  });

  it('resizes textarea in editor mode', () => {
    // For this test we want immediate execution
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 120 });

    const ref = { current: textarea };

    renderHook(() => useAutoResize(ref, 'value', 'EDITOR'));

    expect(textarea.style.height).toBe('120px');
  });

  it('skips resizing when not in editor mode', () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 });
    const ref = { current: textarea };

    renderHook(() => useAutoResize(ref, 'value', 'READONLY'));

    expect(textarea.style.height).toBe('');
  });

  it('cleans up pending animation frame on unmount', () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 });
    const ref = { current: textarea };

    const { unmount } = renderHook(() => useAutoResize(ref, 'value', 'EDITOR'));
    unmount();

    expect(cancelRafSpy).toHaveBeenCalled();
  });

  it('coalesces multiple resize requests', () => {
    // Capture callbacks but don't run them yet
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 150 });
    const ref = { current: textarea };

    const { rerender } = renderHook(
      ({ val, m }) => useAutoResize(ref, val, m),
      { initialProps: { val: 'v1', m: 'EDITOR' } }
    );

    rerender({ val: 'v2', m: 'EDITOR' });
    rerender({ val: 'v3', m: 'EDITOR' });

    // Should have scheduled RAF
    expect(callbacks.length).toBeGreaterThan(0);
    
    // Execute last callback
    callbacks[callbacks.length - 1](0);
    
    expect(textarea.style.height).toBe('150px');
  });
});

describe('useResizeObserver', () => {
  beforeEach(() => {
    setupRaf();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    rafSpy.mockReset();
    cancelRafSpy.mockReset();
    observeSpy.mockReset();
    disconnectSpy.mockReset();
    resizeObserverCallbacks.length = 0;
  });

  it('observes element and handles resize events', () => {
    const div = document.createElement('div');
    const ref = { current: div };
    const callback = vi.fn();

    renderHook(() => useResizeObserver(ref, callback, 100));

    expect(observeSpy).toHaveBeenCalledWith(div);

    // Simulate resize
    const entry = { contentRect: { width: 100, height: 100 } } as ResizeObserverEntry;
    
    // Manually trigger observer callback
    act(() => {
      resizeObserverCallbacks.forEach(cb => cb([entry], {} as ResizeObserver));
    });

    // Fast-forward timers and trigger RAF
    act(() => {
      vi.advanceTimersByTime(101);
    });

    // Execute RAF
    const rafCallback = rafSpy.mock.calls[0]?.[0];
    if (rafCallback) {
      act(() => {
        rafCallback(0);
      });
    }

    expect(callback).toHaveBeenCalledWith(entry);
  });

  it('throttles resize callbacks', () => {
    // Use real timers for this test to avoid interference with performance.now mock
    vi.useRealTimers();

    const nowSpy = vi.spyOn(performance, 'now');
    let now = 150; // first event outside throttle window to set lastCallRef
    nowSpy.mockImplementation(() => now);

    const div = document.createElement('div');
    const ref = { current: div };
    const callback = vi.fn();

    renderHook(() => useResizeObserver(ref, callback, 100));

    const entry = { contentRect: { width: 100, height: 100 } } as ResizeObserverEntry;

    // First call (runs immediately since 150 - 0 >= 100, sets lastCallRef to 150)
    act(() => {
      resizeObserverCallbacks.forEach(cb => cb([entry], {} as ResizeObserver));
    });

    // Second call inside throttle window (50ms later, should schedule RAF)
    act(() => {
      now = 200; // 200 - 150 = 50 < 100ms throttle
      resizeObserverCallbacks.forEach(cb => cb([entry], {} as ResizeObserver));
    });

    // Should have scheduled RAF for the throttled call
    expect(rafSpy).toHaveBeenCalled();

    // Execute throttled callback path
    const rafCallback = rafSpy.mock.calls[rafSpy.mock.calls.length - 1]?.[0];
    if (rafCallback) {
      now = 300;
      act(() => {
        rafCallback(0);
      });
    }

    nowSpy.mockRestore();
  });

  it('disconnects observer on unmount', () => {
    const div = document.createElement('div');
    const ref = { current: div };
    const callback = vi.fn();

    const { unmount } = renderHook(() => useResizeObserver(ref, callback));
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
