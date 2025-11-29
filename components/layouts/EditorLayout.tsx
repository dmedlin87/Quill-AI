import React, { useState, useEffect } from 'react';
import { SidebarTab, AnalysisResult, EditorContext, HighlightRange, HistoryItem } from '../../types';
import { ProjectSidebar } from '../ProjectSidebar';
import { AnalysisPanel } from '../AnalysisPanel';
import { ChatInterface } from '../ChatInterface';
import { ActivityFeed } from '../ActivityFeed';
import { VoiceMode } from '../VoiceMode';
import { MagicBar } from '../MagicBar';
import { FindReplaceModal } from '../FindReplaceModal';
import { VisualDiff } from '../VisualDiff';
import { PendingDiff } from '../../hooks/useDraftSmithEngine';
import { Chapter } from '../../types/schema';

interface EditorLayoutProps {
  // Navigation State
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isToolsCollapsed: boolean;
  onToggleTools: () => void;
  onHomeClick: () => void;

  // Data & Content
  currentProject: any;
  activeChapter: any;
  chapters: Chapter[];
  currentText: string;
  history: HistoryItem[];

  // Editor Interaction
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  backdropRef: React.RefObject<HTMLDivElement>;
  onEditorChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onDirectTextChange: (text: string) => void;
  onSelectionChange: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  selectionRange: { start: number; end: number; text: string } | null;
  selectionPos: { top: number; left: number } | null;
  activeHighlight: HighlightRange | null;
  
  // Callbacks
  onNavigateToIssue: (start: number, end: number) => void;
  onRestoreHistory: (id: string) => void;
  onClearSelection: () => void;

