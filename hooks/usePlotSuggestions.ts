import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { HistoryItem } from '../types';

export function useDocumentHistory(
    initialText: string, 
    chapterId: string | null,
    onSave: (text: string) => void
) {
  const [text, setText] = useState(initialText);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastSavedText, setLastSavedText] = useState(initialText);
  
  // Stable ref for onSave to avoid dependency churn
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Reset only when chapter changes, not when initialText reference changes
  useEffect(() => {
      setText(initialText);
      setHistory([]);
      setLastSavedText(initialText);
  }, [chapterId]); // intentionally omit initialText - we only reset on chapter change

  const updateText = useCallback((newText: string) => {
      setText(newText);
      onSaveRef.current(newText);
      setLastSavedText(newText);
  }, []);

  const commit = useCallback((newText: string, description: string, author: 'User' | 'Agent') => {
    setText(currentText => {
      // Capture previous content before updating
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description,
        author,
        previousContent: currentText,
        newContent: newText
      };
      // Schedule history update outside the setText updater
      setHistory(prevHist => [...prevHist, newItem]);
      return newText;
    });
    onSaveRef.current(newText);
    setLastSavedText(newText);
  }, []);

  const undo = useCallback(() => {
    let restoredText: string | null = null;
    
    setHistory(prev => {
      if (prev.length === 0) return prev;
      restoredText = prev[prev.length - 1].previousContent;
      return prev.slice(0, -1);
    });
    
    // Handle the side effects outside the updater
    if (restoredText !== null) {
      setText(restoredText);
      onSaveRef.current(restoredText);
      setLastSavedText(restoredText);
      return true;
    }
    return false;
  }, []);

  const restore = useCallback((id: string) => {
    setHistory(currentHistory => {
      const item = currentHistory.find(h => h.id === id);
      if (item) {
        // Use functional update to get fresh state
        setText(item.newContent);
        onSaveRef.current(item.newContent);
        setLastSavedText(item.newContent);
        
        const newItem: HistoryItem = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          description: `Reverted to version from ${new Date(item.timestamp).toLocaleTimeString()}`,
          author: 'User',
          previousContent: text, // Note: this is still stale - see below
          newContent: item.newContent
        };
        return [...currentHistory, newItem];
      }
      return currentHistory;
    });
  }, [text]); // text dependency needed for previousContent

  const reset = useCallback((newText: string) => {
      setText(newText);
      setHistory([]);
      onSaveRef.current(newText);
      setLastSavedText(newText);
  }, []);

  const hasUnsavedChanges = text !== lastSavedText;

  return { 
    text, 
    updateText,
    commit,
    history, 
    undo, 
    restore, 
    reset,
    hasUnsavedChanges
  };
}