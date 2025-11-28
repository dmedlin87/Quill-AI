import { useState, useCallback, useEffect, RefObject } from 'react';

interface SelectionState {
  start: number;
  end: number;
  text: string;
}

interface SelectionPosition {
  top: number;
  left: number;
}

export function useTextSelection(textareaRef: RefObject<HTMLTextAreaElement | null>) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [position, setPosition] = useState<SelectionPosition | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Calculate position relative to textarea, accounting for scroll
  const calculatePosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) return null;

    // Get textarea's position
    const rect = textarea.getBoundingClientRect();
    
    // Approximation: position popup near top-right of textarea
    // For precise caret positioning, you'd need a mirror div technique
    // or a library like textarea-caret-position
    return {
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX - 100, // offset from right edge
    };
  }, [textareaRef]);

  const updateSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Always update cursor position (use end for "focus" position)
    setCursorPosition(end);

    if (start !== end) {
      const text = textarea.value.substring(start, end);
      // Allow whitespace selections - let consumer decide if they matter
      setSelection({ start, end, text });
      setPosition(calculatePosition());
    } else {
      setSelection(null);
      setPosition(null);
    }
  }, [textareaRef, calculatePosition]);

  // Single handler for all selection changes
  const handleSelectionChange = useCallback(() => {
    updateSelection();
  }, [updateSelection]);

  // Mouse up can update position more precisely using event coordinates
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    setCursorPosition(end);

    if (start !== end) {
      const text = textarea.value.substring(start, end);
      setSelection({ start, end, text });
      
      // Use mouse position but convert to document coordinates
      setPosition({
        top: e.clientY + window.scrollY,
        left: e.clientX + window.scrollX,
      });
    } else {
      setSelection(null);
      setPosition(null);
    }
  }, []);

  // Handle keyboard selection (Shift+Arrow, Ctrl+Shift+Arrow, etc.)
  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only recalculate on keys that might change selection
    if (e.shiftKey || e.key === 'Home' || e.key === 'End') {
      updateSelection();
    }
  }, [updateSelection]);

  // Clear on blur
  const handleBlur = useCallback(() => {
    setSelection(null);
    setPosition(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setPosition(null);
  }, []);

  // Invalidate selection if content might have changed
  const invalidateIfStale = useCallback((currentText: string) => {
    if (selection) {
      const actualText = currentText.substring(selection.start, selection.end);
      if (actualText !== selection.text) {
        clearSelection();
      }
    }
  }, [selection, clearSelection]);

  return {
    selection,
    position,
    cursorPosition,
    handleSelectionChange,
    handleMouseUp,
    handleKeyUp,
    handleBlur,
    clearSelection,
    invalidateIfStale,
  };
}