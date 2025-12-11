import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarTab, AnalysisWarning } from '@/types';
import { ChatInterface, ActivityFeed } from '@/features/agent';
import { Dashboard } from '@/features/analysis';
import { VoiceMode } from '@/features/voice';
import { KnowledgeGraph, LoreManager } from '@/features/lore';
import { MemoryManager } from '@/features/memory';
import { StoryVersionsPanel } from '@/features/editor';
import { Branch, Contradiction, Lore } from '@/types/schema';
import { useLayoutStore } from './store/useLayoutStore';
import { DeveloperModeToggle, ThemeSelector, ModelBuildSelector, ApiKeyManager } from '@/features/settings';
import { RelevanceTuning } from '@/features/settings/components/RelevanceTuning';
import { DesignSystemKitchenSink } from '@/features/shared/components/DesignSystemKitchenSink';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';

interface ToolsPanelProps {
  isZenMode: boolean;
  // Data props
  currentText: string;
  editorContext: {
    cursorPosition: number;
    selection: { start: number; end: number; text: string } | null;
    totalLength: number;
  };
  // Project data
  projectId?: string;
  lore?: any;
  chapters?: any[];
  analysis?: any;
  contradictions?: Contradiction[];
  derivedLore?: Lore | null;
  history: any[];
  // Engine state
  isAnalyzing: boolean;
  analysisWarning?: AnalysisWarning | null;
  onAnalyzeSelection?: () => void;
  hasSelection?: boolean;
  // Callbacks
  onAgentAction: (action: string, params: any) => Promise<string>;
  onNavigateToText?: (start: number, end: number) => void;
  onRestore: (item: any) => void;
  // Branching/Story Versions
  branches?: Branch[];
  activeBranchId?: string | null;
  chapterTitle?: string;
  onCreateBranch?: (name: string) => void;
  onSwitchBranch?: (branchId: string | null) => void;
  onMergeBranch?: (branchId: string) => void;
  onDeleteBranch?: (branchId: string) => void;
  onRenameBranch?: (branchId: string, newName: string) => void;
}

/**
 * ToolsPanel - The right sidebar containing contextual tools.
 * Renders different content based on activeTab from layout store.
 */
