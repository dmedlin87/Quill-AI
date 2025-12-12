# AI Audit 03 — Top Gaps (Concrete Missing Tests)

This list is derived from the highest-risk modules in `AI_AUDIT/logs/p3_final_top25_xray_v5.json` and grounded by file-specific signals:

- Low branch coverage
- Unit-only coverage on critical funnels
- High mocking density (`vi.mock`) and weak assertions
- Presence of `*_coverage.test.*` “coverage-only” tests
- `docs/TEST_AUDIT.md` “missing tests” findings

Each item below includes:

- **Target file** (production)
- **Add/adjust tests** (where to put them)
- **Missing behaviors** (what to assert)

## 1) AppBrain lifecycle + orchestration edge cases

- **Target**: `services/appBrain/runtime.ts`
- **Current evidence**:
  - Single test file: `tests/services/appBrain/runtime.test.ts`
  - Heavy mocking of memory + Gemini + proactive thinker in that test.
  - Low coverage: branches 74.19%, functions 73.33%.
- **Missing tests to add**:
  - **`tests/services/appBrain/runtime.test.ts`**
    - Assert start() idempotency beyond “warns” (e.g., verify service start/stop call ordering, config override behavior).
    - Add explicit tests for `persistEvents: true` vs `false` that validate event persistence is actually toggled (currently “implicitly tested by not throwing”).
    - Add tests for project switching while services are running: verify event observer and monitors reset as expected.

## 2) AppBrainContext: high-mock unit tests + branch gaps on a core funnel

- **Target**: `features/core/context/AppBrainContext.tsx`
- **Current evidence**:
  - Branch coverage 75.51% (below repo thresholds).
  - Mocking intensity is high (avg `vi.mock`/test: 8.5).
  - Tests are unit-only: `tests/context/AppBrainContext.test.tsx` + layout-related tests.
- **Missing tests to add**:
  - **New**: `tests/integration/appbrain-context-flow.test.tsx`
    - Render providers with more real dependencies (minimize `vi.mock`), and assert:
      - Event emission when selection/cursor changes.
      - Context builder updates when manuscript/chapter changes.
  - **Expand**: `tests/context/AppBrainContext.test.tsx`
    - Add branch-focused tests covering “null/empty” states (no active chapter, missing intelligence HUD portions, selection cleared transitions).

## 3) EditorWorkspace: large UI surface tested mostly via mocked wiring

- **Target**: `features/editor/components/EditorWorkspace.tsx`
- **Current evidence**:
  - Branch coverage 78.49%.
  - Tests mock `EditorContext`, `useProjectStore`, `useEngine`, `useManuscriptIntelligence`, layout store, and subcomponents:
    - `tests/components/EditorWorkspace.test.tsx`
    - `tests/features/editor/components/EditorWorkspace.test.tsx`
- **Missing tests to add**:
  - **New**: `tests/integration/editor-workspace-flow.test.tsx`
    - Provide real `EditorContext` / `ProjectStore` if possible (or unmock them), and assert:
      - Selection → MagicBar behavior with real selection updates.
      - Zen-mode hotkeys do not double-toggle across rerenders.
      - `useManuscriptIntelligence` alignment when chapter id changes (currently mostly mocked).

## 4) useManuscriptIntelligence: async scheduling + concurrency not covered realistically

- **Target**: `features/shared/hooks/useManuscriptIntelligence.ts`
- **Current evidence**:
  - Very low branches 63.01%, statements 76.06%.
  - Tests mock all intelligence processors (`tests/features/shared/hooks/useManuscriptIntelligence.test.ts` mocks `@/services/intelligence`).
- **Missing tests to add**:
  - **Expand**: `tests/features/shared/hooks/useManuscriptIntelligence.test.ts`
    - Add tests for:
      - Cursor updates affecting HUD (`updateHUDForCursor`) and ensuring consistent `processingTier` transitions.
      - Worker/idle-callback fallback paths (if implemented) by stubbing `requestIdleCallback` and/or Worker presence.
      - “out-of-order” updates: multiple `updateText()` calls where background processing finishes after a newer update.

## 5) Project persistence store: edge cases around debounce/flush/persistence failure

- **Target**: `features/project/store/useProjectStore.ts`
- **Current evidence**:
  - Branch coverage 79.59%.
  - Mix of unit + integration tests exists (9 total; 3 integration), but persistence behavior is often mocked (e.g., `tests/store/useProjectStore.test.ts`).
