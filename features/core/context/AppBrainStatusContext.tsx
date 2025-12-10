/**
 * AppBrainStatusContext
 *
 * Focused context for AppBrain session status.
 * Split from AppBrainContext for improved testability and selective re-renders.
 * Components that only need to display processing status can use this context
 * to avoid re-renders from other state changes.
 */

import { createContext, useContext, useMemo } from 'react';
import type {
  SessionState,
  PendingToolCall,
  AgentAction,
} from '@/services/appBrain/types';
import { Persona } from '@/types/personas';

// Re-export types for convenience
export type { SessionState, PendingToolCall, AgentAction };

/**
 * Minimal session status for components that just need to know
 * if the agent is processing.
 */
export interface AppBrainStatus {
  isProcessing: boolean;
  pendingToolCalls: PendingToolCall[];
  lastAgentAction: AgentAction | null;
  currentPersona: Persona | null;
}

const AppBrainStatusContext = createContext<AppBrainStatus | null>(null);

export interface AppBrainStatusProviderProps {
  children: React.ReactNode;
  status: AppBrainStatus;
}

/**
 * Provider for AppBrain session status.
 * Can be used standalone or composed within AppBrainProvider.
 */
export const AppBrainStatusProvider: React.FC<AppBrainStatusProviderProps> = ({
  children,
  status,
}) => {
  const value = useMemo(() => status, [status]);

  return (
    <AppBrainStatusContext.Provider value={value}>
      {children}
    </AppBrainStatusContext.Provider>
  );
};

/**
 * Hook to access AppBrain session status.
 * Throws if used outside AppBrainStatusProvider.
 */
export const useAppBrainStatusContext = (): AppBrainStatus => {
  const context = useContext(AppBrainStatusContext);
  if (!context) {
    throw new Error('useAppBrainStatusContext must be used within an AppBrainStatusProvider');
  }
  return context;
};

/**
 * Hook to check if the agent is currently processing.
 */
export const useIsAgentProcessing = (): boolean => {
  return useAppBrainStatusContext().isProcessing;
};

/**
 * Hook to get the current pending tool calls.
 */
export const usePendingToolCalls = (): PendingToolCall[] => {
  return useAppBrainStatusContext().pendingToolCalls;
};

/**
 * Hook to get the last agent action.
 */
export const useLastAgentAction = (): AgentAction | null => {
  return useAppBrainStatusContext().lastAgentAction;
};

/**
 * Creates an empty/default AppBrain status.
 * Useful for testing and initialization.
 */
export function createEmptyAppBrainStatus(): AppBrainStatus {
  return {
    isProcessing: false,
    pendingToolCalls: [],
    lastAgentAction: null,
    currentPersona: null,
  };
}

export default AppBrainStatusContext;
