import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useThrottledValue } from '@/features/shared/hooks/useThrottledValue';

describe('useThrottledValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useThrottledValue('initial', 100));
    
    expect(result.current).toBe('initial');
  });

  it('eventually updates to new value after interval', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );
    
    // Change value
    rerender({ value: 'second' });
    
    // Initially still first (throttled)
    expect(result.current).toBe('first');
    
    // After interval, should update
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe('second');
  });

  it('delays update when within interval', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );
    
    // Immediate update
    rerender({ value: 'second' });
    
    // Still shows first because within interval
    expect(result.current).toBe('first');
    
    // After timeout fires
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe('second');
  });

  it('uses latest value when multiple updates within interval', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );
    
    rerender({ value: 'second' });
    rerender({ value: 'third' });
    rerender({ value: 'fourth' });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe('fourth');
  });

  it('clears timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    const { unmount, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );
    
    rerender({ value: 'second' });
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('updates immediately when interval has already elapsed', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      rerender({ value: 'second' });
    });

    expect(result.current).toBe('second');
  });

  it('clears pending timeout before scheduling a new tick', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 100),
      { initialProps: { value: 'first' } },
    );

    act(() => {
      rerender({ value: 'second' });
    });

    act(() => {
      rerender({ value: 'third' });
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('respects custom interval', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 500),
      { initialProps: { value: 'first' } },
    );
    
    rerender({ value: 'second' });
    
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    // Still first because 500ms hasn't passed
    expect(result.current).toBe('first');
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(result.current).toBe('second');
  });
});
