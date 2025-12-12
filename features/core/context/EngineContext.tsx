import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useEditor } from './EditorContext';
import { AgentActionHandler } from '@/types/agent';

import { useProjectStore } from '@/features/project';
import { useQuillAIEngine, type PendingDiff } from '@/features/shared/hooks/useDraftSmithEngine';
import { AnalysisWarning } from '@/types';
import { useManuscriptIndexer } from '@/features/shared/hooks/useManuscriptIndexer';
import { Contradiction } from '@/types/schema';

// Import split contexts for composition
import {
  MagicEditorProvider,
  type MagicEditorState,
  type MagicEditorActions,
} from './MagicEditorContext';
import {
  GrammarProvider,
  type GrammarState,
  type GrammarActions,
} from './GrammarContext';
import {
  AnalysisStatusProvider,
  type AnalysisStatusState,
  type AnalysisStatusActions,
} from './AnalysisStatusContext';

// Re-export split context hooks for direct access
export {
  useMagicEditorContext,
  useMagicEditorState,
  useMagicEditorActions,
  createEmptyMagicEditorState,
} from './MagicEditorContext';
export type { MagicEditorState, MagicEditorActions } from './MagicEditorContext';

export {
  useGrammarContext,
  useGrammarState,
  useGrammarActions,
  createEmptyGrammarState,
} from './GrammarContext';
export type { GrammarState, GrammarActions } from './GrammarContext';

export {
  useAnalysisStatusContext,
  useAnalysisStatusState,
  useAnalysisStatusActions,
  createEmptyAnalysisStatusState,
} from './AnalysisStatusContext';
export type { AnalysisStatusState, AnalysisStatusActions } from './AnalysisStatusContext';

/**
 * EngineContext
 * 
 * Provides global access to the AI Engine (Analysis, Magic Editor, Agents)
 * eliminating prop drilling through layout components.
 * 
 * Must be wrapped inside ManuscriptProvider (depends on currentText).
 */

export interface EngineState {
  isAnalyzing: boolean;
  analysisError?: string | null;
  analysisWarning?: AnalysisWarning | null;
  magicVariations: string[];
  activeMagicMode?: string | null;
  magicHelpResult?: string;
  magicHelpType?: 'Explain' | 'Thesaurus' | null;
  isMagicLoading: boolean;
  magicError?: string | null;
  isDreaming?: boolean;
  pendingDiff: PendingDiff | null;
  grammarSuggestions: import('@/types').GrammarSuggestion[];
  grammarHighlights: import('@/features/editor/hooks/useTiptapSync').HighlightItem[];
}

export interface EngineActions {
  runAnalysis: () => void;
  runSelectionAnalysis: () => void;
  cancelAnalysis: () => void;
  handleRewrite: (mode: string, tone?: string) => void;
  handleHelp: (type: 'Explain' | 'Thesaurus') => void;
  applyVariation: (text: string) => void;
  closeMagicBar: () => void;
  handleGrammarCheck: () => void;
  applyGrammarSuggestion: (id?: string | null) => void;
  applyAllGrammarSuggestions: () => void;
  dismissGrammarSuggestion: (id: string) => void;
  handleAgentAction: AgentActionHandler;
  acceptDiff: () => void;
  rejectDiff: () => void;
}

export interface EngineContextValue {
  state: EngineState;
  actions: EngineActions;
  contradictions: Contradiction[];
}

const EngineContext = createContext<EngineContextValue | undefined>(undefined);

