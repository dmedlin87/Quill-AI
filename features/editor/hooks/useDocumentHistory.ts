import { useState, useCallback, useEffect, useRef } from 'react';
import { HistoryItem } from '@/types';

/**
 * Storage keys for persisting edit history
 */
const STORAGE_PREFIX = 'quillai_history_';
const MAX_PERSISTED_ITEMS = 50; // Limit to prevent storage bloat

/**
 * Safely get/set from sessionStorage with error handling
 */
function getPersistedHistory(chapterId: string): HistoryItem[] {
  if (!chapterId) return [];
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${chapterId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (Array.isArray(parsed)) {
        return parsed.slice(-MAX_PERSISTED_ITEMS);
      }
    }
  } catch (e) {
    console.warn('[useDocumentHistory] Failed to restore history:', e);
  }
  return [];
}

function persistHistory(chapterId: string, history: HistoryItem[]): void {
  if (!chapterId) return;
  try {
    // Only keep recent items to avoid storage limits
    const toStore = history.slice(-MAX_PERSISTED_ITEMS);
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${chapterId}`, 
      JSON.stringify(toStore)
    );
  } catch (e) {
    console.warn('[useDocumentHistory] Failed to persist history:', e);
  }
}

function clearPersistedHistory(chapterId: string): void {
  if (!chapterId) return;
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${chapterId}`);
  } catch (e) {
    // Ignore
  }
}

export function useDocumentHistory(
    initialText: string, 
    chapterId: string | null,
    onSave: (text: string) => void
) {
  const [text, setText] = useState(initialText);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryItem[]>([]);
  
  // Ref to track if we just switched chapters to avoid auto-saving initial load as a change
  const isFirstLoad = useRef(true);

  // When chapter changes, reset the local state and restore persisted history
  useEffect(() => {
      setText(initialText);
      // Restore history from session storage
      const restoredHistory = chapterId ? getPersistedHistory(chapterId) : [];
      setHistory(restoredHistory);
      setRedoStack([]);
      isFirstLoad.current = true;
  // We only want this to run when the chapter switches; `initialText` updates during typing
  // should not trigger a history reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  // Persist history changes to session storage
  useEffect(() => {
    if (chapterId && history.length > 0) {
      persistHistory(chapterId, history);
    }
  }, [history, chapterId]);

  // Raw update (for typing) - updates local state only
  const updateText = useCallback((newText: string) => {
      setText(newText);
      // Debounced save could happen here, but we'll rely on the parent/store for persistence
      // We call onSave immediately here for the store to stay in sync, 
      // relying on the store's efficient IndexedDB writes.
      onSave(newText);
  }, [onSave]);

  // Commit change (for agent/magic/restore) - adds to history AND saves
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
      // Any new commit invalidates the redo stack (new branch of history)
      setRedoStack([]);
      return newText;
    });
    onSave(newText);
  }, [onSave]);

  const undo = useCallback(() => {
    let success = false;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastItem = prev[prev.length - 1];
      setText(lastItem.previousContent);
      onSave(lastItem.previousContent);
      // Push to redo stack
      setRedoStack(redoPrev => [...redoPrev, lastItem]);
      success = true;
      return prev.slice(0, -1);
    });
    return success;
  }, [onSave]);

  const redo = useCallback(() => {
    let success = false;
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const lastItem = prev[prev.length - 1];
      setText(lastItem.newContent);
      onSave(lastItem.newContent);
      // Push back to history
      setHistory(histPrev => [...histPrev, lastItem]);
      success = true;
      return prev.slice(0, -1);
    });
    return success;
  }, [onSave]);

  const clearHistory = useCallback(() => {
    if (chapterId) {
      clearPersistedHistory(chapterId);
    }
    setHistory([]);
    setRedoStack([]);
  }, [chapterId]);

  const restore = useCallback((id: string) => {
     const item = history.find(h => h.id === id);
     if(item) {
         commit(item.newContent, `Reverted to version from ${new Date(item.timestamp).toLocaleTimeString()}`, 'User');
     }
  }, [history, commit]);

  const reset = useCallback((newText: string) => {
      setText(newText);
      setHistory([]);
      setRedoStack([]);
      onSave(newText);
  }, [onSave]);

  return { 
    text, 
    updateText,
    commit,
    history,
    redoStack,
    undo, 
    redo,
    restore, 
    reset,
    clearHistory,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
    hasUnsavedChanges: history.length > 0 || redoStack.length > 0 
  };
}
