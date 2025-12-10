/**
 * MagicEditorContext
 *
 * Focused context for Magic Editor state and actions.
 * Split from EngineContext for improved testability and selective re-renders.
 */

import { createContext, useContext, useMemo } from 'react';

export interface MagicEditorState {
  magicVariations: string[];
  activeMagicMode: string | null;
  magicHelpResult: string | null;
  magicHelpType: 'Explain' | 'Thesaurus' | null;
  isMagicLoading: boolean;
  magicError: string | null;
}

export interface MagicEditorActions {
  handleRewrite: (mode: string, tone?: string) => void;
  handleHelp: (type: 'Explain' | 'Thesaurus') => void;
  applyVariation: (text: string) => void;
  closeMagicBar: () => void;
}

export interface MagicEditorContextValue {
  state: MagicEditorState;
  actions: MagicEditorActions;
}

const MagicEditorContext = createContext<MagicEditorContextValue | undefined>(undefined);

export interface MagicEditorProviderProps {
  children: React.ReactNode;
  state: MagicEditorState;
  actions: MagicEditorActions;
}

/**
 * Provider for Magic Editor context.
 * Can be used standalone or composed within EngineProvider.
 */
export const MagicEditorProvider: React.FC<MagicEditorProviderProps> = ({
  children,
  state,
  actions,
}) => {
  const value = useMemo<MagicEditorContextValue>(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <MagicEditorContext.Provider value={value}>
      {children}
    </MagicEditorContext.Provider>
  );
};

/**
 * Hook to access Magic Editor context.
 * Throws if used outside MagicEditorProvider.
 */
export const useMagicEditorContext = (): MagicEditorContextValue => {
  const context = useContext(MagicEditorContext);
  if (!context) {
    throw new Error('useMagicEditorContext must be used within a MagicEditorProvider');
  }
  return context;
};

/**
 * Hook to access only Magic Editor state (for components that just read).
 */
export const useMagicEditorState = (): MagicEditorState => {
  return useMagicEditorContext().state;
};

/**
 * Hook to access only Magic Editor actions (for components that just act).
 */
export const useMagicEditorActions = (): MagicEditorActions => {
  return useMagicEditorContext().actions;
};

/**
 * Creates an empty/default Magic Editor state.
 * Useful for testing and initialization.
 */
export function createEmptyMagicEditorState(): MagicEditorState {
  return {
    magicVariations: [],
    activeMagicMode: null,
    magicHelpResult: null,
    magicHelpType: null,
    isMagicLoading: false,
    magicError: null,
  };
}

export default MagicEditorContext;
