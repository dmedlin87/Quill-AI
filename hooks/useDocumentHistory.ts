import { useState, useCallback } from 'react';
import { HistoryItem } from '../types';

export function useDocumentHistory(initialText: string) {
  const [text, setText] = useState(initialText);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Raw update (for typing)
  const updateText = useCallback((newText: string) => {
      setText(newText);
  }, []);

  // Commit change (for agent/magic/restore)
  const commit = useCallback((newText: string, description: string, author: 'User' | 'Agent') => {
    setText(prev => {
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description,
        author,
        previousContent: prev,
        newContent: newText
      };
      setHistory(prevHist => [...prevHist, newItem]);
      return newText;
    });
  }, []);

  const undo = useCallback(() => {
    let success = false;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastItem = prev[prev.length - 1];
      setText(lastItem.previousContent);
      success = true;
      return prev.slice(0, -1);
    });
    return success;
  }, []);

  const restore = useCallback((id: string) => {
     const item = history.find(h => h.id === id);
     if(item) {
         commit(item.newContent, `Reverted to version from ${new Date(item.timestamp).toLocaleTimeString()}`, 'User');
     }
  }, [history, commit]);

  const reset = useCallback((newText: string) => {
      setText(newText);
      setHistory([]);
  }, []);

  return { 
    text, 
    updateText,
    commit,
    history, 
    undo, 
    restore, 
    reset,
    hasUnsavedChanges: history.length > 0 
  };
}