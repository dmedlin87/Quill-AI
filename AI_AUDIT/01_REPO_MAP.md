# Repo map (depth 4) — Quill AI

Date: 2025-12-12

## Scope

This map covers only the runtime-relevant surfaces needed to understand architecture and risk:

- `features/`
- `services/`
- `tests/`
- `docs/`
- `config/`

Sources for purpose notes:

- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENT_ROUTING.md`
- `docs/AGENT_ARCHITECTURE.md`
- `docs/INTELLIGENCE_ENGINE.md`

Directory trees were generated locally and also saved under `AI_AUDIT/logs/tree_*_depth4.txt`.

---

## `features/` — UI + React state layers (Editor session → Engine → App Brain → Agent)

```text
features/
+- agent/
|  +- components/
|  \- hooks/
+- analysis/
|  +- components/
|  \- context/
+- core/
|  \- context/
+- debug/
|  \- components/
+- editor/
|  +- components/
|  +- extensions/
|  \- hooks/
+- export/
|  +- components/
|  \- utils/
+- layout/
|  \- store/
+- lore/
|  \- components/
+- memory/
|  \- components/
+- project/
|  +- components/
|  \- store/
+- settings/
|  +- components/
|  \- store/
+- shared/
|  +- components/
|  |  \- ui/
|  +- context/
|  +- hooks/
|  +- styles/
|  \- utils/
\- voice/
   +- components/
   +- hooks/
   \- services/
