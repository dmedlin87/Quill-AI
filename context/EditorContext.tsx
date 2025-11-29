import React, { createContext, useContext, useCallback, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDocumentHistory } from '../hooks/useDocumentHistory';
import { HistoryItem, HighlightRange } from '../types';
import { Editor } from '@tiptap/react';

export interface EditorContextValue {
  // Editor Instance
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Text & History
  currentText: string;
  updateText: (text: string) => void;
  commit: (text: string, description: string, author: 'User' | 'Agent') => void;
  history: HistoryItem[];
  restore: (id: string) => void;
  hasUnsavedChanges: boolean;

  // Selection
  selectionRange: { start: number; end: number; text: string } | null;
  selectionPos: { top: number; left: number } | null;
  cursorPosition: number;
  
  // Selection Setters (called by RichTextEditor)
  setSelectionState: (range: { start: number; end: number; text: string } | null, pos: { top: number; left: number } | null) => void;
  clearSelection: () => void;

  // UI State
  activeHighlight: HighlightRange | null;
  handleNavigateToIssue: (start: number, end: number) => void;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    activeChapterId, 
    updateChapterContent,
    getActiveChapter 
  } = useProjectStore();
  
  const activeChapter = getActiveChapter();

  // Tiptap Editor Instance
  const [editor, setEditor] = useState<Editor | null>(null);

  // Persistence Callback
  const handleSaveContent = useCallback((text: string) => {
    if (activeChapterId) updateChapterContent(activeChapterId, text);
  }, [activeChapterId, updateChapterContent]);

  // History & Text Hook
  const { text: currentText, updateText, commit, history, restore, hasUnsavedChanges } = useDocumentHistory(
    activeChapter?.content || '', 
    activeChapterId, 
    handleSaveContent
  );

  // Selection State
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  
  // Tiptap provides 'from' as cursor position if empty selection
  const cursorPosition = editor?.state.selection.from || 0;

  const setSelectionState = useCallback((
      range: { start: number; end: number; text: string } | null, 
      pos: { top: number; left: number } | null
  ) => {
      setSelectionRange(range);
      setSelectionPos(pos);
  }, []);

  const clearSelection = useCallback(() => {
      setSelectionRange(null);
      setSelectionPos(null);
      editor?.commands.focus();
  }, [editor]);

  // UI State
  const [activeHighlight, setActiveHighlight] = useState<HighlightRange | null>(null);

  const handleNavigateToIssue = useCallback((start: number, end: number) => {
    setActiveHighlight({ start, end, type: 'issue' });
  }, []);

  const value: EditorContextValue = {
    editor,
    setEditor,
    currentText,
    updateText,
    commit,
    history,
    restore,
    hasUnsavedChanges,
    selectionRange,
    selectionPos,
    cursorPosition,
    setSelectionState,
    clearSelection,
    activeHighlight,
    handleNavigateToIssue
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};