import React, { useState } from 'react';
import { SidebarTab } from '../../types';
import { ProjectSidebar } from '../ProjectSidebar';
import { EditorWorkspace } from '../editor/EditorWorkspace';
import { useProjectStore } from '../../store/useProjectStore';
import { UploadLayout } from '../layouts/UploadLayout';
import { ChatInterface } from '../ChatInterface';
import { ActivityFeed } from '../ActivityFeed';
import { VoiceMode } from '../VoiceMode';
import { useManuscript } from '../../contexts/ManuscriptContext';
import { useDraftSmithEngine } from '../../hooks/useDraftSmithEngine';
import { Dashboard } from '../dashboard/Dashboard';
import { useManuscriptIndexer } from '../../hooks/useManuscriptIndexer';
import { Contradiction } from '../../types/schema';
import { UsageBadge } from '../UsageBadge';

// Nav Icons
const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Analysis: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Agent: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
  Mic: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Wand: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5l5 5"/><path d="M2.5 19.5l9.5-9.5"/><path d="M7 6l1 1"/><path d="M14 4l.5.5"/><path d="M17 7l-.5.5"/><path d="M4 9l.5.5"/></svg>
};

export const MainLayout: React.FC = () => {
  const { currentProject, getActiveChapter, activeChapterId, updateChapterAnalysis, updateProjectLore, chapters } = useProjectStore();
  const { currentText, commit, selectionRange, clearSelection, history, restore, editor } = useManuscript();

  // Engine Hooks
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

  // Background Indexing
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  useManuscriptIndexer(
    currentText,
    activeChapterId,
    (c) => setContradictions(prev => [...prev, ...c])
  );

  const activeChapter = getActiveChapter();

  // UI State
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);

  // If no project is selected, show Dashboard/Upload
  if (!currentProject) {
    return <UploadLayout />;
  }

  const editorContext = {
    cursorPosition: editor?.state.selection.from || 0,
    selection: selectionRange,
    totalLength: currentText.length
  };

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    setIsToolsCollapsed(false);
  };

  const handleHomeClick = () => {
     window.location.reload(); 
  };

  return (
    <div className="flex w-full h-full bg-[var(--parchment-200)] text-[var(--ink-800)] font-sans">
      
      {/* 1. Navigation Rail */}
      <nav className="w-16 bg-[var(--parchment-50)] border-r border-[var(--ink-100)] flex flex-col items-center py-6 gap-2 shrink-0 z-40">
        <button
          onClick={handleHomeClick}
          className="w-10 h-10 rounded-xl bg-[var(--ink-900)] text-[var(--magic-400)] flex items-center justify-center shadow-md mb-4 hover:scale-105 transition-transform"
          title="Library"
        >
          <Icons.Wand />
        </button>
        
        {[
          { tab: SidebarTab.ANALYSIS, icon: <Icons.Analysis />, label: "Analysis" },
          { tab: SidebarTab.CHAT, icon: <Icons.Agent />, label: "Agent" },
          { tab: SidebarTab.HISTORY, icon: <Icons.History />, label: "History" },
          { tab: SidebarTab.VOICE, icon: <Icons.Mic />, label: "Voice" }
        ].map(item => (
          <button
            key={item.tab}
            onClick={() => handleTabChange(item.tab)}
            title={item.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
              activeTab === item.tab 
                ? 'bg-[var(--magic-100)] text-[var(--magic-500)]' 
                : 'text-[var(--ink-400)] hover:bg-[var(--parchment-200)] hover:text-[var(--ink-600)]'
            }`}
          >
            {item.icon}
            {activeTab === item.tab && (
              <div className="absolute right-[-13px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--magic-400)] rounded-l-sm" />
            )}
          </button>
        ))}

        <div className="mt-auto mb-2">
            {/* Nav bottom placeholder */}
        </div>
      </nav>

      {/* 2. Chapter Sidebar */}
      {!isSidebarCollapsed && (
        <ProjectSidebar 
          collapsed={isSidebarCollapsed} 
          toggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
      )}

      {/* 3. Editor Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-2 bg-[var(--parchment-50)] border-b border-[var(--ink-100)]">
              <div className="flex items-center gap-4">
                  <UsageBadge />
              </div>
          </div>
          <EditorWorkspace 
            engineState={engine.state}
            engineActions={engine.actions}
            contradictions={contradictions}
          />
      </div>

      {/* 4. Tools Panel */}
      {!isToolsCollapsed && (
        <aside className="w-[380px] bg-[var(--parchment-50)] border-l border-[var(--ink-100)] flex flex-col shadow-xl z-30 shrink-0">
          <div className="h-14 border-b border-[var(--ink-100)] flex items-center px-5 bg-[var(--parchment-50)] shrink-0">
            <h3 className="text-[var(--text-sm)] font-semibold text-[var(--ink-600)] uppercase tracking-wide">
              {activeTab}
            </h3>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {activeTab === SidebarTab.ANALYSIS && (
              <Dashboard 
                 isLoading={engine.state.isAnalyzing}
                 analysis={activeChapter?.lastAnalysis || null}
                 currentText={currentText}
              />
            )}
            {activeTab === SidebarTab.CHAT && (
              <ChatInterface 
                editorContext={editorContext} 
                fullText={currentText} 
                onAgentAction={engine.actions.handleAgentAction} 
                lore={currentProject?.lore}
                chapters={chapters}
                analysis={activeChapter?.lastAnalysis}
              />
            )}
            {activeTab === SidebarTab.HISTORY && (
               <ActivityFeed 
                 history={history} 
                 onRestore={restore} 
                 onInspect={(item) => console.log('Inspect', item)} 
               />
            )}
            {activeTab === SidebarTab.VOICE && <VoiceMode />}
          </div>
        </aside>
      )}
    </div>
  );
};
