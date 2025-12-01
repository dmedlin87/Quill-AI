/**
 * Command Pattern Infrastructure
 * 
 * This module provides:
 * - Type definitions for commands and dependencies
 * - Command implementations for all tool categories
 * - CommandRegistry for dynamic command resolution
 * - CommandHistory for tracking agent actions
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  AppBrainCommand,
  ExclusiveEditRunner,
  NavigationDependencies,
  EditingDependencies,
  AnalysisDependencies,
  KnowledgeDependencies,
  UIDependencies,
  GenerationDependencies,
  ExecutedCommand,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  NavigateToTextCommand,
  JumpToChapterCommand,
  JumpToSceneCommand,
  type JumpToSceneParams,
} from './navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Editing Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  UpdateManuscriptCommand,
  AppendTextCommand,
  type AppendTextParams,
} from './editing';

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  GetCritiqueCommand,
  RunAnalysisCommand,
} from './analysis';

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  QueryLoreCommand,
  GetCharacterInfoCommand,
} from './knowledge';

// ─────────────────────────────────────────────────────────────────────────────
// UI Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  SwitchPanelCommand,
  ToggleZenModeCommand,
  HighlightTextCommand,
  SetSelectionCommand,
  type HighlightTextParams,
} from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// Generation Commands
// ─────────────────────────────────────────────────────────────────────────────

export {
  RewriteSelectionCommand,
  ContinueWritingCommand,
  SuggestDialogueCommand,
  type RewriteSelectionParams,
  type SuggestDialogueParams,
} from './generation';

// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure
// ─────────────────────────────────────────────────────────────────────────────

export { CommandRegistry, type CommandMeta } from './registry';
export { CommandHistory, getCommandHistory, resetCommandHistory } from './history';