- **Missing tests to add**:
  - **Expand**: `tests/store/useProjectStore.test.ts`
    - Add explicit coverage for:
      - Persistence error paths (DB failure during debounced write).
      - `flushPendingWrites` behavior when multiple writes queued.
      - Chapter switching while writes pending.

## 6) ShadowReaderPanel: audit flags “missing tests” + very low branches

- **Target**: `features/analysis/components/ShadowReaderPanel.tsx`
- **Current evidence**:
  - `docs/TEST_AUDIT.md` lists this file under “Source Files Missing Tests”.
  - Current test exists but is named `tests/features/analysis/ShadowReader.test.tsx`.
  - Branch coverage is very low: 55.88%.
- **Missing tests to add**:
  - **New**: `tests/features/analysis/components/ShadowReaderPanel.test.tsx`
    - Ensure the audit recognizes the matching test filename.
    - Add branch tests for:
      - When `findQuoteRange` returns null (should not add comment).
      - Multiple reactions → multiple comments appended deterministically.
      - “isReading” state disables actions / shows loading.

## 7) Export formats: wide branching with very low branch coverage

- **Target**: `features/export/utils/exportFormats.ts`
- **Current evidence**:
  - Branch coverage 42.85%.
  - Tests mock PDF + DOCX exporters (`tests/features/export/utils/exportFormats.test.ts`).
- **Missing tests to add**:
  - **Expand**: `tests/features/export/utils/exportFormats.test.ts`
    - Add tests for each format branch:
      - Markdown export escaping + paragraph spacing.
      - PDF export failure propagation (rejection path).
      - DOCX export data shaping (assert arguments to `exportStandardManuscriptDocx`).
      - HTML stripping edge cases (entities, nested tags, empty paragraphs).

## 8) Intelligence “index”: coverage-only tests + weak assertion signals

- **Target**: `services/intelligence/index.ts`
- **Current evidence**:
  - Includes `tests/services/intelligence/index_coverage.test.ts`.
  - High `toBeDefined` usage suggests weak assertions (from audit signals).
- **Missing tests to add**:
  - **Expand**: `tests/services/intelligence/index.test.ts`
    - Prefer behavior assertions over existence:
      - Cache invalidation rules.
      - Determinism for same input text.
      - Failure handling when underlying processors throw.

## 9) ChunkManager: async correctness and ordering masked by coverage tests

- **Target**: `services/intelligence/chunkManager.ts`
- **Current evidence**:
  - Includes `tests/services/intelligence/chunkManager_coverage.test.ts`.
- **Missing tests to add**:
  - **Expand**: `tests/services/intelligence/chunkManager.integration.test.ts`
    - Add explicit tests for:
      - Cancellation (new request supersedes prior).
      - Stable ordering of chunk outputs.
      - Handling empty / whitespace-only manuscript.

## 10) Tool execution: real command registry integration

- **Target**: `services/gemini/toolExecutor.ts`
- **Current evidence**:
  - Tests mock `CommandRegistry`, history, and memory (`tests/services/gemini/toolExecutor.test.ts`).
- **Missing tests to add**:
  - **New**: `tests/integration/tool-executor-registry.integration.test.ts`
    - Use the real `CommandRegistry` and a lightweight in-memory `AppBrainActions` implementation.
    - Validate unknown tool names and error propagation paths without swallowing failures.

## 11) AgentController: end-to-end tool loop realism

- **Target**: `services/core/AgentController.ts`
- **Current evidence**:
  - Test suite mocks agent session creation + memory + appBrain context (`tests/services/core/AgentController.test.ts`).
- **Missing tests to add**:
  - **New**: `tests/integration/agent-tool-loop.integration.test.ts`
    - Use a minimal “fake model” that returns functionCalls and then a completion.
    - Assert sequencing:
      - initialization message
      - tool call adapter
      - tool executor results appended
      - final assistant response

## 12) Significant edit monitor: timing edge cases

- **Target**: `services/appBrain/significantEditMonitor.ts`
- **Current evidence**:
  - Fake-timer driven tests with mocked event bus (`tests/services/appBrain/significantEditMonitor.test.ts`).
- **Missing tests to add**:
  - **Expand**: `tests/services/appBrain/significantEditMonitor.test.ts`
    - Add tests for:
      - edits exactly on the threshold boundary.
      - cooldown boundary: event right before and right after cooldown expiry.
      - multiple projects (ensure projectId scoping is correct on restart).

## Status

This file is intended to be actionable: each bullet names exactly where to add tests and what behavior to assert.
