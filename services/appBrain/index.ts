import { buildCompressedContext, buildNavigationContext, buildEditingContext, createContextBuilder } from './contextBuilder';
import type { AppBrainContext, AppBrainState } from './types';

// Type exports
export * from './types';

// Event system
export {
  eventBus,
  enableEventPersistence,
  disableEventPersistence,
  emitSelectionChanged,
  emitCursorMoved,
  emitChapterChanged,
  emitChapterSwitched,
  emitTextChanged,
  emitEditMade,
  emitAnalysisCompleted,
  emitToolExecuted,
  emitNavigationRequested,
  emitPanelSwitched,
  emitZenModeToggled,
  emitIdleStatusChanged,
  emitDreamingStateChanged,
  emitSignificantEditDetected,
  emitProactiveThinkingStarted,
  emitProactiveThinkingCompleted,
} from './eventBus';

export { startAppBrainEventObserver } from './eventObserver';

// Context builders
export {
  buildAgentContext,
  buildCompressedContext,
  buildNavigationContext,
  buildEditingContext,
  createContextBuilder,
  buildAgentContextWithMemory,
} from './contextBuilder';

// Enhancement 2A: Adaptive Context
export {
  buildAdaptiveContext,
  selectBudget,
  estimateTokens,
  DEFAULT_BUDGET,
  VOICE_MODE_BUDGET,
  EDITING_BUDGET,
  DEEP_ANALYSIS_BUDGET,
  // v1 Enhancement: Context Profiles & Model-aware budgets
  getContextBudgetForModel,
  selectContextProfile,
  PROFILE_ALLOCATIONS,
  type ContextProfile,
  type AdaptiveContextOptions,
  // Smartness Upgrade: Scene-aware memory filtering
  getSceneContextFromState,
  buildSceneAwareRelevance,
  type SceneContext,
} from './adaptiveContext';

// v1 Enhancement: Smart Context (unified entry point)
export { getSmartAgentContext, type SmartContextOptions } from './contextBuilder';

// Enhancement 2B: Context Streaming
export {
  ContextStreamer,
  getContextStreamer,
  resetContextStreamer,
  createStreamingSession,
  hasSignificantContextChange,
} from './contextStreamer';

// Enhancement 2C: Cross-Chapter Context
export { buildCrossChapterContext, formatCrossChapterContext } from './crossChapterContext';

// Smartness Upgrade: Intelligence-Memory Bridge
export {
  analyzeIntelligenceAgainstMemory,
  getHighPriorityConflicts,
  formatConflictsForPrompt,
  type IntelligenceConflict,
  type BridgeAnalysisResult,
  type BridgeOptions,
} from './intelligenceMemoryBridge';

// Smartness Upgrade: Proactive Thinker
export {
  ProactiveThinker,
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  resetProactiveThinker,
  type ThinkingResult,
  type ThinkerConfig,
  type ThinkerState,
} from './proactiveThinker';

export {
  getDreamingService,
  startDreamingService,
  stopDreamingService,
} from './dreamingService';

// Smartness Upgrade: Significant Edit Monitor
export {
  getSignificantEditMonitor,
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
} from './significantEditMonitor';

export const createEmptyAppBrainState = (): AppBrainState => ({
  manuscript: {
    projectId: null,
    projectTitle: '',
    chapters: [],
    activeChapterId: null,
    currentText: '',
    branches: [],
    activeBranchId: null,
    setting: undefined,
  },
  intelligence: {
    hud: null,
    full: null,
    entities: null,
    timeline: null,
    style: null,
    heatmap: null,
    lastProcessedAt: 0,
  },
  analysis: {
    result: null,
    status: {
      pacing: 'idle',
      characters: 'idle',
      plot: 'idle',
      setting: 'idle',
    },
    inlineComments: [],
  },
  lore: {
    characters: [],
    worldRules: [],
    manuscriptIndex: null,
  },
  ui: {
    cursor: {
      position: 0,
      scene: null,
      paragraph: null,
    },
    selection: null,
    activePanel: 'chat',
    activeView: 'editor',
    isZenMode: false,
    activeHighlight: null,
    microphone: {
      status: 'idle',
      mode: 'text',
      lastTranscript: null,
      error: null,
    },
  },
  session: {
    chatHistory: [],
    currentPersona: null,
    pendingToolCalls: [],
    lastAgentAction: null,
    isProcessing: false,
  },
});

export type { AppBrainContext, AppBrainState };

