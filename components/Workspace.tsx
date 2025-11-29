import React, { useState } from 'react';
import { useManuscript } from '../contexts/ManuscriptContext';
import { useProjectStore } from '../store/useProjectStore';
import { useDraftSmithEngine } from '../hooks/useDraftSmithEngine';
import { useManuscriptIndexer } from '../hooks/useManuscriptIndexer';
import { EditorLayout } from './layouts/EditorLayout';
import { SidebarTab } from '../types';
import { Contradiction } from '../types/schema';

interface WorkspaceProps {
  onHomeClick: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onHomeClick }) => {
  const {
    editor,
    setEditor,
    currentText,
    updateText,
    commit,
    history,
    restore,
    selectionRange,
    selectionPos,
    setSelectionState,
    clearSelection,
    activeHighlight,
    handleNavigateToIssue
  } = useManuscript();

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

  // Background Indexing for Contradictions
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  useManuscriptIndexer(
    currentText,
    activeChapterId,
    (c) => setContradictions(prev => [...prev, ...c])
  );

  // View State
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    setIsToolsCollapsed(false);
  };

  return (
    <EditorLayout 
      activeTab={activeTab} onTabChange={handleTabChange}
      isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      isToolsCollapsed={isToolsCollapsed} onToggleTools={() => setIsToolsCollapsed(!isToolsCollapsed)}
      onHomeClick={onHomeClick}
      currentProject={currentProject} activeChapter={activeChapter} chapters={chapters} currentText={currentText} history={history}
      editor={editor} setEditor={setEditor}
      onDirectTextChange={updateText} setSelectionState={setSelectionState}
      selectionRange={selectionRange} selectionPos={selectionPos} activeHighlight={activeHighlight}
      onNavigateToIssue={handleNavigateToIssue} onRestoreHistory={restore} onClearSelection={clearSelection}
      engineState={engine.state} engineActions={engine.actions}
      contradictions={contradictions}
    />
  );
};