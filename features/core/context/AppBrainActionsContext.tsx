/**
 * AppBrainActionsContext
 *
 * Focused context for AppBrain actions only.
 * Split from AppBrainContext for improved testability and selective re-renders.
 * Components that only need to dispatch actions can use this context
 * to avoid re-renders from state changes.
 */

import { createContext, useContext, useMemo } from 'react';
import type {
  AppBrainActions,
  NavigateToTextParams,
  UpdateManuscriptParams,
  RewriteSelectionParams,
  MicrophoneState,
} from '@/services/appBrain/types';

// Re-export types for convenience
export type {
  AppBrainActions,
  NavigateToTextParams,
  UpdateManuscriptParams,
  RewriteSelectionParams,
  MicrophoneState,
};

const AppBrainActionsContext = createContext<AppBrainActions | null>(null);

export interface AppBrainActionsProviderProps {
  children: React.ReactNode;
  actions: AppBrainActions;
}

/**
 * Provider for AppBrain actions.
 * Can be used standalone or composed within AppBrainProvider.
 */
export const AppBrainActionsProvider: React.FC<AppBrainActionsProviderProps> = ({
  children,
  actions,
}) => {
  return (
    <AppBrainActionsContext.Provider value={actions}>
      {children}
    </AppBrainActionsContext.Provider>
  );
};

/**
 * Hook to access AppBrain actions.
 * Throws if used outside AppBrainActionsProvider.
 */
export const useAppBrainActionsContext = (): AppBrainActions => {
  const context = useContext(AppBrainActionsContext);
  if (!context) {
    throw new Error('useAppBrainActionsContext must be used within an AppBrainActionsProvider');
  }
  return context;
};

/**
 * Creates a no-op actions object for testing.
 * All actions resolve to empty strings or do nothing.
 */
export function createNoOpAppBrainActions(): AppBrainActions {
  return {
    // Navigation
    navigateToText: async () => '',
    jumpToChapter: async () => '',
    jumpToScene: async () => '',
    scrollToPosition: () => {},

    // Editing
    updateManuscript: async () => '',
    appendText: async () => '',
    undo: async () => '',
    redo: async () => '',

    // Analysis
    getCritiqueForSelection: async () => '',
    runAnalysis: async () => '',

    // UI Control
    switchPanel: async () => '',
    toggleZenMode: async () => '',
    highlightText: async () => '',
    setMicrophoneState: () => {},

    // Knowledge
    queryLore: async () => '',
    getCharacterInfo: async () => '',
    getTimelineContext: async () => '',

    // Generation
    rewriteSelection: async () => '',
    continueWriting: async () => '',
  };
}

export default AppBrainActionsContext;
