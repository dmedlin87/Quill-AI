/**
 * AnalysisStatusContext
 *
 * Focused context for analysis status state and actions.
 * Split from EngineContext for improved testability and selective re-renders.
 */

import { createContext, useContext, useMemo } from 'react';
import { AnalysisWarning } from '@/types';
import { PendingDiff } from '@/features/shared/hooks/useDraftSmithEngine';

export interface AnalysisStatusState {
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisWarning: AnalysisWarning | null;
  isDreaming: boolean;
  pendingDiff: PendingDiff | null;
}

export interface AnalysisStatusActions {
  runAnalysis: () => void;
  runSelectionAnalysis: () => void;
  cancelAnalysis: () => void;
  handleAgentAction: (action: string, params: any) => Promise<string>;
  acceptDiff: () => void;
  rejectDiff: () => void;
}

export interface AnalysisStatusContextValue {
  state: AnalysisStatusState;
  actions: AnalysisStatusActions;
}

const AnalysisStatusContext = createContext<AnalysisStatusContextValue | undefined>(undefined);

export interface AnalysisStatusProviderProps {
  children: React.ReactNode;
  state: AnalysisStatusState;
  actions: AnalysisStatusActions;
}

/**
 * Provider for Analysis Status context.
 * Can be used standalone or composed within EngineProvider.
 */
export const AnalysisStatusProvider: React.FC<AnalysisStatusProviderProps> = ({
  children,
  state,
  actions,
}) => {
  const value = useMemo<AnalysisStatusContextValue>(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <AnalysisStatusContext.Provider value={value}>
      {children}
    </AnalysisStatusContext.Provider>
  );
};

/**
 * Hook to access Analysis Status context.
 * Throws if used outside AnalysisStatusProvider.
 */
export const useAnalysisStatusContext = (): AnalysisStatusContextValue => {
  const context = useContext(AnalysisStatusContext);
  if (!context) {
    throw new Error('useAnalysisStatusContext must be used within an AnalysisStatusProvider');
  }
  return context;
};

/**
 * Hook to access only Analysis Status state (for components that just read).
 */
export const useAnalysisStatusState = (): AnalysisStatusState => {
  return useAnalysisStatusContext().state;
};

/**
 * Hook to access only Analysis Status actions (for components that just act).
 */
export const useAnalysisStatusActions = (): AnalysisStatusActions => {
  return useAnalysisStatusContext().actions;
};

/**
 * Creates an empty/default Analysis Status state.
 * Useful for testing and initialization.
 */
export function createEmptyAnalysisStatusState(): AnalysisStatusState {
  return {
    isAnalyzing: false,
    analysisError: null,
    analysisWarning: null,
    isDreaming: false,
    pendingDiff: null,
  };
}

export default AnalysisStatusContext;
