# Critical surfaces (runtime bug funnels) — Quill AI

Date: 2025-12-12

## Scope + sources

This list is grounded in the project’s architecture docs and the concrete entrypoints they name:

- `docs/ARCHITECTURE.md`
- `docs/AGENT_ROUTING.md`
- `docs/AGENT_ARCHITECTURE.md`
- `docs/INTELLIGENCE_ENGINE.md`

Ranking bias:

- **Impact** (can corrupt persisted data / break core UX / poison agent context)
- **Fan-in** (how many subsystems depend on it)
- **Concurrency/async** (debounce, cancellation, worker, tool loops)
- **External dependency** (Gemini/API reliability)

---

## Ranked bug funnels

### 1) Editor session state + persistence (text correctness and durability)

Why risky:

- **Single source of truth for persisted manuscript structure** is the Project Store, but the Editor session is **transient** and async (undo/redo, selection, branching, debounced persistence). Bugs here can produce **silent data loss**, stale writes, or “agent acted on different text than the UI”.

Primary entrypoints:

- Persistence/store:
  - `features/project/store/useProjectStore.ts` (project + chapter state, debounced `scheduleChapterPersist` per `docs/ARCHITECTURE.md`)
  - `services/db.ts` (Dexie schema for projects/chapters + agent memory tables)
- Editor session:
  - `features/core/context/EditorContext.tsx` (active-chapter editing state)
  - `features/editor/hooks/useDocumentHistory.ts` (commit/undo/redo + unsaved changes)
  - `features/editor/hooks/useEditorSelection.ts` (cursor/selection)
  - `features/editor/hooks/useEditorBranching.ts` + `useBranching.ts` (branch ops)
  - `features/editor/components/RichTextEditor.tsx` / `EditorWorkspace.tsx` (main editing surfaces)

Common failure modes:

- Debounced persist writing **stale content** (ordering/awaiting assumptions break).
- Chapter switches mid-edit causing commits to the wrong chapter.
- Divergence between “currentText” used by Engine/Agent and what is persisted.
- Branch merge/switch edge cases creating “impossible” state (e.g., activeBranchId not matching branches).

---

### 2) App Brain aggregation + tool routing + agent orchestration (the omniscient control plane)

Why risky:

- The agent’s correctness depends on **AppBrain** being accurate and on tool calls mapping deterministically to app actions.
- This funnel has **very high fan-in**: project store, editor context, analysis status, intelligence signals, UI state.
- Tool loop is iterative + async; failure modes often become **loops**, partial side effects, or “agent hallucinated a tool” mismatches.

Primary entrypoints:

- App Brain (React aggregation + state exposure):
  - `features/core/context/AppBrainContext.tsx` (central hub per `docs/AGENT_ROUTING.md` + `docs/ARCHITECTURE.md`)
  - `features/core/context/AppBrainActionsContext.tsx`
  - `features/core/context/AppBrainStatusContext.tsx`
- Context building (what the model *actually* sees):
  - `services/appBrain/contextBuilder.ts`
  - `services/appBrain/adaptiveContext.ts`
  - `services/appBrain/crossChapterContext.ts`
  - `services/appBrain/contextStreamer.ts`
- Proactive + eventing (background agent behaviors):
  - `services/appBrain/proactiveThinker.ts`
  - `services/appBrain/eventBus.ts`
  - `services/appBrain/significantEditMonitor.ts`
- Orchestrator path (chat/agent UI):
  - `features/agent/hooks/useAgentOrchestrator.ts` (canonical entrypoint per `docs/AGENT_ROUTING.md`)
  - `services/core/agentOrchestratorMachine.ts` (state machine)
  - `services/core/agentToolLoop.ts` (shared tool loop)
  - `services/core/AgentController.ts` (controller runtime)
- Tool execution bridge (LLM → commands):
  - `services/gemini/toolExecutor.ts`
  - `services/commands/registry.ts`
  - `services/commands/*.ts` (navigation/editing/analysis/knowledge/generation/ui/history)
  - `services/gemini/agentTools.ts` (tool schema must match registry)

