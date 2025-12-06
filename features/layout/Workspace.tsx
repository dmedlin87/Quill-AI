import React, { useCallback, useState } from 'react';
import { EditorLayout } from '@/features/layout/EditorLayout';
import { SidebarTab } from '@/types';

interface WorkspaceProps {
  onHomeClick: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onHomeClick }) => {
  // View State only; all editor/project/engine data now come from contexts in EditorLayout
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);

  const handleTabChange = useCallback((tab: SidebarTab) => {
    setActiveTab(tab);
    setIsToolsCollapsed(false);
  }, []);

  const handleToggleSidebar = useCallback(
    () => setIsSidebarCollapsed((prev) => !prev),
    []
  );

  const handleToggleTools = useCallback(
    () => setIsToolsCollapsed((prev) => !prev),
    []
  );

  return (
    <EditorLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      isSidebarCollapsed={isSidebarCollapsed}
      onToggleSidebar={handleToggleSidebar}
      isToolsCollapsed={isToolsCollapsed}
      onToggleTools={handleToggleTools}
      onHomeClick={onHomeClick}
    />
  );
};