export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isZenMode,
  currentText,
  editorContext,
  projectId,
  lore,
  chapters,
  analysis,
  contradictions,
  derivedLore,
  history,
  isAnalyzing,
  analysisWarning,
  onAnalyzeSelection,
  hasSelection,
  onAgentAction,
  onNavigateToText,
  onRestore,
  // Branching/Story Versions
  branches,
  activeBranchId,
  chapterTitle,
  onCreateBranch,
  onSwitchBranch,
  onMergeBranch,
  onDeleteBranch,
  onRenameBranch,
}) => {
  const {
    activeTab,
    isToolsCollapsed,
    chatInitialMessage,
    interviewTarget,
    loreDraftCharacter,
    consumeLoreDraft,
    clearChatInitialMessage,
    exitInterview,
    handleFixRequest,
    handleSelectGraphCharacter,
    handleInterviewCharacter,
    toolsPanelWidth,
    isToolsPanelExpanded,
    setToolsPanelWidth,
    toggleToolsPanelExpanded,
  } = useLayoutStore((state) => ({
    activeTab: state.activeTab,
    isToolsCollapsed: state.isToolsCollapsed,
    chatInitialMessage: state.chatInitialMessage,
    interviewTarget: state.interviewTarget,
    loreDraftCharacter: state.loreDraftCharacter,
    consumeLoreDraft: state.consumeLoreDraft,
    clearChatInitialMessage: state.clearChatInitialMessage,
    exitInterview: state.exitInterview,
    handleFixRequest: state.handleFixRequest,
    handleSelectGraphCharacter: state.handleSelectGraphCharacter,
    handleInterviewCharacter: state.handleInterviewCharacter,
    toolsPanelWidth: state.toolsPanelWidth,
    isToolsPanelExpanded: state.isToolsPanelExpanded,
    setToolsPanelWidth: state.setToolsPanelWidth,
    toggleToolsPanelExpanded: state.toggleToolsPanelExpanded,
  }));

  // Resize handling
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: toolsPanelWidth };
  }, [toolsPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      setToolsPanelWidth(resizeRef.current.startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setToolsPanelWidth]);

  const isDeveloperMode = useSettingsStore((state) => state.developerModeEnabled);

  const shouldShow = !isToolsCollapsed && !isZenMode;
  const panelWidth = isToolsPanelExpanded ? '100%' : toolsPanelWidth;

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.aside
          initial={{ width: 0, opacity: 0, x: 50 }}
          animate={{ width: panelWidth, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`glass-strong border-l-0 flex flex-col z-30 shrink-0 overflow-hidden ${isToolsPanelExpanded ? 'fixed inset-0 z-50' : 'relative'} ${isResizing ? 'select-none' : ''}`}
          role="complementary"
          aria-label={`${activeTab} panel`}
        >
          {/* Resize Handle */}
          {!isToolsPanelExpanded && (
            <div
              onMouseDown={handleResizeStart}
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[var(--interactive-accent)] transition-colors z-10 ${isResizing ? 'bg-[var(--interactive-accent)]' : 'bg-transparent hover:bg-[var(--interactive-accent)]/50'}`}
              title="Drag to resize"
            />
          )}
          {/* Panel Header */}
          <div className="h-14 border-b border-[var(--glass-border)] flex items-center justify-between px-5 shrink-0">
            <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              {activeTab}
            </h3>
            <div className="flex items-center gap-2">
              {/* Expand/Collapse Button */}
              <button
                onClick={toggleToolsPanelExpanded}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--text-secondary)] transition-colors"
                title={isToolsPanelExpanded ? 'Exit fullscreen' : 'Expand to fullscreen'}
                aria-label={isToolsPanelExpanded ? 'Exit fullscreen' : 'Expand to fullscreen'}
              >
                {isToolsPanelExpanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06L5.44 6.5H2.75a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69L3.28 2.22zM12 7.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-2.69l3.22 3.22a.75.75 0 11-1.06 1.06L13.5 9.06v2.69a.75.75 0 01-1.5 0v-4.5zM3.28 17.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 101.06 1.06zM12.75 12.75a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-2.69l-3.22 3.22a.75.75 0 01-1.06-1.06l3.22-3.22H8.25a.75.75 0 010-1.5h4.5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M13.28 2.22a.75.75 0 00-1.06 1.06L14.94 6H12.75a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.19l-2.72-2.72zM2.75 12.75a.75.75 0 000 1.5h2.19l-2.72 2.72a.75.75 0 101.06 1.06L6 15.31v2.19a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5z" />
                  </svg>
                )}
              </button>
              <DeveloperModeToggle />
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === SidebarTab.ANALYSIS && (
              <Dashboard
                isLoading={isAnalyzing}
                analysis={analysis}
                currentText={currentText}
                onFixRequest={handleFixRequest}
                warning={analysisWarning}
                onAnalyzeSelection={onAnalyzeSelection}
                hasSelection={hasSelection}
                contradictions={contradictions}
                derivedLore={derivedLore}
                onNavigateToText={onNavigateToText}
              />
            )}

            {activeTab === SidebarTab.CHAT && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden">
                  <ChatInterface
                    editorContext={editorContext}
                    fullText={currentText}
                    onAgentAction={onAgentAction}
                    lore={lore}
                    chapters={chapters}
                    analysis={analysis}
                    initialMessage={chatInitialMessage}
                    onInitialMessageProcessed={clearChatInitialMessage}
                    interviewTarget={interviewTarget}
                    onExitInterview={exitInterview}
                    projectId={projectId}
                  />
                </div>
                {/* Collapsible Tuning Panel could go here or within ChatInterface.
                    For now, I'll assume we want it accessible in Settings or a specific panel.
                    However, the request was "In the Settings panel".
                    Since I don't see a dedicated "Settings Panel", I will not embed it here directly.
                    Wait, ChatInterface has ExperienceSelector and CritiqueIntensitySelector.
                */}
              </div>
            )}

            {activeTab === SidebarTab.HISTORY && (
              <ActivityFeed
                history={history}
                onRestore={onRestore}
                onInspect={(item) => console.log('Inspect', item)}
              />
            )}

            {activeTab === SidebarTab.MEMORY && (
              <MemoryManager projectId={projectId} />
            )}

            {activeTab === SidebarTab.VOICE && <VoiceMode />}

            {activeTab === SidebarTab.GRAPH && (
              <KnowledgeGraph onSelectCharacter={handleSelectGraphCharacter} />
            )}

            {activeTab === SidebarTab.LORE && (
              <LoreManager
                onInterviewCharacter={handleInterviewCharacter}
                draftCharacter={loreDraftCharacter}
                onDraftConsumed={consumeLoreDraft}
              />
            )}

            {activeTab === SidebarTab.BRANCHES && (
              <StoryVersionsPanel
                branches={branches || []}
                activeBranchId={activeBranchId ?? null}
                mainContent={currentText}
                chapterTitle={chapterTitle}
                onCreateBranch={onCreateBranch || (() => {})}
                onSwitchBranch={onSwitchBranch || (() => {})}
                onMergeBranch={onMergeBranch || (() => {})}
                onDeleteBranch={onDeleteBranch || (() => {})}
                onRenameBranch={onRenameBranch || (() => {})}
              />
            )}

            {activeTab === SidebarTab.SETTINGS && (
              <div className="h-full overflow-y-auto">
                <div className="p-5 space-y-8 animate-fade-in">
                  <header>
                    <h2 className="text-[var(--text-lg)] font-serif font-medium text-[var(--text-primary)] mb-1">Settings</h2>
                    <p className="text-[var(--text-sm)] text-[var(--text-muted)]">Customize your creative environment.</p>
                  </header>

                  <section>
                    <ThemeSelector />
                  </section>

                  <section className="pt-6 border-t border-[var(--border-secondary)]">
                    <ModelBuildSelector />
                  </section>

                  <section className="pt-6 border-t border-[var(--border-secondary)]">
                    <ApiKeyManager />
                  </section>
                  
                  {isDeveloperMode && (
                    <section className="pt-8 border-t border-[var(--border-secondary)]">
                       <DesignSystemKitchenSink />
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
