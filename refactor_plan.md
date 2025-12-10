# Architectural Audit: Services & Features/Core Layers

## Executive Summary

This audit identifies modularity risks, tight coupling patterns, and "God objects" in the `services/` and `features/core/` layers that hinder testability. The findings below are prioritized by impact on testing and difficulty of refactoring.

---

## 1. Dependency Analysis

### 1.1 Circular Dependency Scan

**Result: No circular dependencies detected between major modules.**

| Source Module | Target Module | Direction |
|---------------|---------------|-----------|
| `services/appBrain/*` | `services/memory/*` | Unidirectional ✅ |
| `services/gemini/serializers.ts` | `services/appBrain/types` | Types only ✅ |
| `services/intelligence/*` | `services/memory/types` | Types only ✅ |
| `features/core/context/*` | `services/appBrain/*` | Unidirectional ✅ |

### 1.2 Tight Coupling Hotspots

#### High Coupling: `services/appBrain/proactiveThinker.ts`
```
Imports from memory:
- evolveBedsideNote, getVoiceProfileForCharacter, upsertVoiceProfile (services/memory)
- extractFacts (services/memory/factExtractor)
- filterNovelLoreEntities (services/memory/relevance)
- getImportantReminders, ProactiveSuggestion (services/memory/proactive)
- searchBedsideHistory, BedsideHistoryMatch (services/memory/bedsideHistorySearch)
```
**Testing Impact**: Mocking 6+ memory functions required for any unit test.

#### High Coupling: `services/appBrain/contextBuilder.ts`
```
Imports from memory:
- getMemoriesForContext, getRelevantMemoriesForContext
- getActiveGoals, formatMemoriesForPrompt, formatGoalsForPrompt
```
**Testing Impact**: Memory layer must be mocked for context building tests.

### 1.3 Files with Recursive Import Relationships

None detected. The dependency graph is acyclic.

---

## 2. Context Audit

### 2.1 AppBrainContext.tsx - **GOD OBJECT**

**Location**: `features/core/context/AppBrainContext.tsx`

| Category | Count | Details |
|----------|-------|---------|
| **State Slices** | 6 | `manuscript`, `intelligence`, `analysis`, `lore`, `ui`, `session` |
| **Actions** | 17 | Navigation (4), Editing (4), Analysis (2), UI (4), Knowledge (3), Generation (2) |
| **Context Builders** | 6 | `getAgentContext`, `getAgentContextWithMemory`, `getCompressedContext`, etc. |

**Total Exposed Values: 29** (>10 threshold)

**Testing Impact**:
- Hard to mock `useAppBrain()` because it returns 29 interconnected values
- Testing any consumer requires setting up the full `AppBrainProvider`
- Actions are inline closures with captured refs, making them non-extractable

#### Proposed Split

| New Context | State/Actions to Extract |
|-------------|-------------------------|
| `AppBrainStatusContext` | `session.isProcessing`, `session.pendingToolCalls`, `session.lastAgentAction` |
| `AppBrainActionsContext` | All 17 action methods (already partially done) |
| `AppBrainNavigationContext` | `navigateToText`, `jumpToChapter`, `jumpToScene`, `scrollToPosition` |
| `AppBrainEditingContext` | `updateManuscript`, `appendText`, `undo`, `redo` |
| `AppBrainIntelligenceContext` | `intelligence.*`, `analysis.*` (read-only) |

---

### 2.2 EngineContext.tsx - **MODERATE CONCERN**

**Location**: `features/core/context/EngineContext.tsx`

| Category | Count | Details |
|----------|-------|---------|
| **State Values** | 13 | `isAnalyzing`, `analysisError`, `magicVariations`, `pendingDiff`, etc. |
| **Actions** | 12 | `runAnalysis`, `handleRewrite`, `applyVariation`, `handleAgentAction`, etc. |
| **Extra** | 1 | `contradictions` array |

**Total Exposed Values: 26** (>10 threshold)

**Testing Impact**:
- `useEngine()` hook requires mocking `useQuillAIEngine` which is complex
- The `contradictions` state is managed separately from the engine, creating split responsibility

#### Proposed Split

