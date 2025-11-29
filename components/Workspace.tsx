import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { useProjectStore } from '../store/useProjectStore';
import { useDraftSmithEngine } from '../hooks/useDraftSmithEngine';
import { EditorLayout } from './layouts/EditorLayout';
import { SidebarTab } from '../types';

interface WorkspaceProps {
  onHomeClick: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onHomeClick }) => {
  const {
    textareaRef,
    backdropRef,
    currentText,
    updateText,
    commit,
    history,
    restore,
    selectionRange,
    selectionPos,
    handleSelectionChange,
    handleMouseUp,
    clearSelection,
    activeHighlight,
    setActiveHighlight,
    handleScroll,
    handleNavigateToIssue
  } = useEditor();

  const { 
    currentProject, 
    activeChapterId, 
    chapters,
    updateChapterAnalysis, 
    updateProjectLore,
    getActiveChapter 
  } = useProjectStore();

  const activeChapter = getActiveChapter();

  // Engine Layer
  const engine = useDraftSmithEngine({
    getCurrentText: () => currentText, 
    currentProject,
    activeChapterId,
    updateChapterAnalysis,
    updateProjectLore,
    commit,
    selectionRange,
    clearSelection
  });

  // View State
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    setIsToolsCollapsed(false);
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateText(e.target.value);
    if (activeHighlight) setActiveHighlight(null);
  };

  return (
    <EditorLayout 
      activeTab={activeTab} onTabChange={handleTabChange}
      isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      isToolsCollapsed={isToolsCollapsed} onToggleTools={() => setIsToolsCollapsed(!isToolsCollapsed)}
      onHomeClick={onHomeClick}
      currentProject={currentProject} activeChapter={activeChapter} chapters={chapters} currentText={currentText} history={history}
      textareaRef={textareaRef} backdropRef={backdropRef}
      onEditorChange={handleEditorChange} onDirectTextChange={updateText} onSelectionChange={handleSelectionChange} onMouseUp={handleMouseUp} onScroll={handleScroll}
      selectionRange={selectionRange} selectionPos={selectionPos} activeHighlight={activeHighlight}
      onNavigateToIssue={handleNavigateToIssue} onRestoreHistory={restore} onClearSelection={clearSelection}
      engineState={engine.state} engineActions={engine.actions}
    />
  );
};