import React, { createContext, useContext, useCallback, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDocumentHistory } from '../hooks/useDocumentHistory';
import { HistoryItem, HighlightRange, EditorContext as EditorContextType } from '../types';
import { Editor } from '@tiptap/react';

/**
 * EditorContext (formerly ManuscriptContext)
 * 
 * Centralized state management for all text manipulation:
 * - Text content and mutations
 * - Selection and cursor state
 * - Undo/Redo history stack
 * - Document navigation (highlight jumps)
 */
export interface ManuscriptContextValue {
  // TipTap Editor Instance
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  
  // Text & Content
  currentText: string;
  updateText: (text: string) => void;
  commit: (text: string, description: string, author: 'User' | 'Agent') => void;
  loadDocument: (text: string) => void;
  
  // History (Undo/Redo)
  history: HistoryItem[];
  redoStack: HistoryItem[];
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  restore: (id: string) => void;
  hasUnsavedChanges: boolean;
  
  // Selection & Cursor
  selectionRange: { start: number; end: number; text: string } | null;
  selectionPos: { top: number; left: number } | null;
  cursorPosition: number;
  setSelection: (start: number, end: number) => void;
  setSelectionState: (range: { start: number; end: number; text: string } | null, pos: { top: number; left: number } | null) => void;
  clearSelection: () => void;
  
  // Navigation & Highlighting
  activeHighlight: HighlightRange | null;
  handleNavigateToIssue: (start: number, end: number) => void;
  scrollToPosition: (position: number) => void;
  
  // Computed Context (for agent)
  getEditorContext: () => EditorContextType;
}

const ManuscriptContext = createContext<ManuscriptContextValue | undefined>(undefined);

export const ManuscriptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    activeChapterId, 
    updateChapterContent,
    getActiveChapter 
  } = useProjectStore();
  
  const activeChapter = getActiveChapter();
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleSaveContent = useCallback((text: string) => {
    if (activeChapterId) updateChapterContent(activeChapterId, text);
  }, [activeChapterId, updateChapterContent]);

  // Full history hook with undo/redo
  const { 
    text: currentText, 
    updateText, 
    commit, 
    history, 
    redoStack,
    undo,
    redo,
    canUndo,
    canRedo,
    restore, 
    reset: loadDocument,
    hasUnsavedChanges 
  } = useDocumentHistory(
    activeChapter?.content || '', 
    activeChapterId, 
    handleSaveContent
  );

  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  
  const cursorPosition = editor?.state.selection.from || 0;

  const setSelectionState = useCallback((
      range: { start: number; end: number; text: string } | null, 
      pos: { top: number; left: number } | null
  ) => {
      setSelectionRange(range);
      setSelectionPos(pos);
  }, []);

  // Programmatic selection setter (for issue deep-linking)
  const setSelection = useCallback((start: number, end: number) => {
    if (!editor) return;
    
    // Clamp to valid range
    const safeStart = Math.max(0, Math.min(start, editor.state.doc.content.size));
    const safeEnd = Math.max(safeStart, Math.min(end, editor.state.doc.content.size));
    
    editor.chain()
      .focus()
      .setTextSelection({ from: safeStart, to: safeEnd })
      .run();
    
    // Update local state
    const selectedText = editor.state.doc.textBetween(safeStart, safeEnd, ' ');
    setSelectionRange({ start: safeStart, end: safeEnd, text: selectedText });
  }, [editor]);

  const clearSelection = useCallback(() => {
      setSelectionRange(null);
      setSelectionPos(null);
      editor?.commands.focus();
  }, [editor]);

  const [activeHighlight, setActiveHighlight] = useState<HighlightRange | null>(null);

  // Navigate to issue and highlight it
  const handleNavigateToIssue = useCallback((start: number, end: number) => {
    setActiveHighlight({ start, end, type: 'issue' });
    setSelection(start, end);
  }, [setSelection]);

  // Scroll editor to position
  const scrollToPosition = useCallback((position: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(position).run();
  }, [editor]);

  // Get current editor context for agent
  const getEditorContext = useCallback((): EditorContextType => ({
    cursorPosition,
    selection: selectionRange,
    totalLength: currentText.length
  }), [cursorPosition, selectionRange, currentText.length]);

  const value: ManuscriptContextValue = {
    // Editor
    editor,
    setEditor,
    
    // Text
    currentText,
    updateText,
    commit,
    loadDocument,
    
    // History
    history,
    redoStack,
    undo,
    redo,
    canUndo,
    canRedo,
    restore,
    hasUnsavedChanges,
    
    // Selection
    selectionRange,
    selectionPos,
    cursorPosition,
    setSelection,
    setSelectionState,
    clearSelection,
    
    // Navigation
    activeHighlight,
    handleNavigateToIssue,
    scrollToPosition,
    
    // Context
    getEditorContext
  };

  return (
    <ManuscriptContext.Provider value={value}>
      {children}
    </ManuscriptContext.Provider>
  );
};

export const useManuscript = () => {
  const context = useContext(ManuscriptContext);
  if (!context) {
    throw new Error('useManuscript must be used within a ManuscriptProvider');
  }
  return context;
};