  // Engine State & Actions
  engineState: {
    isAnalyzing: boolean;
    magicVariations: string[];
    magicHelpResult?: string;
    magicHelpType?: 'Explain' | 'Thesaurus' | null;
    isMagicLoading: boolean;
    pendingDiff: PendingDiff | null;
  };
  engineActions: {
    runAnalysis: () => void;
    handleRewrite: (mode: string, tone?: string) => void;
    handleHelp: (type: 'Explain' | 'Thesaurus') => void;
    applyVariation: (text: string) => void;
    closeMagicBar: () => void;
    handleAgentAction: (action: string, params: any) => Promise<string>;
    acceptDiff: () => void;
    rejectDiff: () => void;
  };
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
  activeTab, onTabChange,
  isSidebarCollapsed, onToggleSidebar,
  isToolsCollapsed, onToggleTools,
  onHomeClick,
  currentProject, activeChapter, chapters, currentText, history,
  textareaRef, backdropRef,
  onEditorChange, onDirectTextChange, onSelectionChange, onMouseUp, onScroll,
  selectionRange, selectionPos, activeHighlight,
  onNavigateToIssue, onRestoreHistory, onClearSelection,
  engineState, engineActions
}) => {

  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [viewingHistoryDiff, setViewingHistoryDiff] = useState<{original: string, modified: string, description: string} | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const editorContext: EditorContext = {
    cursorPosition: textareaRef.current?.selectionStart || 0,
    selection: selectionRange,
    totalLength: currentText.length
  };

  const handleInspectHistory = (item: HistoryItem) => {
    setViewingHistoryDiff({
        original: item.previousContent,
        modified: item.newContent,
        description: item.description
    });
  };

  const renderHighlights = () => {
    if (!activeHighlight) return currentText;
    const { start, end } = activeHighlight;
    const before = currentText.substring(0, start);
    const highlight = currentText.substring(start, end);
    const after = currentText.substring(end);
    
    const highlightClass = activeHighlight.type === 'issue'
        ? 'bg-purple-200/50 border-b-2 border-purple-400' 
        : 'bg-yellow-200/50 border-b-2 border-yellow-400';

    return <>{before}<span className={highlightClass}>{highlight}</span>{after}</>;
  };

  return (
    <div className="flex w-full h-full bg-[#f3f4f6]">
      {/* 1. Icon Navigation Rail */}
      <aside className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-4 z-40 shadow-sm shrink-0">
        <div 
          onClick={onHomeClick}
          className="p-2 mb-4 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 cursor-pointer hover:scale-105 transition-transform"
          title="Library"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </div>
        {[
          { tab: SidebarTab.ANALYSIS, icon: "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" },
          { tab: SidebarTab.CHAT, icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" },
          { tab: SidebarTab.HISTORY, icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
          { tab: SidebarTab.VOICE, icon: "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" }
        ].map(item => (
          <button 
            key={item.tab}
            onClick={() => onTabChange(item.tab)}
            className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === item.tab && !isToolsCollapsed ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
          </button>
        ))}
      </aside>

      {/* 2. Project Sidebar */}
      <ProjectSidebar 
        collapsed={isSidebarCollapsed} 
        toggleCollapsed={onToggleSidebar} 
      />

      {/* 3. Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#e5e7eb] relative">
        <header className="h-14 border-b border-gray-200/50 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-serif font-bold text-gray-800 text-lg">{activeChapter?.title || 'No Active Chapter'}</h2>
            {currentProject?.setting && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full ml-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {currentProject.setting.timePeriod} in {currentProject.setting.location}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsFindReplaceOpen(true)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
              title="Find & Replace (Ctrl+F)"
            >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
               </svg>
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <button 
              onClick={engineActions.runAnalysis} 
              disabled={engineState.isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200"
            >
              {engineState.isAnalyzing ? "Analyzing..." : "Deep Analysis"}
            </button>
            <button
              onClick={onToggleTools}
              className={`p-1.5 rounded-md hover:bg-gray-100 text-gray-500 ${isToolsCollapsed ? 'rotate-180' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 relative" onClick={onClearSelection}>
          <div className="max-w-3xl mx-auto bg-white min-h-[calc(100vh-8rem)] shadow-2xl rounded-sm border border-gray-200/50 paper-shadow relative" onClick={(e) => e.stopPropagation()}>
            <FindReplaceModal 
              isOpen={isFindReplaceOpen} 
              onClose={() => setIsFindReplaceOpen(false)}
              currentText={currentText}
              onTextChange={onDirectTextChange}
              textareaRef={textareaRef}
            />
            
            <div className="relative p-12 md:p-16">
              {/* Backdrop for Highlights */}
              <div 
                ref={backdropRef}
                className="absolute top-0 left-0 right-0 bottom-0 p-12 md:p-16 pointer-events-none overflow-hidden whitespace-pre-wrap font-serif text-xl leading-loose text-transparent z-0"
                aria-hidden="true"
              >
                {renderHighlights()}
              </div>

              {/* Actual Editor */}
              <textarea 
                ref={textareaRef}
                className="relative z-10 w-full min-h-[60vh] resize-none outline-none border-none bg-transparent font-serif text-gray-800 text-xl leading-loose placeholder-gray-300 block overflow-hidden whitespace-pre-wrap"
                value={currentText}
                onChange={onEditorChange}
                onSelect={onSelectionChange}
                onMouseUp={onMouseUp}
                onKeyUp={onSelectionChange}
                onClick={onSelectionChange}
                onScroll={onScroll}
                placeholder="Select a chapter and start writing..."
                spellCheck={false}
              />
            </div>
            {selectionRange && selectionPos && (
              <MagicBar 
                isLoading={engineState.isMagicLoading} 
                variations={engineState.magicVariations} 
                helpResult={engineState.magicHelpResult}
                helpType={engineState.magicHelpType}
                onRewrite={engineActions.handleRewrite}
                onHelp={engineActions.handleHelp}
                onApply={engineActions.applyVariation}
                onClose={engineActions.closeMagicBar}
                position={selectionPos}
              />
            )}
          </div>
          <div className="h-16"></div>
        </div>

        {/* Global Review Modal (Agent) */}
        {engineState.pendingDiff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                         </svg>
                     </div>
                     <div>
                        <h3 className="font-serif font-bold text-gray-800">Review Agent Suggestions</h3>
                        <p className="text-xs text-gray-500">The agent has proposed changes to your manuscript.</p>
                     </div>
                 </div>
                 <button onClick={engineActions.rejectDiff} className="text-gray-400 hover:text-gray-600">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-white relative">
                 <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1 block">Agent Note</span>
                    <p className="text-indigo-900 text-sm font-medium">{engineState.pendingDiff.description}</p>
                 </div>
                 
                 <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-inner min-h-[200px]">
                    <VisualDiff original={engineState.pendingDiff.original} modified={engineState.pendingDiff.modified} />
                 </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                 <button 
                    onClick={engineActions.rejectDiff} 
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-white hover:border-gray-400 hover:shadow-sm transition-all"
                 >
                    Reject Changes
                 </button>
                 <button 
                    onClick={engineActions.acceptDiff} 
                    className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-xl transition-all flex items-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    Accept Changes
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Global History Diff Modal (Read Only) */}
        {viewingHistoryDiff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                         </svg>
                     </div>
                     <div>
                        <h3 className="font-serif font-bold text-gray-800">Change History</h3>
                        <p className="text-xs text-gray-500">Comparing version state.</p>
                     </div>
                 </div>
                 <button onClick={() => setViewingHistoryDiff(null)} className="text-gray-400 hover:text-gray-600">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-white relative">
                 <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-lg">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Change Description</span>
                    <p className="text-gray-900 text-sm font-medium">{viewingHistoryDiff.description}</p>
                 </div>
                 
                 <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-inner min-h-[200px]">
                    <VisualDiff original={viewingHistoryDiff.original} modified={viewingHistoryDiff.modified} />
                 </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                 <button 
                    onClick={() => setViewingHistoryDiff(null)} 
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-white hover:border-gray-400 hover:shadow-sm transition-all"
                 >
                    Close
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Right Tools Panel */}
      {!isToolsCollapsed && (
        <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-30 shrink-0">
          <div className="h-14 border-b border-gray-100 flex items-center px-4 bg-gray-50/50 shrink-0">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              {activeTab === SidebarTab.ANALYSIS && "Analysis Report"}
              {activeTab === SidebarTab.CHAT && "Editor Agent"}
              {activeTab === SidebarTab.HISTORY && "History"}
              {activeTab === SidebarTab.VOICE && "Live Session"}
            </h3>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {activeTab === SidebarTab.ANALYSIS && (
              <AnalysisPanel 
                analysis={activeChapter?.lastAnalysis || null} 
                isLoading={engineState.isAnalyzing} 
                currentText={currentText}
                onNavigate={onNavigateToIssue} 
              />
            )}
            {activeTab === SidebarTab.CHAT && (
              <ChatInterface 
                editorContext={editorContext} 
                fullText={currentText} 
                onAgentAction={engineActions.handleAgentAction} 
                lore={currentProject?.lore}
                chapters={chapters}
                analysis={activeChapter?.lastAnalysis}
              />
            )}
            {activeTab === SidebarTab.HISTORY && (
              <ActivityFeed 
                history={history} 
                onRestore={onRestoreHistory} 
                onInspect={handleInspectHistory} 
              />
            )}
            {activeTab === SidebarTab.VOICE && (
              <VoiceMode />
            )}
          </div>
        </div>
      )}
    </div>
  );
};