import React, { createContext, useContext, useRef, useCallback, useState, RefObject } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDocumentHistory } from '../hooks/useDocumentHistory';
import { useTextSelection } from '../hooks/useTextSelection';
import { useAutoResize } from '../hooks/useAutoResize';
import { HistoryItem, HighlightRange } from '../types';

export interface EditorContextValue {
  // Refs
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  backdropRef: RefObject<HTMLDivElement | null>;

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
  handleSelectionChange: () => void;
  handleMouseUp: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  clearSelection: () => void;

  // UI State
  activeHighlight: HighlightRange | null;
  setActiveHighlight: (range: HighlightRange | null) => void;
  handleScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
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

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

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

  // Selection Hook
  const { 
    selection: selectionRange, 
    position: selectionPos, 
    cursorPosition,
    handleSelectionChange, 
    handleMouseUp, 
    clearSelection 
  } = useTextSelection(textareaRef);

  // Auto Resize Hook
  useAutoResize(textareaRef, currentText, 'EDITOR');

  // UI State
  const [activeHighlight, setActiveHighlight] = useState<HighlightRange | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleNavigateToIssue = useCallback((start: number, end: number) => {
    setActiveHighlight({ start, end, type: 'issue' });
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start, end);
      const lineHeight = 32;
      const lines = currentText.substring(0, start).split('\n').length;
      textareaRef.current.scrollTop = Math.max(0, (lines - 1) * lineHeight - 100);
      if (backdropRef.current) backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [currentText]);

  const value: EditorContextValue = {
    textareaRef,
    backdropRef,
    currentText,
    updateText,
    commit,
    history,
    restore,
    hasUnsavedChanges,
    selectionRange,
    selectionPos,
    cursorPosition,
    handleSelectionChange,
    handleMouseUp,
    clearSelection,
    activeHighlight,
    setActiveHighlight,
    handleScroll,
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