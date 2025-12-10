import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarTab, AnalysisWarning } from '@/types';
import { ChatInterface, ActivityFeed } from '@/features/agent';
import { Dashboard } from '@/features/analysis';
import { VoiceMode } from '@/features/voice';
import { KnowledgeGraph, LoreManager } from '@/features/lore';
import { MemoryManager } from '@/features/memory';
import { Contradiction, Lore } from '@/types/schema';
import { useLayoutStore } from './store/useLayoutStore';
import { DeveloperModeToggle, ThemeSelector } from '@/features/settings';
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
  }));

  const isDeveloperMode = useSettingsStore((state) => state.developerModeEnabled);

  const shouldShow = !isToolsCollapsed && !isZenMode;

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.aside
          initial={{ width: 0, opacity: 0, x: 50 }}
          animate={{ width: 380, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass-strong border-l-0 flex flex-col z-30 shrink-0 overflow-hidden"
          role="complementary"
          aria-label={`${activeTab} panel`}
        >
          {/* Panel Header */}
          <div className="h-14 border-b border-[var(--glass-border)] flex items-center justify-between px-5 shrink-0">
            <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              {activeTab}
            </h3>
            <DeveloperModeToggle />
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
