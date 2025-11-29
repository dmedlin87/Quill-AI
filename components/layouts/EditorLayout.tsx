import React, { useState, useEffect, useMemo } from 'react';
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
import { Chapter, Contradiction } from '../../types/schema';
import { RichTextEditor } from '../RichTextEditor';
import { Editor } from '@tiptap/react';
import { findQuoteRange } from '../../utils/textLocator';

interface EditorLayoutProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isToolsCollapsed: boolean;
  onToggleTools: () => void;
  onHomeClick: () => void;
  currentProject: any;
  activeChapter: any;
  chapters: Chapter[];
  currentText: string;
  history: HistoryItem[];
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  onDirectTextChange: (text: string) => void;
  setSelectionState: (range: { start: number; end: number; text: string } | null, pos: { top: number; left: number } | null) => void;
  selectionRange: { start: number; end: number; text: string } | null;
  selectionPos: { top: number; left: number } | null;
  activeHighlight: HighlightRange | null;
  onNavigateToIssue: (start: number, end: number) => void;
  onRestoreHistory: (id: string) => void;
  onClearSelection: () => void;
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
  contradictions?: Contradiction[];
}

// Nav Icons
const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Analysis: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Agent: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
  Mic: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Wand: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5l5 5"/><path d="M2.5 19.5l9.5-9.5"/><path d="M7 6l1 1"/><path d="M14 4l.5.5"/><path d="M17 7l-.5.5"/><path d="M4 9l.5.5"/></svg>
};

