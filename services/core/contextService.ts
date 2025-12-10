/**
 * Context Service Interface
 *
 * Abstracts context-building dependencies for AgentController.
 * Enables testing without mocking the entire appBrain layer.
 */

import type { AppBrainState } from '@/services/appBrain/types';
import {
  getSmartAgentContext,
  buildCompressedContext,
  buildNavigationContext,
  buildEditingContext,
  buildAgentContextWithMemory
} from '@/services/appBrain';

/**
 * Result of building agent context.
 */
export interface AgentContextResult {
  /** The formatted context string for the agent */
  context: string;
  /** Token estimate for the context */
  tokenEstimate?: number;
  /** Which context profile was used */
  profile?: string;
}

/**
 * Options for building agent context.
 */
export interface AgentContextOptions {
  /** Input mode (text, voice) */
  mode: 'text' | 'voice';
  /** Type of query being made */
  queryType: 'editing' | 'general' | 'navigation' | 'analysis';
  /** Maximum token budget */
  maxTokens?: number;
}

/**
 * Interface for context-building operations.
 * Implementations can be the real context builder or a mock for testing.
 */
export interface ContextService {
  /**
   * Builds smart agent context from app state.
   */
  getSmartAgentContext: (
    state: AppBrainState,
    projectId: string | null,
    options: AgentContextOptions
  ) => Promise<AgentContextResult>;

  /**
   * Builds a compressed context for token-efficient operations.
   */
  getCompressedContext: (state: AppBrainState) => string;

  /**
   * Builds context focused on navigation capabilities.
   */
  getNavigationContext: (state: AppBrainState) => string;

  /**
   * Builds context focused on editing operations.
   */
  getEditingContext: (state: AppBrainState) => string;

  /**
   * Builds context with memory integration.
   */
  getAgentContextWithMemory: (
    state: AppBrainState,
    projectId: string | null
  ) => Promise<string>;
}

/**
 * Default implementation that wraps the actual context builders.
 */
export function createDefaultContextService(): ContextService {
  return {
    getSmartAgentContext: async (state, projectId, options) => {
      return getSmartAgentContext(state, projectId, options);
    },

    getCompressedContext: (state) => {
      return buildCompressedContext(state);
    },

    getNavigationContext: (state) => {
      return buildNavigationContext(state);
    },

    getEditingContext: (state) => {
      return buildEditingContext(state);
    },

    getAgentContextWithMemory: async (state, projectId) => {
      return buildAgentContextWithMemory(state, projectId);
    },
  };
}

/**
 * Creates a no-op context service for testing.
 * All methods return minimal valid contexts.
 */
export function createNoOpContextService(): ContextService {
  const minimalContext = 'No context available.';

  return {
    getSmartAgentContext: async () => ({
      context: minimalContext,
      tokenEstimate: 10,
      profile: 'minimal',
    }),
    getCompressedContext: () => minimalContext,
    getNavigationContext: () => minimalContext,
    getEditingContext: () => minimalContext,
    getAgentContextWithMemory: async () => minimalContext,
  };
}

/**
 * Creates a mock context service with configurable responses.
 * Useful for testing specific scenarios.
 */
export function createMockContextService(
  overrides: Partial<ContextService> = {}
): ContextService {
  const noOp = createNoOpContextService();
  return { ...noOp, ...overrides };
}

/**
 * Creates a mock context service that returns fixed context strings.
 * Useful for deterministic testing.
 */
export function createFixedContextService(contexts: {
  smart?: string;
  compressed?: string;
  navigation?: string;
  editing?: string;
  withMemory?: string;
}): ContextService {
  return {
    getSmartAgentContext: async () => ({
      context: contexts.smart ?? 'Fixed smart context',
      tokenEstimate: 100,
      profile: 'test',
    }),
    getCompressedContext: () => contexts.compressed ?? 'Fixed compressed context',
    getNavigationContext: () => contexts.navigation ?? 'Fixed navigation context',
    getEditingContext: () => contexts.editing ?? 'Fixed editing context',
    getAgentContextWithMemory: async () =>
      contexts.withMemory ?? 'Fixed context with memory',
  };
}