Common failure modes:

- Tool name / args drift between `services/gemini/agentTools.ts` and `services/commands/registry.ts`.
- Incomplete/incorrect AppBrain state slices leading to **wrong prompt context** (agent makes the “right” decision on wrong data).
- Cancellation/abort edge cases leaving tool loop half-applied.
- Proactive/event-driven behavior firing on the wrong triggers (noise, missed signals, repeated alerts).

---

### 3) Deterministic intelligence layer / indexing / HUD signals (the app’s “senses”)

Why risky:

- This layer is used to power the HUD, cross-chapter dashboards, memory auto-observation, and agent context **without model calls** (so it’s on the hot path and expected to be reliable).
- It includes incremental/worker execution, caching, and delta patching—classic sources of **stale results**, mismatches, or perf cliffs.

Primary entrypoints:

- UI integration:
  - `features/shared/hooks/useManuscriptIntelligence.ts` (coordinates worker vs local and updates HUD)
  - `features/shared/hooks/useManuscriptIndexer.ts` (contradiction/index integration referenced by EngineContext)
- Intelligence engine core:
  - `services/intelligence/index.ts` (process full/cached + merge chapter intelligence)
  - `services/intelligence/incrementalProcessor.ts` (incremental pipeline)
  - `services/intelligence/deltaTracker.ts` (changed ranges)
  - `services/intelligence/chunkManager.ts` / `chunkIndex.ts` (chunk caching/index)
  - `services/intelligence/structuralParser.ts`, `entityExtractor.ts`, `timelineTracker.ts`, `styleAnalyzer.ts`, `voiceProfiler.ts`, `heatmapBuilder.ts`, `contradictionDetector.ts`
- Worker/concurrency:
  - `services/intelligence/worker.ts`
  - `services/intelligence/workerPool.ts`

Common failure modes:

- Incremental path disagrees with full processing (delta/patching bugs).
- Worker cancellation/race conditions yielding “late” results and stale HUD.
- Cached structures reused when they should be invalidated (hash/processedAt issues).
- Cross-chapter merge producing misleading global stats (bad aggregation invariants).

---

### 4) External model calls (Gemini) + error handling + token guard + parsing

Why risky:

- External calls introduce **network/API** failure modes plus response variability.
- The app relies on guardrails (token guard + resilient parser) to avoid hard crashes and to convert malformed responses into safe UI behavior.
- These calls sit under multiple user-visible features: analysis, magic edits, agent chat/tooling, and shadow-reader reactions.

Primary entrypoints:

- Client/factory/config:
  - `services/gemini/client.ts`
  - `services/gemini/factory.ts`
  - `config/models.ts` (model configs, budgets)
  - `config/api.ts` (defaults / max analysis lengths)
- Analysis pipeline:
  - `services/gemini/analysis.ts` (calls Gemini, uses token guard, parses into `AnalysisResult`)
  - `services/gemini/tokenGuard.ts` (truncate/check limits)
  - `services/gemini/resilientParser.ts` (defensive parsing)
  - UI integration: `features/core/context/EngineContext.tsx` → `features/shared/hooks/useDraftSmithEngine.ts`
- Agent sessions + tool calls:
  - `services/gemini/agent.ts` (chat session creation)
  - `services/gemini/agentTools.ts` (declares tool schemas)
  - `services/gemini/toolExecutor.ts` (executes tool calls)
  - `services/core/agentToolLoop.ts` (iterates tool calls)
- Shadow reader (“reactions”):
  - `services/agent/readerService.ts` (direct-to-LLM)
  - UI surface: `features/analysis/components/ShadowReaderPanel.tsx`
- Error reporting:
  - `services/gemini/errors.ts`
  - `services/telemetry/errorReporter.ts`

Common failure modes:

- Token overflow/truncation producing confusing partial outputs.
- Parser accepting malformed partial responses in ways that degrade downstream behavior.
- Retry/abort behavior causing duplicate side effects (esp. tool calls) if not strictly guarded.
- UI state (active chapter) changes mid-request causing results applied to the wrong target.
