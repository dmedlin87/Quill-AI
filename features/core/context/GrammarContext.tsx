/**
 * GrammarContext
 *
 * Focused context for grammar checking state and actions.
 * Split from EngineContext for improved testability and selective re-renders.
 */

import { createContext, useContext, useMemo } from 'react';
import { GrammarSuggestion } from '@/types';
import { HighlightItem } from '@/features/editor/hooks/useTiptapSync';

export interface GrammarState {
  grammarSuggestions: GrammarSuggestion[];
  grammarHighlights: HighlightItem[];
}

export interface GrammarActions {
  handleGrammarCheck: () => void;
  applyGrammarSuggestion: (id?: string | null) => void;
  applyAllGrammarSuggestions: () => void;
  dismissGrammarSuggestion: (id: string) => void;
}

export interface GrammarContextValue {
  state: GrammarState;
  actions: GrammarActions;
}

const GrammarContext = createContext<GrammarContextValue | undefined>(undefined);

export interface GrammarProviderProps {
  children: React.ReactNode;
  state: GrammarState;
  actions: GrammarActions;
}

/**
 * Provider for Grammar context.
 * Can be used standalone or composed within EngineProvider.
 */
export const GrammarProvider: React.FC<GrammarProviderProps> = ({
  children,
  state,
  actions,
}) => {
  const value = useMemo<GrammarContextValue>(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <GrammarContext.Provider value={value}>
      {children}
    </GrammarContext.Provider>
  );
};

/**
 * Hook to access Grammar context.
 * Throws if used outside GrammarProvider.
 */
export const useGrammarContext = (): GrammarContextValue => {
  const context = useContext(GrammarContext);
  if (!context) {
    throw new Error('useGrammarContext must be used within a GrammarProvider');
  }
  return context;
};

/**
 * Hook to access only Grammar state (for components that just read).
 */
export const useGrammarState = (): GrammarState => {
  return useGrammarContext().state;
};

/**
 * Hook to access only Grammar actions (for components that just act).
 */
export const useGrammarActions = (): GrammarActions => {
  return useGrammarContext().actions;
};

/**
 * Creates an empty/default Grammar state.
 * Useful for testing and initialization.
 */
export function createEmptyGrammarState(): GrammarState {
  return {
    grammarSuggestions: [],
    grammarHighlights: [],
  };
}

export default GrammarContext;
