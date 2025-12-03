import { useEffect, useRef, useState } from 'react';

/**
 * Returns a throttled copy of a value to limit re-renders.
 * Updates are delayed so that rapid changes (e.g., cursor/selection) don't trigger
 * excessive downstream renders while still settling on the latest value.
 */
export function useThrottledValue<T>(value: T, interval = 100): T {
  const [throttled, setThrottled] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;
    const applyUpdate = () => {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
    };

    if (elapsed >= interval) {
      applyUpdate();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(applyUpdate, interval - elapsed);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, interval]);

  return throttled;
}
