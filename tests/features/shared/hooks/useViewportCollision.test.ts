import React, { useMemo } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import {
  calculateSafePosition,
  observeElementDimensions,
  useViewportCollision,
} from '@/features/shared/hooks/useViewportCollision';

// Helper to mock window dimensions
function mockViewport(width: number, height: number) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height);
}

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

// Restore spies after each test
afterEach(() => {
  vi.restoreAllMocks();
});

describe('calculateSafePosition', () => {
  beforeEach(() => {
    mockViewport(800, 600);
  });

  it('shifts horizontally and flips vertically based on viewport', () => {
    const collision = calculateSafePosition({ top: 20, left: 10 });

    expect(collision.adjusted).toBe(true);
    expect(collision.adjustments.horizontal).toBe('right');

    const flipped = calculateSafePosition(
      { top: 700, left: 300 },
      { preferVertical: 'below' }
    );

    expect(flipped.adjustments.vertical).toBe('up');
    expect(flipped.top).toBeLessThan(700);
  });

  it('shifts left when overflowing the right edge and flips above when preferring below', () => {
    const collision = calculateSafePosition(
      { top: 580, left: 780 },
      {
        elementWidth: 300,
        elementHeight: 150,
        preferVertical: 'below',
        padding: 12,
      }
    );

    expect(collision.adjusted).toBe(true);
    expect(collision.adjustments.horizontal).toBe('left');
    expect(collision.adjustments.vertical).toBe('up');
  });
});

describe('observeElementDimensions', () => {
  type ObserverInstance = {
    observe: (target: Element) => void;
    disconnect: () => void;
  };

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    observe = vi.fn((target: Element) => {
      this.callback(
        [{ target, contentRect: { width: 500, height: 250 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    });
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
  }

  let lastInstance: ObserverInstance | null = null;
  let constructorSpy: ReturnType<typeof vi.fn> | null = null;

  beforeEach(() => {
    mockViewport(800, 600);
    lastInstance = null;
    constructorSpy = vi.fn(function (this: MockResizeObserver, callback: ResizeObserverCallback) {
      const instance = new MockResizeObserver(callback);
      lastInstance = instance;
      return instance;
    });
    (window as any).ResizeObserver = constructorSpy;
  });

  afterEach(() => {
    lastInstance = null;
    constructorSpy = null;
    delete (window as any).ResizeObserver;
  });

  it('measures the element immediately and returns a cleanup function', () => {
    const measureCallback = vi.fn();
    const element = {
      getBoundingClientRect: vi.fn(() => ({ width: 400, height: 200 })),
    } as unknown as HTMLElement;
    const ref = { current: element } as React.RefObject<HTMLElement>;

    const cleanup = observeElementDimensions(ref, measureCallback);

    expect(measureCallback).toHaveBeenCalledWith({ width: 400, height: 200 });
    expect(constructorSpy).toHaveBeenCalled();
    expect(lastInstance).not.toBeNull();
    expect(lastInstance?.observe).toHaveBeenCalledWith(element);

    cleanup?.();

    expect(lastInstance?.disconnect).toHaveBeenCalled();
  });

  it('does nothing when the ref is missing', () => {
    const measureCallback = vi.fn();
    const ref = { current: null } as React.RefObject<HTMLElement>;

    const cleanup = observeElementDimensions(ref, measureCallback);

    expect(cleanup).toBeUndefined();
    expect(constructorSpy).not.toHaveBeenCalled();
    expect(measureCallback).not.toHaveBeenCalled();
  });
});

describe('useViewportCollision', () => {
  beforeEach(() => {
     mockViewport(800, 600);
  });

  it('recalculates when viewport changes', () => {
    // Stable object reference
    const testPos = { top: 300, left: 300 };

    // Capture the hook return value
    const { result } = renderHook(() => useViewportCollision(testPos));

    // Initial: Viewport 800. Left 300.
    // Fits.
    expect(result.current?.adjusted).toBe(false);
    expect(result.current?.left).toBe(300);

    // Resize Viewport to 300
    act(() => {
      // Update mock
      mockViewport(300, 600);
      window.dispatchEvent(new Event('resize'));
    });

    // Check adjustment detection
    expect(result.current?.adjustments.horizontal).toBe('left');
    expect(result.current?.adjusted).toBe(true);

    // Expected value:
    // Initial Shift = 500 - 284 = 216.
    // Adjusted Left = 300 - 216 = 84.
    // Final Clamp: max(padding + halfWidth, min(84, ...))
    // padding(16) + halfWidth(200) = 216.
    // Result is clamped to 216 because element is wider than viewport and prioritizes left safety.
    expect(result.current?.left).toBe(216);
  });
});
