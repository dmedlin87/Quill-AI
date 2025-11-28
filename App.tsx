import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, SidebarTab, HighlightRange } from './types';
import { UploadLayout } from './components/layouts/UploadLayout';
import { EditorLayout } from './components/layouts/EditorLayout';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import { useTextSelection } from './hooks/useTextSelection';
import { useAutoResize } from './hooks/useAutoResize';
import { useProjectStore } from './store/useProjectStore';
import { useDraftSmithEngine } from './hooks/useDraftSmithEngine';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.UPLOAD);
  
  // 1. Data Layer
  const { init: initStore, currentProject, activeChapterId, updateChapterContent, updateChapterAnalysis, getActiveChapter, isLoading: isStoreLoading } = useProjectStore();
  const activeChapter = getActiveChapter();

  useEffect(() => { initStore(); }, [initStore]);
  useEffect(() => { setMode(currentProject ? AppMode.EDITOR : AppMode.UPLOAD); }, [currentProject]);

  const handleSaveContent = useCallback((text: string) => {
    if (activeChapterId) updateChapterContent(activeChapterId, text);
  }, [activeChapterId, updateChapterContent]);

  const { text: currentText, updateText, commit, history, restore } = useDocumentHistory(activeChapter?.content || '', activeChapterId, handleSaveContent);

  // 2. Interaction Layer
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { selection: selectionRange, position: selectionPos, handleSelectionChange, handleMouseUp, clearSelection } = useTextSelection(textareaRef);
  useAutoResize(textareaRef, currentText, mode);

  // 3. Engine Layer (Business Logic)
  const engine = useDraftSmithEngine({
    currentText,
    currentProject,
    activeChapterId,
    updateChapterAnalysis,
    commit,
    selectionRange,
    clearSelection
  });

  // 4. View State
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<HighlightRange | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleNavigateToIssue = (start: number, end: number) => {
    setActiveHighlight({ start, end, type: 'issue' });
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start, end);
      const lineHeight = 32;
      const lines = currentText.substring(0, start).split('\n').length;
      textareaRef.current.scrollTop = Math.max(0, (lines - 1) * lineHeight - 100);
      if (backdropRef.current) backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateText(e.target.value);
    if (activeHighlight) setActiveHighlight(null);
  };

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    setIsToolsCollapsed(false);
  };

  if (isStoreLoading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-indigo-600"><p>Loading...</p></div>;

  return mode === AppMode.UPLOAD ? <UploadLayout /> : (
    <EditorLayout 
      activeTab={activeTab} onTabChange={handleTabChange}
      isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      isToolsCollapsed={isToolsCollapsed} onToggleTools={() => setIsToolsCollapsed(!isToolsCollapsed)}
      onHomeClick={() => setMode(AppMode.UPLOAD)}
      currentProject={currentProject} activeChapter={activeChapter} currentText={currentText} history={history}
      textareaRef={textareaRef} backdropRef={backdropRef}
      onEditorChange={handleEditorChange} onDirectTextChange={updateText} onSelectionChange={handleSelectionChange} onMouseUp={handleMouseUp} onScroll={handleScroll}
      selectionRange={selectionRange} selectionPos={selectionPos} activeHighlight={activeHighlight}
      onNavigateToIssue={handleNavigateToIssue} onRestoreHistory={restore} onClearSelection={clearSelection}
      engineState={engine.state} engineActions={engine.actions}
    />
  );
};

export default App;