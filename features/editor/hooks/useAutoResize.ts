import { useLayoutEffect, useRef, useCallback, RefObject } from 'react';

/**
 * Optimized auto-resize hook using requestAnimationFrame.
 * 
 * Uses RAF to avoid blocking the main thread during typing,
 * coalescing multiple resize requests into a single frame.
 */
export function useAutoResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>, 
  value: string, 
  mode: string
) {
  const rafIdRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const performResize = useCallback(() => {
    if (textareaRef.current) {
      // Batch read/write to avoid layout thrashing
      const textarea = textareaRef.current;
      
      // Force a reflow by setting to auto first
      textarea.style.height = 'auto';
      
      // Read the scroll height
      const scrollHeight = textarea.scrollHeight;
      
      // Write the new height
      textarea.style.height = `${scrollHeight}px`;
    }
    pendingRef.current = false;
  }, [textareaRef]);

  const scheduleResize = useCallback(() => {
    // Skip if not in editor mode
    if (mode !== 'EDITOR') return;
    
    // Coalesce multiple calls into single RAF
    if (pendingRef.current) return;
    
    pendingRef.current = true;
    
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // Schedule resize on next frame
    rafIdRef.current = requestAnimationFrame(performResize);
  }, [mode, performResize]);

  // Trigger resize when value or mode changes
  useLayoutEffect(() => {
    scheduleResize();
  }, [value, mode, scheduleResize]);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Cancel any pending resize when leaving editor mode
  useLayoutEffect(() => {
    if (mode === 'EDITOR') return;
    if (rafIdRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingRef.current = false;
  }, [mode]);
}

/**
 * Creates a throttled resize observer for container-based resizing.
 * Useful when the textarea should respond to parent container changes.
 */
export function useResizeObserver(
  elementRef: RefObject<HTMLElement | null>,
  callback: (entry: ResizeObserverEntry) => void,
  throttleMs: number = 100
) {
  const rafIdRef = useRef<number | null>(null);
  const lastCallRef = useRef<number>(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const now = performance.now();
      
      // Throttle callbacks
      if (now - lastCallRef.current < throttleMs) {
        // Schedule for later if we're throttling
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          lastCallRef.current = performance.now();
          if (entries[0]) callback(entries[0]);
        });
        return;
      }

      lastCallRef.current = now;
      if (entries[0]) callback(entries[0]);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (rafIdRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [elementRef, callback, throttleMs]);
}