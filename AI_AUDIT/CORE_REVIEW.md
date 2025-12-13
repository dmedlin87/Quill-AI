# CORE Module Review (`services/core`) — Quill-AI

## Scope

- **In scope (11 files)**
  - `services/core/abortCoordinator.ts`
  - `services/core/agentContextBuilder.ts`
  - `services/core/AgentController.ts`
  - `services/core/agentOrchestratorMachine.ts`
  - `services/core/agentSession.ts`
  - `services/core/agentStateFactory.ts`
  - `services/core/agentToolLoop.ts`
  - `services/core/contextService.ts`
  - `services/core/promptBuilder.ts`
  - `services/core/toolCallAdapter.ts`
  - `services/core/toolRunner.ts`
- **Out of scope**: deep review of the rest of the repo; external imports are only referenced to explain contracts.

## Executive summary

This module implements the “agent brain” execution layer:

- **Session & memory priming** (`agentSession.ts`)
- **Prompt/context assembly** (`agentContextBuilder.ts`, `promptBuilder.ts`, `agentStateFactory.ts`)
- **Tool-call loop** (`agentToolLoop.ts` + `toolRunner.ts`)
- **Top-level controller** (`AgentController.ts`) that binds the above to UI events
- **A lightweight reducer-based orchestrator state machine** (`agentOrchestratorMachine.ts`) used outside the controller

The core implementation is workable and has meaningful tests around the tool loop, tool runner, abort utilities, and controller. However, there are several **high-severity correctness and cancellation risks**:

- **Abort/cancellation does not propagate into tool execution**, so aborting can still perform side effects.
- `DefaultAgentController.sendMessage()` has an **early-return path that skips teardown**, which can leak abort listeners and leave an internal abort controller stranded.
- Several “source of truth” values (e.g., **active chapter**) are guessed via heuristics that can easily be wrong.

The remainder of this report details architecture, invariants, risks, and phased refactor/test plans.

---

## System-level architecture

### Key components and ownership boundaries

- **`DefaultAgentController` (`services/core/AgentController.ts`)**

  - Owns UI-facing orchestration for a single “send message” turn.
  - Owns:
    - Chat session lifecycle (lazy init)
    - Tool execution turn lifecycle (`ToolRunner.resetTurn()`)
    - Abort controller for the current request
    - UI event emission (`onMessage`, `onStateChange`, `onToolCallStart`, `onToolCallEnd`)
  - Delegates:
    - Prompt creation to `buildAgentContextPrompt()`
    - Tool looping to `runAgentToolLoop()`
    - Tool execution to `ToolRunner.processToolCalls()`

- **`runAgentToolLoop` (`services/core/agentToolLoop.ts`)**

  - Owns the algorithm that repeats:
    - take `functionCalls[]` from model
    - execute tools
    - send `functionResponse[]` back to the model
  - Provides termination guard: `MAX_TOOL_ROUND_TRIPS = 5`.

- **`ToolRunner` (`services/core/toolRunner.ts`)**

  - Owns executing a batch of `FunctionCall[]` (sequentially).
  - Adds UI messaging (“Suggesting Action”) + error surfacing.
  - Adds “bedside note reflection” guidance and post-turn suggestion heuristic.

- **Context/prompt construction**

  - `agentContextBuilder.ts` is the canonical shared prompt builder for controller + orchestrator.
  - `promptBuilder.ts` builds a “user context prompt” but overlaps with `agentContextBuilder.ts`.
  - `agentStateFactory.ts` builds an `AppBrainState` from editor/manuscript input to enable `getSmartAgentContext()`.

- **Abort utilities** (`abortCoordinator.ts`)

  - Helper for linking external abort signals to an internal controller.

- **Orchestrator state machine** (`agentOrchestratorMachine.ts`)

  - Pure reducer describing `idle → thinking → executing → thinking → idle` transitions, plus error/abort.

### Dependency / call graph (text)