export const EditorLayout: React.FC<EditorLayoutProps> = ({
  activeTab, onTabChange,
  isSidebarCollapsed, onToggleSidebar,
  isToolsCollapsed, onToggleTools,
  onHomeClick,
  currentProject, activeChapter, chapters, currentText, history,
  editor, setEditor,
  onDirectTextChange, setSelectionState,
  selectionRange, selectionPos, activeHighlight,
  onNavigateToIssue, onRestoreHistory, onClearSelection,
  engineState, engineActions,
  contradictions = []
}) => {
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [viewingHistoryDiff, setViewingHistoryDiff] = useState<{original: string, modified: string, description: string} | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const editorContext: EditorContext = {
    cursorPosition: editor?.state.selection.from || 0,
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

  const analysisHighlights = useMemo(() => {
    const highlights: Array<{start: number; end: number; color: string; title: string}> = [];
    const analysis: AnalysisResult = activeChapter?.lastAnalysis;
    if (analysis) {
        analysis.plotIssues?.forEach(issue => {
            if (issue.quote) {
                const range = findQuoteRange(currentText, issue.quote);
                if (range) highlights.push({ ...range, color: 'var(--error-500)', title: issue.issue });
            }
        });
        analysis.pacing?.slowSections?.forEach(section => {
            const range = findQuoteRange(currentText, section);
            if (range) highlights.push({ ...range, color: 'var(--warning-500)', title: 'Slow Pacing' });
        });
        analysis.settingAnalysis?.issues?.forEach(issue => {
            const range = findQuoteRange(currentText, issue.quote);
            if (range) highlights.push({ ...range, color: 'var(--magic-500)', title: issue.issue });
        });
    }
    return highlights;
  }, [activeChapter, currentText, contradictions]);

  return (
    <div className="flex w-full h-full bg-[var(--parchment-200)] text-[var(--ink-800)] font-sans">
      
      {/* 1. Navigation Rail (Leftmost) */}
      <nav className="w-16 bg-[var(--parchment-50)] border-r border-[var(--ink-100)] flex flex-col items-center py-6 gap-2 shrink-0 z-40">
        <button
          onClick={onHomeClick}
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
            onClick={() => onTabChange(item.tab)}
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
      </nav>

      {/* 2. Chapter Sidebar */}
      {!isSidebarCollapsed && (
        <ProjectSidebar 
          collapsed={isSidebarCollapsed} 
          toggleCollapsed={onToggleSidebar} 
        />
      )}

      {/* 3. Editor Surface (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--parchment-200)] relative">
        <header className="h-14 border-b border-[var(--ink-100)] flex items-center justify-between px-6 bg-[var(--parchment-50)] shrink-0">
           <div className="flex items-center gap-3">
             <h2 className="font-serif font-medium text-[var(--text-lg)] text-[var(--ink-900)]">
               {activeChapter?.title || 'No Active Chapter'}
             </h2>
             {currentProject?.setting && (
               <span className="text-[var(--text-xs)] px-2 py-0.5 rounded bg-[var(--magic-100)] text-[var(--magic-500)] font-medium">
                 {currentProject.setting.timePeriod} • {currentProject.setting.location}
               </span>
             )}
           </div>
           
           <div className="flex items-center gap-4">
              <span className="text-[var(--text-sm)] text-[var(--ink-400)] font-medium">
                 {currentText.split(/\s+/).filter(w => w.length > 0).length} words
              </span>
              <button 
                onClick={engineActions.runAnalysis}
                disabled={engineState.isAnalyzing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ink-900)] text-[var(--parchment-50)] text-[var(--text-sm)] font-medium hover:bg-[var(--ink-800)] disabled:opacity-70 transition-colors shadow-sm"
              >
                {engineState.isAnalyzing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Icons.Wand />}
                Deep Analysis
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative" onClick={onClearSelection}>
           <div className="max-w-3xl mx-auto min-h-[calc(100vh-10rem)] relative" onClick={(e) => e.stopPropagation()}>
             <FindReplaceModal 
                isOpen={isFindReplaceOpen} 
                onClose={() => setIsFindReplaceOpen(false)}
                currentText={currentText}
                onTextChange={onDirectTextChange}
                editor={editor}
              />
              
              <RichTextEditor 
                key={activeChapter?.id || 'editor'}
                content={currentText}
                onUpdate={onDirectTextChange}
                onSelectionChange={setSelectionState}
                setEditorRef={setEditor}
                activeHighlight={activeHighlight}
                analysisHighlights={analysisHighlights}
              />

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
        </div>
      </div>

      {/* 4. Right Panel (Tools) */}
      {!isToolsCollapsed && (
        <aside className="w-[380px] bg-[var(--parchment-50)] border-l border-[var(--ink-100)] flex flex-col shadow-xl z-30 shrink-0">
          <div className="h-14 border-b border-[var(--ink-100)] flex items-center px-5 bg-[var(--parchment-50)] shrink-0">
            <h3 className="text-[var(--text-sm)] font-semibold text-[var(--ink-600)] uppercase tracking-wide">
              {activeTab}
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
            {activeTab === SidebarTab.VOICE && <VoiceMode />}
          </div>
        </aside>
      )}

      {/* Diff Modals (Keep existing logic, update styles slightly) */}
      {engineState.pendingDiff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink-900)]/60 backdrop-blur-sm p-4 animate-fade-in">
             {/* ...existing diff modal with updated colors... */}
             <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
                 <div className="p-4 border-b border-[var(--ink-100)] flex justify-between items-center bg-[var(--parchment-50)]">
                     <h3 className="font-serif font-bold text-[var(--ink-800)]">Review Agent Suggestions</h3>
                     <button onClick={engineActions.rejectDiff} className="text-[var(--ink-400)] hover:text-[var(--ink-600)]"><Icons.Home /></button> 
                     {/* Used Home icon as temporary placeholder for X or close */}
                 </div>
                 <div className="flex-1 overflow-y-auto p-6 bg-white">
                     <VisualDiff original={engineState.pendingDiff.original} modified={engineState.pendingDiff.modified} />
                 </div>
                 <div className="p-4 border-t border-[var(--ink-100)] bg-[var(--parchment-50)] flex justify-end gap-3">
                     <button onClick={engineActions.rejectDiff} className="px-4 py-2 rounded-lg border border-[var(--ink-200)] text-[var(--ink-600)] hover:bg-[var(--parchment-100)]">Reject</button>
                     <button onClick={engineActions.acceptDiff} className="px-4 py-2 rounded-lg bg-[var(--ink-900)] text-[var(--parchment-50)] hover:bg-[var(--ink-800)]">Accept</button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};