| New Context | State/Actions to Extract |
|-------------|-------------------------|
| `MagicEditorContext` | `magicVariations`, `activeMagicMode`, `magicHelpResult`, `handleRewrite`, `applyVariation` |
| `GrammarContext` | `grammarSuggestions`, `grammarHighlights`, `handleGrammarCheck`, `applyGrammarSuggestion` |
| `AnalysisStatusContext` | `isAnalyzing`, `analysisError`, `analysisWarning`, `runAnalysis` |

---

### 2.3 EditorContext.tsx - **ACCEPTABLE**

**Location**: `features/core/context/EditorContext.tsx`

| Category | Count |
|----------|-------|
| **State Values** | 17 |
| **Actions** | 19 |

**Mitigating Factor**: Already split into `EditorStateContext` and `EditorActionsContext` (lines 136-137). This pattern should be replicated elsewhere.

---

## 3. Logic Extraction Opportunities

### 3.1 useMagicEditor.ts

**Location**: `features/editor/hooks/useMagicEditor.ts`

#### Block 1: Selection Staleness Detection (Lines 232-240, 293-303)

```typescript
// Current: Inline staleness check in applyGrammarSuggestion
if (targetText !== targetSuggestion.originalText) {
  setMagicError('Text has changed since grammar check. Please re-run.');
  closeMagicBar();
  clearSelection();
  return;
}

// Same pattern in applyVariation (lines 293-303)
if (expectedText !== capturedSelection.text) {
  setMagicError('Text has changed since selection. Please re-select and try again.');
  closeMagicBar();
  clearSelection();
  return;
}
```

**Extract To**: `utils/selectionValidator.ts`
```typescript
export interface SelectionValidation {
  isValid: boolean;
  errorMessage?: string;
}

export function validateSelectionFreshness(
  currentText: string,
  selection: { start: number; end: number; text: string }
): SelectionValidation {
  const actualText = currentText.substring(selection.start, selection.end);
  if (actualText !== selection.text) {
    return {
      isValid: false,
      errorMessage: 'Text has changed since selection. Please re-select and try again.'
    };
  }
  return { isValid: true };
}
```

**Testing Benefit**: Pure function, no mocking needed.

---

#### Block 2: Grammar Suggestion Normalization (Lines 159-176)

```typescript
// Current: Inline offset normalization
const offset = selectionRange.start;
const normalized = suggestions.map(s => ({
  ...s,
  start: s.start + offset,
  end: s.end + offset,
  originalText: s.originalText ?? selectionRange.text.slice(s.start, s.end),
}));

setGrammarSuggestions(normalized);
setGrammarHighlights(
  normalized.map(s => ({
    start: s.start,
    end: s.end,
    color: 'var(--error-500)',
    title: s.message,
    severity: s.severity === 'style' ? 'warning' : 'error',
  }))
);
```

**Extract To**: `utils/grammarNormalizer.ts`
```typescript
export function normalizeGrammarSuggestions(
  suggestions: GrammarSuggestion[],
  selectionStart: number,
  selectionText: string
): { suggestions: GrammarSuggestion[]; highlights: HighlightItem[] } {
  const normalized = suggestions.map(s => ({
    ...s,
    start: s.start + selectionStart,
    end: s.end + selectionStart,
    originalText: s.originalText ?? selectionText.slice(s.start, s.end),
  }));

  const highlights = normalized.map(s => ({
    start: s.start,
    end: s.end,
    color: 'var(--error-500)',
    title: s.message,
    severity: s.severity === 'style' ? 'warning' as const : 'error' as const,
  }));

  return { suggestions: normalized, highlights };
}
```

**Testing Benefit**: Pure transformation, easily unit tested.

---

#### Block 3: Text Replacement Logic (Lines 242-246, 305-307)

```typescript
// Current: Inline text splicing
const before = currentText.substring(0, targetSuggestion.start);
const after = currentText.substring(targetSuggestion.end);
const updated = before + targetSuggestion.replacement + after;
```

**Extract To**: `utils/textReplacer.ts`
```typescript
export function replaceTextRange(
  text: string,
  start: number,
  end: number,
  replacement: string
): string {
  return text.substring(0, start) + replacement + text.substring(end);
}
```

**Testing Benefit**: Trivial to test edge cases (empty text, boundary conditions).

---

### 3.2 AgentController.ts

**Location**: `services/core/AgentController.ts`

#### Block 1: AppBrainState Factory (Lines 362-415)

