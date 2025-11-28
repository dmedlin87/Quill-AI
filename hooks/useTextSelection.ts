import { useState, useCallback, RefObject } from 'react';

export function useTextSelection(textareaRef: RefObject<HTMLTextAreaElement | null>) {
  const [selection, setSelection] = useState<{start: number, end: number, text: string} | null>(null);
  const [position, setPosition] = useState<{top: number, left: number} | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleSelectionChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      setCursorPosition(start);

      // Handle actual text selection range
      if (start !== end) {
        const text = target.value.substring(start, end);
        if (text.trim().length > 0) {
            setSelection({ start, end, text });
        } else {
            setSelection(null);
            setPosition(null);
        }
      } else {
         setSelection(null);
         setPosition(null);
      }
  }, []);
  
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
      handleSelectionChange(e);
      const target = e.currentTarget;
      if (target.selectionStart !== target.selectionEnd) {
          setPosition({ top: e.clientY, left: e.clientX });
      }
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
      setSelection(null);
      setPosition(null);
  }, []);

  return { 
      selection, 
      position, 
      cursorPosition, 
      handleSelectionChange, 
      handleMouseUp, 
      clearSelection 
  };
}