```text
DefaultAgentController
  ├─ createAbortCoordination (abortCoordinator)
  ├─ initializeChat
  │    └─ createChatSessionFromContext (agentSession)
  │         ├─ buildManuscriptContext
  │         ├─ buildMemoryContext OR fetchMemoryContext
  │         └─ createAgentSession (services/gemini/agent)
  ├─ buildAppBrainStateFromAgentContext (agentStateFactory)
  │    └─ getSmartAgentContext (services/appBrain)
  ├─ buildAgentContextPrompt (agentContextBuilder)
  ├─ chat.sendMessage (provider)
  └─ runAgentToolLoop (agentToolLoop)
        ├─ ToolRunner.processToolCalls (toolRunner)
        │    ├─ toolExecutor.execute (AgentToolExecutor)
        │    └─ getOrCreateBedsideNote (services/memory)
        └─ chat.sendMessage (provider)

agentOrchestratorMachine
  └─ agentOrchestratorReducer (pure)

contextService
  └─ wrappers around services/appBrain builders

toolCallAdapter
  └─ UI-only adapter (not directly used by DefaultAgentController)
```

### Sequence diagram 1: “Agent turn with tool calls”

```text
UI / Hook
  │
  │ sendMessage(text, editorContext)
  ▼
DefaultAgentController.sendMessage
  │  - emits user message to UI
  │  - builds smart context (best-effort)
  │  - builds prompt
  │  - chat.sendMessage(prompt) → initialResult
  ▼
runAgentToolLoop(chat, initialResult)
  │ while functionCalls present (max 5 rounds)
  │
  │  processToolCalls(functionCalls)
  ▼
ToolRunner.processToolCalls
  │ for each FunctionCall
  │  - emit “Suggesting Action”
  │  - toolExecutor.execute(toolName, args)
  │  - produce functionResponse payload
  │ return functionResponses[]
  ▲
  │
runAgentToolLoop
  │ chat.sendMessage(functionResponses)
  │ result = model response
  │ repeat or exit
  ▼
DefaultAgentController
  │ - emit final model message
  │ - maybeSuggestBedsideNoteRefresh
  ▼
UI / Hook
```

### Sequence diagram 2: “Abort during a turn”

```text
UI abortSignal aborts
  │
  ▼
createAbortCoordination listener
  │ internalController.abort()
  ▼
DefaultAgentController abortSignal becomes aborted
  │
  │ runAgentToolLoop checks abortSignal at:
  │  - start of round
  │  - after processToolCalls
  │  - after chat.sendMessage
  ▼
sendMessage returns early (no final model message)

NOTE: ToolRunner/toolExecutor do not observe abortSignal today.
```

---

## Per-file review (AC1)

### `services/core/abortCoordinator.ts`

- **Purpose**: Provide small AbortSignal helpers.
- **Key exports**
  - `createAbortCoordination(externalSignal?)` (`L40–L64`)
  - `isAbortError(error)` (`L72–L74`)
  - `createTimeoutSignal(timeoutMs)` (`L82–L86`)
  - `combineAbortSignals(signals)` (`L95–L115`)
- **Notes**
  - Works as expected for linking and teardown.
  - `isAbortError` is a narrow predicate (DOMException-only).

### `services/core/agentContextBuilder.ts`

- **Purpose**: Single shared prompt builder used by controller/orchestrator.
- **Key export**
  - `buildAgentContextPrompt()` (`L42–L99`)
- **Notes**
  - Encodes a context provenance marker: `Source: Smart Context` vs `Source: Editor Fallback` vs `Source: Unknown` (`L57–L67`).
  - Includes optional UI snapshot and recent events.

### `services/core/AgentController.ts`

- **Purpose**: UI-facing orchestration for agent turns.
- **Key types**
  - `AgentState` (`L21–L24`), `AgentContextInput` (`L28–L58`)
  - Tool/memory abstractions: `AgentToolExecutor` (`L62–L65`), `MemoryProvider` (`L68–L73`)