export const EngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentText, commit, selectionRange, clearSelection } = useEditor();

  const { 
    currentProject, 
    activeChapterId, 
    updateChapterAnalysis, 
    updateProjectLore 
  } = useProjectStore((state) => ({
    currentProject: state.currentProject,
    activeChapterId: state.activeChapterId,
    updateChapterAnalysis: state.updateChapterAnalysis,
    updateProjectLore: state.updateProjectLore,
  }));

  // Initialize the Quill AI Engine
  const engine = useQuillAIEngine({
    getCurrentText: () => currentText,
    currentProject,
    activeChapterId,
    updateChapterAnalysis,
    updateProjectLore,
    commit,
    selectionRange,
    clearSelection
  });

  // Background Indexing for contradictions
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  
  const handleContradictions = useCallback((c: Contradiction[]) => {
    setContradictions(prev => [...prev, ...c]);
  }, []);

  useManuscriptIndexer(currentText, activeChapterId, handleContradictions);

  const value: EngineContextValue = useMemo(
    () => ({
      state: engine.state,
      actions: engine.actions,
      contradictions,
    }),
    [engine.state, engine.actions, contradictions],
  );

  // Build split context states for composition
  const magicEditorState: MagicEditorState = useMemo(() => ({
    magicVariations: engine.state.magicVariations,
    activeMagicMode: engine.state.activeMagicMode ?? null,
    magicHelpResult: engine.state.magicHelpResult ?? null,
    magicHelpType: engine.state.magicHelpType ?? null,
    isMagicLoading: engine.state.isMagicLoading,
    magicError: engine.state.magicError ?? null,
  }), [
    engine.state.magicVariations,
    engine.state.activeMagicMode,
    engine.state.magicHelpResult,
    engine.state.magicHelpType,
    engine.state.isMagicLoading,
    engine.state.magicError,
  ]);

  const magicEditorActions: MagicEditorActions = useMemo(() => ({
    handleRewrite: engine.actions.handleRewrite,
    handleHelp: engine.actions.handleHelp,
    applyVariation: engine.actions.applyVariation,
    closeMagicBar: engine.actions.closeMagicBar,
  }), [engine.actions]);

  const grammarState: GrammarState = useMemo(() => ({
    grammarSuggestions: engine.state.grammarSuggestions,
    grammarHighlights: engine.state.grammarHighlights,
  }), [engine.state.grammarSuggestions, engine.state.grammarHighlights]);

  const grammarActions: GrammarActions = useMemo(() => ({
    handleGrammarCheck: engine.actions.handleGrammarCheck,
    applyGrammarSuggestion: engine.actions.applyGrammarSuggestion,
    applyAllGrammarSuggestions: engine.actions.applyAllGrammarSuggestions,
    dismissGrammarSuggestion: engine.actions.dismissGrammarSuggestion,
  }), [engine.actions]);

  const analysisStatusState: AnalysisStatusState = useMemo(() => ({
    isAnalyzing: engine.state.isAnalyzing,
    analysisError: engine.state.analysisError ?? null,
    analysisWarning: engine.state.analysisWarning ?? null,
    isDreaming: engine.state.isDreaming ?? false,
    pendingDiff: engine.state.pendingDiff,
  }), [
    engine.state.isAnalyzing,
    engine.state.analysisError,
    engine.state.analysisWarning,
    engine.state.isDreaming,
    engine.state.pendingDiff,
  ]);

  const analysisStatusActions: AnalysisStatusActions = useMemo(() => ({
    runAnalysis: engine.actions.runAnalysis,
    runSelectionAnalysis: engine.actions.runSelectionAnalysis,
    cancelAnalysis: engine.actions.cancelAnalysis,
    handleAgentAction: engine.actions.handleAgentAction,
    acceptDiff: engine.actions.acceptDiff,
    rejectDiff: engine.actions.rejectDiff,
  }), [engine.actions]);

  return (
    <EngineContext.Provider value={value}>
      <MagicEditorProvider state={magicEditorState} actions={magicEditorActions}>
        <GrammarProvider state={grammarState} actions={grammarActions}>
          <AnalysisStatusProvider state={analysisStatusState} actions={analysisStatusActions}>
            {children}
          </AnalysisStatusProvider>
        </GrammarProvider>
      </MagicEditorProvider>
    </EngineContext.Provider>
  );
};

export const useEngine = (): EngineContextValue => {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
};

export default EngineContext;
