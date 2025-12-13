/**
 * Agent State Factory
 *
 * Pure functions for building AppBrainState from AgentController context.
 * Extracted to enable unit testing without mocking the entire controller.
 */

import { EditorContext } from '@/types';
import { Chapter, Lore } from '@/types/schema';
import { Persona } from '@/types/personas';
import { ManuscriptHUD } from '@/types/intelligence';
import { AnalysisResult } from '@/types';
import type {
  AppBrainState,
  ManuscriptState,
  IntelligenceState,
  AnalysisState,
  LoreState,
  UIState,
  SessionState,
} from '@/services/appBrain/types';

/**
 * Input for building AppBrainState from agent context.
 */
export interface AgentStateFactoryInput {
  /** Project identifier */
  projectId: string | null;
  /** All chapters in the project */
  chapters: Chapter[];
  /** Active chapter identifier (preferred over content heuristics) */
  activeChapterId?: string | null;
  /** Full text of active chapter */
  fullText: string;
  /** Optional intelligence HUD data */
  intelligenceHUD?: ManuscriptHUD;
  /** Optional analysis result */
  analysis?: AnalysisResult | null;
  /** Optional lore data */
  lore?: Lore;
  /** Editor context with cursor/selection info */
  editorContext: EditorContext;
  /** Current persona */
  persona?: Persona | null;
}

/**
 * Builds the manuscript state slice from agent context.
 */
export function buildManuscriptState(input: {
  projectId: string | null;
  chapters: Chapter[];
  activeChapterId?: string | null;
  fullText: string;
}): ManuscriptState {
  const resolvedActiveChapterId =
    input.activeChapterId ??
    input.chapters.find(chapter => chapter.content === input.fullText)?.id ??
    input.chapters[0]?.id ??
    null;

  return {
    projectId: input.projectId,
    projectTitle: '',
    chapters: input.chapters,
    activeChapterId: resolvedActiveChapterId,
    activeArcId: null,
    currentText: input.fullText,
    branches: [],
    activeBranchId: null,
    setting: undefined,
    arcs: [],
  };
}

/**
 * Builds the intelligence state slice from agent context.
 */
export function buildIntelligenceState(
  intelligenceHUD?: ManuscriptHUD
): IntelligenceState {
  return {
    hud: intelligenceHUD ?? null,
    full: null,
    entities: null,
    timeline: null,
    style: null,
    heatmap: null,
    lastProcessedAt: Date.now(),
  };
}

/**
 * Builds the analysis state slice from agent context.
 */
export function buildAnalysisState(
  analysis?: AnalysisResult | null
): AnalysisState {
  return {
    result: analysis ?? null,
    status: {
      pacing: 'idle',
      characters: 'idle',
      plot: 'idle',
      setting: 'idle',
    },
    inlineComments: [],
  };
}

/**
 * Builds the lore state slice from agent context.
 */
export function buildLoreState(lore?: Lore): LoreState {
  return {
    characters: lore?.characters ?? [],
    worldRules: lore?.worldRules ?? [],
    manuscriptIndex: undefined,
  };
}

/**
 * Builds the UI state slice from editor context.
 */
export function buildUIState(editorContext: EditorContext): UIState {
  const selection = editorContext.selection
    ? {
        start: editorContext.selection.start,
        end: editorContext.selection.end,
        text: editorContext.selection.text,
      }
    : null;

  return {
    cursor: {
      position: editorContext.cursorPosition,
      scene: null,
      paragraph: null,
    },
    selection,
    activePanel: 'agent',
    activeView: 'editor',
    isZenMode: false,
    activeHighlight: null,
    microphone: {
      status: 'idle',
      mode: 'text',
      lastTranscript: null,
      error: null,
    },
  };
}

/**
 * Builds the session state slice.
 */
export function buildSessionState(persona?: Persona | null): SessionState {
  return {
    chatHistory: [],
    currentPersona: persona ?? null,
    pendingToolCalls: [],
    lastAgentAction: null,
    isProcessing: false,
  };
}

/**
 * Builds a complete AppBrainState from AgentController context.
 * This is a pure function that can be unit tested without mocking the controller.
 *
 * @param input - The agent context input
 * @returns A fully constructed AppBrainState
 *
 * @example
 * ```ts
 * const appBrainState = buildAppBrainStateFromAgentContext({
 *   projectId: 'proj-123',
 *   chapters: [...],
 *   fullText: 'Chapter content...',
 *   editorContext: { cursorPosition: 100, selection: null },
 *   persona: defaultPersona,
 * });
 * ```
 */
export function buildAppBrainStateFromAgentContext(
  input: AgentStateFactoryInput
): AppBrainState {
  return {
    manuscript: buildManuscriptState({
      projectId: input.projectId,
      chapters: input.chapters,
      activeChapterId: input.activeChapterId,
      fullText: input.fullText,
    }),
    intelligence: buildIntelligenceState(input.intelligenceHUD),
    analysis: buildAnalysisState(input.analysis),
    lore: buildLoreState(input.lore),
    ui: buildUIState(input.editorContext),
    session: buildSessionState(input.persona),
  };
}