- **Key class**
  - `DefaultAgentController` (`L217–L491`)
- **Primary flows**
  - Session init: `initializeChat()` (`L256–L279`)
  - Turn execution: `sendMessage()` (`L281–L440`)
  - Cancellation: `abortCurrentRequest()` (`L483–L490`)

### `services/core/agentOrchestratorMachine.ts`

- **Purpose**: Pure reducer representing orchestration state.
- **Key exports**
  - `agentOrchestratorReducer()` (`L28–L102`)
  - `initialAgentMachineState` (`L23–L26`)
- **Notes**
  - No side effects; safe for React reducer usage.

### `services/core/agentSession.ts`

- **Purpose**: Build a model chat session from manuscript + memory + settings.
- **Key exports**
  - `buildManuscriptContext()` (`L13–L27`)
  - `buildMemoryContext()` (`L28–L42`) (delegates to injected `MemoryProvider`)
  - `fetchBedsideHistoryContext()` (`L48–L73`)
  - `fetchMemoryContext()` (`L75–L107`) (default memory implementation)
  - `buildInitializationMessage()` (`L109–L123`)
  - `createChatSessionFromContext()` (`L125–L158`)

### `services/core/agentStateFactory.ts`

- **Purpose**: Pure construction of `AppBrainState` from controller context.
- **Key exports**
  - `buildAppBrainStateFromAgentContext()` (`L176–L191`)
  - Slice builders: `buildManuscriptState` (`L48–L65`), `buildUIState` (`L116–L143`), etc.

### `services/core/agentToolLoop.ts`

- **Purpose**: Provider-agnostic tool loop algorithm.
- **Key exports**
  - `runAgentToolLoop()` (`L35–L79`)
- **Notes**
  - Termination guard: `MAX_TOOL_ROUND_TRIPS = 5` (`L33–L56`).

### `services/core/contextService.ts`

- **Purpose**: Abstraction layer around appBrain context functions for testability.
- **Key exports**
  - `createDefaultContextService()` (`L82–L104`)
  - `createNoOpContextService()` (`L110–L124`)
  - `createMockContextService()` (`L130–L135`)
  - `createFixedContextService()` (`L141–L160`)
- **Notes**
  - Not used by `DefaultAgentController` currently.

### `services/core/promptBuilder.ts`

- **Purpose**: Pure builder of a `[USER CONTEXT]` + `[USER REQUEST]` block.
- **Key export**
  - `buildUserContextPrompt()` (`L7–L32`)
- **Notes**
  - Overlaps in responsibility with `agentContextBuilder.ts`.

### `services/core/toolCallAdapter.ts`

- **Purpose**: UI adapter to announce tool start/end.
- **Key exports**
  - `createToolCallAdapter()` (`L23–L38`)
- **Notes**
  - Partially duplicates `ToolRunner` UI messaging.

### `services/core/toolRunner.ts`

- **Purpose**: Execute a list of tool calls and translate results into function responses.
- **Key exports**
  - `ToolRunner` class (`L30–L177`)
- **Key responsibilities**
  - tool execution: `processToolCalls()` (`L98–L176`)
  - post-turn heuristic: `maybeSuggestBedsideNoteRefresh()` (`L71–L96`)

## Findings (AC3)

Severity scale:

- **Critical**: likely to cause incorrect state, leaked resources, unintended side effects, or non-termination in real usage.
- **High**: serious correctness/design risk; may cause incorrect behavior under realistic conditions.
- **Medium/Low**: maintainability, determinism, type safety, or quality issues.

### 1) Abort/Cancel does not stop tool side effects (no abort threading)

- **Finding**: Aborting a request stops the loop and final reply, but **does not stop in-flight tool executions**, which can still mutate manuscript/memory.
- **Where**
  - `services/core/AgentController.ts:L391–L404` (abort checked only around loop boundaries)
  - `services/core/agentToolLoop.ts:L45–L47`, `L63–L65` (abort checked before/after `processToolCalls`)
  - `services/core/toolRunner.ts:L98–L176` (tool execution has no abort awareness)