```typescript
// Current: 53-line inline object construction in sendMessage()
const appBrainState: AppBrainState = {
  manuscript: {
    projectId: this.context.projectId ?? null,
    projectTitle: '',
    chapters: this.context.chapters,
    // ... 8 more properties
  },
  intelligence: {
    hud: this.context.intelligenceHUD ?? null,
    // ... 5 more properties
  },
  // ... 4 more top-level slices
};
```

**Extract To**: `services/core/agentStateFactory.ts`
```typescript
export interface AgentStateFactoryInput {
  context: AgentContextInput;
  editorContext: EditorContext;
  persona?: Persona;
}

export function buildAppBrainStateFromAgentContext(
  input: AgentStateFactoryInput
): AppBrainState {
  const { context, editorContext, persona } = input;

  const selection = editorContext.selection
    ? {
        start: editorContext.selection.start,
        end: editorContext.selection.end,
        text: editorContext.selection.text,
      }
    : null;

  return {
    manuscript: {
      projectId: context.projectId ?? null,
      projectTitle: '',
      chapters: context.chapters,
      activeChapterId: context.chapters[0]?.id ?? null,
      activeArcId: null,
      currentText: context.fullText,
      branches: [],
      activeBranchId: null,
      setting: undefined,
      arcs: [],
    },
    // ... rest of slices
  };
}
```

**Testing Impact**:
- Current: Cannot test `sendMessage` without mocking entire controller
- After: Factory is pure, testable in isolation

---

#### Block 2: Abort Signal Coordination (Lines 296-311)

```typescript
// Current: Inline abort listener setup
const internalAbortController = new AbortController();
this.currentAbortController = internalAbortController;

const externalSignal = input.options?.abortSignal;
const teardownAbortListener =
  externalSignal && !externalSignal.aborted
    ? (() => {
        const onAbort = () => internalAbortController.abort();
        externalSignal.addEventListener('abort', onAbort, { once: true });
        return () => externalSignal.removeEventListener('abort', onAbort);
      })()
    : null;
```

**Extract To**: `utils/abortCoordinator.ts`
```typescript
export interface AbortCoordination {
  internalController: AbortController;
  teardown: (() => void) | null;
}

export function createAbortCoordination(
  externalSignal?: AbortSignal
): AbortCoordination {
  const internalController = new AbortController();

  if (!externalSignal || externalSignal.aborted) {
    if (externalSignal?.aborted) {
      internalController.abort();
    }
    return { internalController, teardown: null };
  }

  const onAbort = () => internalController.abort();
  externalSignal.addEventListener('abort', onAbort, { once: true });

  return {
    internalController,
    teardown: () => externalSignal.removeEventListener('abort', onAbort),
  };
}
```

**Testing Benefit**: Abort logic testable without HTTP calls.

---

#### Block 3: Tool Loop Result Extraction (Lines 454-468)

```typescript
// Current: Inline result handling with type assertion
const responseText = (result as any).text as string | undefined;
const modelMessage: ChatMessage = {
  role: 'model',
  text: responseText || 'Done.',
  timestamp: new Date(),
};
this.events?.onMessage?.(modelMessage);

await this.toolRunner.maybeSuggestBedsideNoteRefresh(
  `${input.text} ${responseText || ''}`,
);
```

**Extract To**: `services/core/toolResultHandler.ts`
```typescript
export interface ToolLoopOutcome {
  responseText: string;
  modelMessage: ChatMessage;
  summaryForBedside: string;
}

export function extractToolLoopOutcome(
  result: AgentToolLoopModelResult,
  userInputText: string
): ToolLoopOutcome {
  const responseText = (result as any).text as string | undefined ?? 'Done.';

  return {
    responseText,
    modelMessage: {
      role: 'model',
      text: responseText,
      timestamp: new Date(),
    },
    summaryForBedside: `${userInputText} ${responseText}`,
  };
}
```

---

## 4. Refactoring Plan - Prioritized Steps

### Phase 1: Quick Wins (Low Risk, High Testing ROI)

