import { useLayoutEffect, useMemo, RefObject } from 'react';

// Simple debounce
function debounce(func: Function, wait: number) {
  let timeout: any;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function useAutoResize(textareaRef: RefObject<HTMLTextAreaElement | null>, value: string, mode: string) {
    const resize = useMemo(() => debounce(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, 100), []);

    useLayoutEffect(() => {
        if (mode === 'EDITOR') resize();
    }, [value, mode, resize]);
}