- **Impact**
  - User hits “cancel” expecting nothing changes, but tools may still execute.
  - Risk of partial edits, inconsistent UI state, and surprise side effects.
- **Fix direction**
  - Thread `AbortSignal` into `processToolCalls`/`ToolRunner` and ultimately `toolExecutor.execute`.
  - Add checks between tool calls; require tool implementations to observe abort.
  - Add tests: “abort mid-tool prevents subsequent tool calls and suppresses side effects”.
- **Severity**: **Critical**

### 2) `sendMessage()` can early-return before teardown and controller cleanup

- **Finding**: When chat initialization fails and `chat` remains null, `sendMessage()` returns **before entering the `try/catch/finally`**, skipping teardown of the abort listener and leaving `currentAbortController` set.
- **Where**: `services/core/AgentController.ts:L298–L317` (return at `L313–L317` occurs before `try` at `L329`)
- **Impact**
  - Abort listener leak (external signal retains event listener).
  - `currentAbortController` may remain set until overwritten; `abortCurrentRequest()` can behave unexpectedly.
  - Potential memory leaks in long-running UI sessions.
- **Fix direction**
  - Restructure `sendMessage()` so *all exits* pass through a single `finally` block.
  - Add regression test: “init failure still tears down and clears current abort controller”.
- **Severity**: **Critical**

### 3) Active chapter detection is heuristic and can be wrong

- **Finding**: Active chapter is inferred by `chapter.content === fullText` instead of using a stable `activeChapterId`.
- **Where**: `services/core/agentSession.ts:L18–L24`
- **Impact**
  - If two chapters share content, or `fullText` differs by minor formatting, active flags are wrong.
  - Model may be told the wrong chapter is editable/readonly.
- **Fix direction**
  - Pass explicit active chapter identity from the app.
  - Prefer `Chapter.id` (and/or `order`) over content equivalence.
- **Severity**: **High**

### 4) `agentStateFactory` hardcodes `activeChapterId` to `chapters[0]`

- **Finding**: The factory sets `activeChapterId` to the first chapter, regardless of actual active chapter.
- **Where**: `services/core/agentStateFactory.ts:L48–L65` (specifically `L57–L58`)
- **Impact**
  - Smart context may be constructed for the wrong chapter, leading to irrelevant context or wrong tool suggestions.
  - Downstream appBrain behaviors may be skewed.
- **Fix direction**
  - Include `activeChapterId` in `AgentStateFactoryInput` and compute correctly.
  - Add unit tests for multi-chapter inputs.
- **Severity**: **High**

### 5) Initialization message is sent “fire-and-forget” and can reorder chat history

- **Finding**: `initializeChat()` sends an initialization message but does not await it.
- **Where**: `services/core/AgentController.ts:L268–L279`
- **Impact**
  - Chat provider may observe init message interleaving/reordering relative to user prompts.
  - Harder to reason about deterministic chat history.
- **Fix direction**
  - Either await initialization (and attach abort) or fold initialization into system prompt/session creation.
- **Severity**: **High**

### 6) Abort error classification is too narrow (`DOMException` only)

- **Finding**: `isAbortError()` only matches `error instanceof DOMException && error.name === 'AbortError'`.
- **Where**: `services/core/abortCoordinator.ts:L72–L74`, used in `services/core/AgentController.ts:L422–L425`
- **Impact**
  - Abort-like errors from other sources (e.g., custom errors with `name: 'AbortError'`, some fetch implementations) will be treated as real failures.
- **Fix direction**
  - Expand predicate to handle common abort shapes (`(error as any)?.name === 'AbortError'`).
  - Add tests for non-DOMException abort-like errors.
- **Severity**: **Medium**

### 7) Prompt construction is duplicated (risk of divergence)

