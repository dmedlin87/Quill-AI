/**
 * Viewport Collision Detection Hook
 * 
 * Ensures positioned elements (like MagicBar) never render off-screen.
 * Calculates safe positioning with automatic boundary detection.
 */

import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

export interface Position {
  top: number;
  left: number;
}

export interface SafePosition extends Position {
  /** Whether the position was adjusted from the original */
  adjusted: boolean;
  /** Direction of adjustment */
  adjustments: {
    horizontal?: 'left' | 'right';
    vertical?: 'up' | 'down';
  };
}

export interface ViewportCollisionOptions {
  /** Padding from viewport edges (px) */
  padding?: number;
  /** Estimated element width for collision detection */
  elementWidth?: number;
  /** Estimated element height for collision detection */
  elementHeight?: number;
  /** Prefer positioning above or below the target */
  preferVertical?: 'above' | 'below';
}

const DEFAULT_OPTIONS: Required<ViewportCollisionOptions> = {
  padding: 16,
  elementWidth: 400,
  elementHeight: 200,
  preferVertical: 'above',
};

/**
 * Calculates a safe position that keeps the element within viewport bounds.
 */
export function calculateSafePosition(
  targetPosition: Position,
  options: ViewportCollisionOptions = {}
): SafePosition {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { padding, elementWidth, elementHeight, preferVertical } = opts;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let { top, left } = targetPosition;
  const adjustments: SafePosition['adjustments'] = {};
  let adjusted = false;

  // Calculate element bounds (assuming centered horizontally on target)
  const halfWidth = elementWidth / 2;
  let elementLeft = left - halfWidth;
  let elementRight = left + halfWidth;
  let elementTop = preferVertical === 'above' ? top - elementHeight : top;
  let elementBottom = elementTop + elementHeight;

  // Horizontal collision detection
  if (elementLeft < padding) {
    // Shift right
    const shift = padding - elementLeft;
    left += shift;
    adjustments.horizontal = 'right';
    adjusted = true;
  } else if (elementRight > viewportWidth - padding) {
    // Shift left
    const shift = elementRight - (viewportWidth - padding);
    left -= shift;
    adjustments.horizontal = 'left';
    adjusted = true;
  }

  // Vertical collision detection
  if (preferVertical === 'above' && elementTop < padding) {
    // Not enough room above, flip to below
    top = targetPosition.top + elementHeight + padding;
    adjustments.vertical = 'down';
    adjusted = true;
  } else if (preferVertical === 'below' && elementBottom > viewportHeight - padding) {
    // Not enough room below, flip to above
    top = targetPosition.top - elementHeight - padding;
    adjustments.vertical = 'up';
    adjusted = true;
  }

  // Final bounds check after adjustments
  top = Math.max(padding, Math.min(top, viewportHeight - elementHeight - padding));
  left = Math.max(padding + halfWidth, Math.min(left, viewportWidth - padding - halfWidth));

  return {
    top,
    left,
    adjusted,
    adjustments,
  };
}

/**
 * Hook for viewport-aware positioning.
 * Automatically recalculates safe position on resize/scroll.
 */
export function useViewportCollision(
  targetPosition: Position | null,
  options: ViewportCollisionOptions = {}
): SafePosition | null {
  const [safePosition, setSafePosition] = useState<SafePosition | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updatePosition = useCallback(() => {
    if (!targetPosition) {
      setSafePosition(null);
      return;
    }

    const safe = calculateSafePosition(targetPosition, optionsRef.current);
    setSafePosition(safe);
  }, [targetPosition]);

  // Update on target position change
  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // Update on viewport changes
  useEffect(() => {
    if (!targetPosition) return;

    const handleResize = () => updatePosition();
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [targetPosition, updatePosition]);

  return safePosition;
}

export function observeElementDimensions(
  elementRef: RefObject<HTMLElement | null>,
  onMeasure: (dimensions: { width: number; height: number }) => void
): (() => void) | undefined {
  if (!elementRef.current) {
    return undefined;
  }

  const measureElement = () => {
    const current = elementRef.current;
    if (current) {
      const rect = current.getBoundingClientRect();
      onMeasure({ width: rect.width, height: rect.height });
    }
  };

  measureElement();

  const observer = new ResizeObserver(measureElement);
  observer.observe(elementRef.current);

  return () => {
    observer.disconnect();
  };
}

/**
 * Hook that measures an element and provides collision-safe positioning.
 * Use when element dimensions are dynamic.
 */
export function useMeasuredCollision(
  targetPosition: Position | null,
  elementRef: RefObject<HTMLElement | null>,
  options: Omit<ViewportCollisionOptions, 'elementWidth' | 'elementHeight'> = {}
): SafePosition | null {
  const [dimensions, setDimensions] = useState({ width: 400, height: 200 });

  useEffect(() => {
    return observeElementDimensions(elementRef, ({ width, height }) => {
      setDimensions({ width, height });
    });
  }, [elementRef]);

  return useViewportCollision(targetPosition, {
    ...options,
    elementWidth: dimensions.width,
    elementHeight: dimensions.height,
  });
}