| Priority | Task | Files | Effort |
|----------|------|-------|--------|
| 1.1 | Extract `validateSelectionFreshness()` | `useMagicEditor.ts` | 1 hour |
| 1.2 | Extract `normalizeGrammarSuggestions()` | `useMagicEditor.ts` | 1 hour |
| 1.3 | Extract `replaceTextRange()` | `useMagicEditor.ts` | 30 min |
| 1.4 | Extract `buildAppBrainStateFromAgentContext()` | `AgentController.ts` | 2 hours |
| 1.5 | Extract `createAbortCoordination()` | `AgentController.ts` | 1 hour |

**Estimated Total**: 5.5 hours

---

### Phase 2: Context Splitting (Medium Risk, High Maintainability ROI)

| Priority | Task | Files | Effort |
|----------|------|-------|--------|
| 2.1 | Split `EngineContext` into `MagicEditorContext` + `GrammarContext` | `EngineContext.tsx` | 4 hours |
| 2.2 | Create `AppBrainActionsContext` (extract actions) | `AppBrainContext.tsx` | 3 hours |
| 2.3 | Create `AppBrainStatusContext` (extract session status) | `AppBrainContext.tsx` | 2 hours |
| 2.4 | Add selective exports to `services/appBrain/index.ts` | `index.ts` | 1 hour |

**Estimated Total**: 10 hours

---

### Phase 3: Dependency Injection (Higher Risk, Long-term Testing ROI)

| Priority | Task | Files | Effort |
|----------|------|-------|--------|
| 3.1 | Create `MemoryService` interface for `proactiveThinker` | `proactiveThinker.ts` | 3 hours |
| 3.2 | Create `ContextService` interface for `AgentController` | `AgentController.ts` | 3 hours |
| 3.3 | Add constructor injection to `DefaultAgentController` | `AgentController.ts` | 2 hours |
| 3.4 | Create mock factories for test harnesses | `tests/mocks/*` | 4 hours |

**Estimated Total**: 12 hours

---

## 5. Testing Impact Summary

### Before Refactoring

| Component | Mock Count Required | Test Complexity |
|-----------|---------------------|-----------------|
| `useMagicEditor` | 5+ hooks | High |
| `AgentController.sendMessage` | 8+ services | Very High |
| `AppBrainContext` consumers | Full provider | Very High |
| `ProactiveThinker` | 6+ memory functions | High |

### After Refactoring (Phase 1 Complete)

| Component | Mock Count Required | Test Complexity |
|-----------|---------------------|-----------------|
| `validateSelectionFreshness` | 0 | None |
| `normalizeGrammarSuggestions` | 0 | None |
| `buildAppBrainStateFromAgentContext` | 0 | None |
| `createAbortCoordination` | 0 | None |

---

## 6. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing consumers | Keep old exports as aliases, deprecate gradually |
| Increased import complexity | Use barrel exports in `index.ts` files |
| Performance regression from context splitting | Use `useMemo` and `useCallback` for derived state |
| Incomplete test coverage during transition | Add tests for extracted utilities before modifying hooks |

---

## Appendix A: Files Analyzed

```
services/appBrain/index.ts
services/appBrain/types.ts
services/appBrain/contextBuilder.ts
services/appBrain/proactiveThinker.ts
services/memory/index.ts
services/memory/chains.ts
services/core/AgentController.ts
features/core/context/AppBrainContext.tsx
features/core/context/EngineContext.tsx
features/core/context/EditorContext.tsx
features/editor/hooks/useMagicEditor.ts
```

## Appendix B: Import Dependency Graph

```
features/core/context/AppBrainContext.tsx
├── features/core/context/EditorContext.tsx
├── features/analysis/*
├── features/project/*
├── features/shared/hooks/*
├── features/layout/store/*
├── services/appBrain/* (17 imports)
└── services/commands/* (9 imports)

services/appBrain/proactiveThinker.ts
├── services/gemini/client.ts
├── services/appBrain/eventBus.ts
├── services/appBrain/types.ts
├── services/appBrain/contextBuilder.ts
├── services/appBrain/intelligenceMemoryBridge.ts
├── services/memory/* (6 imports)
├── services/intelligence/timelineTracker.ts
├── services/intelligence/voiceProfiler.ts
└── features/settings/store/*

services/core/AgentController.ts
├── services/core/agentToolLoop.ts
├── services/core/agentSession.ts
├── services/core/agentContextBuilder.ts
├── services/core/toolRunner.ts
└── services/appBrain/* (2 imports)
```