- **Finding**: There are two prompt builders:
  - `buildAgentContextPrompt` (includes smartContext provenance + optional UI/events)
  - `buildUserContextPrompt` (editor context + user request)
  This creates drift risk about what the “canonical” prompt format is.
- **Where**
  - `services/core/agentContextBuilder.ts:L42–L99`
  - `services/core/promptBuilder.ts:L7–L32`
- **Impact**
  - Harder to guarantee consistent agent behavior across UI entry points.
- **Fix direction**
  - Consolidate under one prompt builder or ensure one composes the other.
- **Severity**: **Medium**

### 8) Tool loop lacks per-round tool count/time budgets

- **Finding**: Each round processes all `functionCalls` sequentially with no budget except round trips.
- **Where**
  - `services/core/agentToolLoop.ts:L43–L76`
  - `services/core/toolRunner.ts:L107–L173`
- **Impact**
  - A single model round can request many tools; execution could take a long time.
  - Cancelation expectations worsen because tools may run for a long time.
- **Fix direction**
  - Add per-round max tool calls, or timeouts, or require model to call tools one-at-a-time.
- **Severity**: **Medium**

### 9) `ToolRunner` has hidden coupling to tool taxonomy and “bedside note” policy

- **Finding**: `ToolRunner` contains hard-coded tool names (`SIGNIFICANT_TOOLS`) and a policy to recommend bedside-note updates.
- **Where**: `services/core/toolRunner.ts:L7–L19`, `L58–L69`, `L71–L96`
- **Impact**
  - Any tool renames or new tools require updating this set.
  - Mixing execution engine with product policy makes reuse/testing harder.
- **Fix direction**
  - Move significance classification and bedside-note policy behind injected strategy.
- **Severity**: **Medium**

### 10) Time/locale-dependent prompt content reduces determinism

- **Finding**: `fetchBedsideHistoryContext` formats dates with `toLocaleDateString()` and slices text.
- **Where**: `services/core/agentSession.ts:L61–L66`
- **Impact**
  - Prompt changes across environments (locale/timezone), harming reproducibility.
  - Harder to snapshot-test prompt formatting.
- **Fix direction**
  - Use a deterministic date format (e.g., ISO date) or omit date from prompt.
- **Severity**: **Medium**

### 11) Type safety gaps around model response parsing

- **Finding**: The controller reads model text via `(result as any).text`.
- **Where**: `services/core/AgentController.ts:L405–L414`
- **Impact**
  - Provider contract changes won’t be caught at compile time.
  - Potential runtime undefined behavior.
- **Fix direction**
  - Define a stricter response type and normalize provider responses.
- **Severity**: **Medium**

### 12) `contextService.ts` appears unused by the controller (architectural drift)

- **Finding**: `contextService.ts` introduces an abstraction for testability but `DefaultAgentController` calls `getSmartAgentContext` directly.
- **Where**
  - `services/core/contextService.ts:L45–L77`
  - `services/core/AgentController.ts:L369–L373`
- **Impact**
  - Competing abstractions; future work may duplicate logic.
- **Fix direction**
  - Either adopt `ContextService` in controller or remove it (if not needed).
- **Severity**: **Low/Medium**

---

## Refactor plan (AC4)

Goal: reduce correctness risk (especially cancellation), improve determinism and maintainability, without rewriting the module.

### Phase 0 (low-risk “safety + correctness” fixes)

- **P0.1**: Ensure `sendMessage()` always tears down abort listener and clears `currentAbortController`.
  - Target: `services/core/AgentController.ts` early return path (`L298–L317`).
- **P0.2**: Thread `AbortSignal` through tool execution.
  - Extend `ToolRunner.processToolCalls(functionCalls, { abortSignal })` and require `toolExecutor.execute` accept `AbortSignal`.
- **P0.3**: Fix active chapter source of truth.
  - Introduce explicit active chapter id in inputs used by `agentSession` and `agentStateFactory`.
