import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateSafePosition,
  observeElementDimensions,
} from '@/features/shared/hooks/useViewportCollision';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: originalWidth });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: originalHeight });
  delete (window as any).ResizeObserver;
});

describe('calculateSafePosition', () => {
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