```

Purpose notes (high-signal):

- **`features/core/context/`**: the state “spine” (per `docs/ARCHITECTURE.md`).
  - **Editor session**: `features/core/context/EditorContext.tsx` (active chapter text, selection, undo/redo, branching, inline comments).
  - **AI engine integration**: `features/core/context/EngineContext.tsx` (analysis, magic editor, pending diffs).
  - **App Brain aggregation**: `features/core/context/AppBrainContext.tsx` (unified state presented to agent tooling).

- **`features/project/store/`**: persistent project/chapter state (Zustand). Primary file: `features/project/store/useProjectStore.ts`.
  - Persists to IndexedDB via Dexie (`services/db.ts`).

- **`features/editor/`**: interactive editor UX (Tiptap) + session helpers.
  - Hooks like `useDocumentHistory.ts`, `useEditorSelection.ts`, `useEditorBranching.ts`, `useMagicEditor.ts` back `EditorContext`.
  - Components like `RichTextEditor.tsx` and `EditorWorkspace.tsx` are the main UI surfaces.

- **`features/analysis/`**: analysis panels + analysis state.
  - `features/analysis/context/AnalysisContext.tsx` provides analysis data to UI.
  - `ShadowReaderPanel.tsx` is the “reactions” UI surface referenced in `docs/AGENT_ROUTING.md` (pairs with `services/agent/readerService.ts`).

- **`features/agent/`**: chat UI + agent hooks.
  - Canonical omniscient agent hook: `features/agent/hooks/useAgentOrchestrator.ts` (per `docs/AGENT_ROUTING.md`).
  - Legacy: `useAgentService.ts`, `useAgenticEditor.ts` (called out as deprecated in `docs/AGENT_ROUTING.md`).

- **`features/shared/hooks/`**: cross-cutting hooks that wire UI state into services.
  - `useDraftSmithEngine.ts` (core AI engine hook referenced by `EngineContext`).
  - `useManuscriptIntelligence.ts` (keeps deterministic intelligence up-to-date; referenced by `docs/INTELLIGENCE_ENGINE.md`).

- **`features/memory/`**: memory UI (e.g., `MemoryManager.tsx`) over the `services/memory/*` subsystem.

- **`features/layout/`**, **`features/settings/`**, **`features/voice/`**, **`features/lore/`**, **`features/export/`**: UI shells and supporting UX subsystems.

---

## `services/` — runtime logic (Dexie + intelligence + agent + Gemini + commands)

```text
services/
+- agent/
+- appBrain/
+- commands/
+- core/
+- gemini/
+- intelligence/
+- io/
+- memory/
|  \- bedside/
\- telemetry/
```

Purpose notes (high-signal):

- **`services/db.ts`**: Dexie DB schema for projects/chapters and agent memory tables (per `docs/ARCHITECTURE.md`).

- **`services/intelligence/`**: deterministic intelligence engine (no model calls), per `docs/INTELLIGENCE_ENGINE.md`.
  - Entry points: `services/intelligence/index.ts` (`processManuscript*`, cross-chapter merge APIs).
  - Incremental processing: `services/intelligence/incrementalProcessor.ts`.
  - Worker execution: `services/intelligence/worker.ts`, `workerPool.ts`.

- **`services/appBrain/`**: App Brain context + eventing + proactive loop (per `docs/AGENT_ROUTING.md`, `docs/AGENT_ARCHITECTURE.md`).
  - Context assembly: `services/appBrain/contextBuilder.ts`, `adaptiveContext.ts`.
  - Eventing/proactive: `eventBus.ts`, `proactiveThinker.ts`, `significantEditMonitor.ts`.

- **`services/core/`**: agent runtime + tool-loop execution (shared by UI hooks and controller logic).
  - Tool loop core: `services/core/agentToolLoop.ts`.
  - Controller runtime: `services/core/AgentController.ts`.

- **`services/gemini/`**: external model interaction layer.
  - Client/session: `client.ts`, `factory.ts`, `agent.ts`.
  - Prompts/parsing/guards: `prompts.ts`, `resilientParser.ts`, `tokenGuard.ts`, `errors.ts`.
  - Tool execution bridge: `toolExecutor.ts`.

- **`services/commands/`**: tool command implementations.
  - Registry: `services/commands/registry.ts` maps tool names to command implementations.
  - Command groups: `navigation.ts`, `editing.ts`, `analysis.ts`, `knowledge.ts`, `generation.ts`, `ui.ts`, `history.ts`.

- **`services/memory/`**: long-lived memory system and bedside-note planning.
  - Auto observation and triggers: `autoObserver.ts`, `realtimeTriggers.ts`, `proactive.ts`.
  - Bedside notes schema: `services/memory/bedside/schema.ts`.

- **`services/agent/readerService.ts`**: “Shadow Reader (Reactions)” direct-to-LLM service (per `docs/AGENT_ROUTING.md`).

- **`services/telemetry/errorReporter.ts`**: error reporting integration used by runtime (e.g., model call failures).

---

## `tests/` — unit/integration tests (mirrors `features/` and `services/`)

```text
tests/
+- components/
|  \- ui/
+- config/
+- context/
+- extensions/
+- factories/
+- features/
|  +- agent/
|  |  +- components/
|  |  \- hooks/
|  +- analysis/
|  |  +- components/
|  |  \- context/
|  +- core/
|  |  \- context/
|  +- debug/
|  |  \- components/
|  +- editor/
|  |  +- components/
|  |  +- extensions/
|  |  \- hooks/
|  +- export/
|  |  +- components/
|  |  \- utils/
|  +- layout/
|  |  \- store/
|  +- lore/
|  +- memory/
|  |  +- __snapshots__/
|  |  \- components/
|  +- project/
|  +- settings/
|  |  +- components/
|  |  \- store/
|  +- shared/
|  |  +- components/
|  |  +- hooks/
|  |  \- utils/
|  \- voice/
|     +- components/
|     \- hooks/
+- helpers/
+- hooks/
+- integration/
+- mocks/
+- public/
+- services/
|  +- agent/
|  +- appBrain/
|  +- commands/
|  +- core/
|  +- fixtures/
|  |  \- manuscripts/
|  +- gemini/
|  +- intelligence/
|  +- io/
|  \- memory/
|     \- bedside/
+- store/
+- types/
\- utils/
```

Purpose notes:

- **Mirrors runtime layout**: `tests/features/*` mirrors `features/*`; `tests/services/*` mirrors `services/*`.
- **Fixtures**: `tests/services/fixtures/manuscripts/` provides manuscript examples for deterministic/intelligence tests.
- **Mocks**: `tests/mocks/*` includes Gemini client mocks.
- **Setup**: `tests/setup.ts` configures the test environment.

---

## `docs/` — project documentation (incl. generated test health)

```text
docs/
+- AGENT_ARCHITECTURE.md
+- AGENT_ROUTING.md
+- AGENT_TOOLS_REFERENCE.md
+- APP_BRAIN_FLOW.md
+- ARCHITECTURE.md
+- BEDSIDE_NOTE_ROADMAP.md
+- FEATURE_ROADMAP.md
+- GAP_ANALYSIS_PUBLICATION_FLOW.md
+- INTELLIGENCE_ENGINE.md
+- MEMORY_SYSTEM.md
+- PERSONA_ROADMAP.md
+- README.md
+- TEST_AUDIT.md
+- TEST_COVERAGE_PLAN.md
+- TEST_COVERAGE.md
+- TESTING.md
\- token-limits.md
```

Purpose notes:

- **Architecture orientation**: `ARCHITECTURE.md`, `APP_BRAIN_FLOW.md`, `AGENT_ARCHITECTURE.md`, `INTELLIGENCE_ENGINE.md`.
- **Agent extension/debugging**: `AGENT_ROUTING.md`.
- **Generated health**: `TEST_COVERAGE.md`, `TEST_AUDIT.md` (auto-generated; do not hand-edit).

---

## `config/` — model/API limits + heuristics

```text
config/
+- api.ts
+- heuristics.ts
+- index.ts
\- models.ts
```

Purpose notes:

- **Token/model budgets and limits** are defined here (referenced by `services/gemini/*` and described in `docs/ARCHITECTURE.md`).
- Key entrypoints:
  - `config/models.ts` (model configs, thinking budgets)
  - `config/api.ts` (API defaults / max lengths)