- **P0.4**: Expand abort error detection beyond DOMException.
  - Centralize abort classification in `abortCoordinator`.

### Phase 1 (structural separation, still moderate risk)

- **P1.1**: Separate responsibilities into explicit services:
  - `SessionManager` (chat lifecycle, init message ordering)
  - `ContextBuilder` (smart context + fallback)
  - `ToolLoopRunner` (budgeting, structured telemetry)
- **P1.2**: Make tool policy injectable.
  - Extract bedside-note significance logic out of `ToolRunner`.
- **P1.3**: Consolidate prompt building.
  - Ensure there is one canonical prompt format (`agentContextBuilder` as root).

### Phase 2 (capability improvements / future-facing)

- **P2.1**: Strongly typed tool schema.
  - Add per-tool input/output validation (e.g., zod schemas) and reject invalid model args safely.
- **P2.2**: Add deterministic prompt formatting standards.
  - Stable timestamps/dates, explicit context sections.
- **P2.3**: Implement true streaming support.
  - Wire provider streaming into controller and extend abort handling.

---

## Test strategy & gaps (AC5)

### Current coverage (observed)

- Existing unit tests:
  - `tests/services/core/abortCoordinator.test.ts`
  - `tests/services/core/agentToolLoop.test.ts`
  - `tests/services/core/agentOrchestratorMachine.test.ts`
  - `tests/services/core/toolRunner.test.ts`
  - `tests/services/core/AgentController.test.ts`

### Missing or weak tests (recommended)

- **`services/core/AgentController.ts`**
  - Add regression test for the early-return init failure path to ensure teardown happens.
  - Add test: abort during tool execution prevents subsequent tool calls (once abort is threaded).

- **`services/core/agentSession.ts`**
  - Unit tests:
    - `buildManuscriptContext()` marks exactly one active chapter based on explicit id.
    - `fetchMemoryContext()` formatting: includes bedside history, memories, goals.
    - Deterministic formatting (no locale-dependent output).

- **`services/core/agentStateFactory.ts`**
  - Unit tests:
    - `buildManuscriptState()` respects provided active chapter id.
    - `buildUIState()` selection null vs non-null cases.

- **`services/core/agentContextBuilder.ts`**
  - Snapshot tests:
    - smart context path (`Source: Smart Context`)
    - editor fallback path (`Source: Editor Fallback`)
    - unknown path
    - UI snapshot + recent events present

- **`services/core/promptBuilder.ts`**
  - Snapshot tests; ensure consistent truncation and selection formatting.

- **`services/core/contextService.ts`**
  - If retained: unit tests proving default wrappers call through to appBrain builders.

- **`services/core/toolCallAdapter.ts`**
  - Unit tests verifying start/end messages are correct and error formatting matches conventions.

### Integration boundary recommendations

- **Integration test**: `DefaultAgentController` + fake `Chat` + fake `toolExecutor` exercising a multi-round tool loop.
- **Contract tests**: Ensure provider response normalization produces the same internal shape across providers.

---

## Notes on design contradictions / alignment

- **Determinism vs non-determinism**
  - Prompts include locale-dependent date formatting (`agentSession.ts:L61–L66`) and runtime timestamps in UI messages (`ToolRunner` and controller). If “deterministic layer” goals exist, these are sources of drift.

- **“Cancel means stop” vs current behavior**
  - Current cancellation stops UI output, but does not stop tool side effects (Finding #1), which is a mismatch with user expectations.

---

## Acceptance criteria checklist

- **AC1 (per-file sections)**: Included above for all 11 files.
- **AC2 (system-level narrative)**: Included in “System-level architecture” with call graph + sequence diagrams.
- **AC3 (>=10 findings with line references)**: Included (12 findings).
- **AC4 (phased refactor plan)**: Included (Phase 0/1/2).
- **AC5 (test strategy)**: Included with specific file targets and test ideas.
