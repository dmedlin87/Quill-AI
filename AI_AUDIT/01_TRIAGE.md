# Test Trust Triage — Quill AI

Date: 2025-12-12

## Ground truth inputs used

- `AI_AUDIT/00_BASELINE.md`
- `docs/TEST_COVERAGE.md` (auto-generated)
- `docs/TEST_AUDIT.md` (auto-generated)
- `coverage/coverage-summary.json`
- `AI_AUDIT/logs/test_coverage.log` (key lines via grep)
- `AI_AUDIT/logs/test_status.log`
- `AI_AUDIT/logs/test_audit.log`
- In-repo test logs:
  - `test_output.txt`
  - `test_output_2.txt`

## Baseline snapshot (what is currently “true”)

- **Test status**
  - **Total**: `4428`
  - **Passed**: `4427`
  - **Failed**: `0`
  - **Pending**: `1` (see `tests/features/shared/hooks/useManuscriptIntelligence.test.ts` — skipped worker test)
- **Coverage summary**
  - **Statements**: `95.95%`
  - **Branches**: `87.96%` (global target `90%` — below threshold)
  - **Functions**: `95.56%`
  - **Lines**: `96.81%`
- **Why `npm run test:full` fails**
  - `ERROR: Coverage for branches (87.96%) does not meet global threshold (90%)`

## What coverage is lying about (top 5 examples)

1. **Global mocks make “covered” code not run in realistic conditions**
   - **Paths**:
     - `tests/setup.ts` (global mocks)
     - `services/db.ts` (Dexie schema, but replaced by Map-backed mock in tests)
     - `services/gemini/*` (SDK mocked)
   - **Why it lies**:
     - Many tests execute against a simplified universe:
       - `vi.mock('@google/genai', ...)`
       - `vi.mock('@/services/db', ...)`
       - `vi.mock('@/features/core/context/EditorContext', ...)`
       - `vi.mock('@/features/project/store/useProjectStore', ...)`
     - High coverage here can mean “the mock behaved”, not “the real integration works”.

1. **Coverage tests with weak or missing assertions**
   - **Paths**:
     - `tests/services/intelligence/chunkManager_coverage.test.ts`
   - **Why it lies**:
     - Multiple tests execute code without verifying outcomes (e.g., `pause and resume`, `getAnalysisAtCursor returns analysis`, `should stop processing when destroyed`).
     - These tests can keep coverage green while allowing regressions.

1. **Barrel export tests inflate coverage while skipping behavior**
   - **Paths**:
     - `tests/features/index-exports.test.ts`
   - **Why it lies**:
     - Primarily asserts exports are defined (`toBeDefined()`), not that features function.
     - Also uses dependency mocks to make imports succeed (so it can hide runtime import-time failures).

1. **Timing/concurrency is disabled globally, hiding race bugs**
   - **Paths**:
     - `tests/setup.ts`
   - **Why it lies**:
     - `__QUILL_WRITE_DEBOUNCE_MS = 0` removes real typing/persistence timing windows.
     - `globalThis.Worker = MockWorker` prevents worker scheduling/cancellation behavior from being tested.

1. **Agent tool schema can pass tests while tool execution is broken**
   - **Paths**:
     - `services/gemini/agentTools.ts` (declares tools)
     - `services/gemini/toolExecutor.ts` (executes tool calls)
     - `services/commands/registry.ts` (another tool-ish registry)
   - **Why it lies**:
     - `tests/services/gemini/agentTools.test.ts` validates schemas and naming conventions.
     - But `toolExecutor.ts` does not implement several tools declared in `agentTools.ts`, and some implemented tools have mismatched semantics.
     - This is “100% covered” in the wrong place: tests prove the catalog exists, not that tools work.

## Top 15 prioritized test-trust gaps (ranked backlog)

1. **Agent tool contract drift (schema vs executor vs registry)**
   - **Category**: integration boundary untested
   - **Paths**:
     - `services/gemini/agentTools.ts`
     - `services/gemini/toolExecutor.ts`
     - `services/commands/registry.ts`
   - **Why it matters (bug scenario)**:
     - The agent can call a tool the UI/tool-schema advertises, and receive `Unknown tool: ...` at runtime.
     - This can cause stalled tool loops, repeated retries, or “agent hallucinated a tool” behavior.
   - **Suggested test shape**:
     - A contract test that iterates `ALL_AGENT_TOOLS` and asserts:
       - `ToolExecutor.hasCommand(name)` implies `executeAgentToolCall(name, ...)` is not `Unknown tool`, and
       - every non-memory tool name has a real execution path.

1. **Cursor/edit semantics mismatch: `insert_at_cursor` appends instead of inserting**
   - **Category**: integration boundary untested
   - **Paths**:
     - `services/gemini/agentTools.ts` (tool intent)
     - `services/gemini/toolExecutor.ts` (`insert_at_cursor` routes to `actions.appendText`)
   - **Why it matters (bug scenario)**:
     - Agent attempts “insert here”, but text is appended to end-of-chapter.
     - This is a silent correctness bug (user may not notice until later).
   - **Suggested test shape**:
     - A minimal AppBrainActions fake with `insertAtCursor` vs `appendText` semantics, asserting correct method is called.

1. **Selection semantics mismatch: `set_selection` highlights instead of selecting**
   - **Category**: integration boundary untested
   - **Paths**:
     - `services/gemini/agentTools.ts`
     - `services/gemini/toolExecutor.ts` (`set_selection` calls `actions.highlightText(..., 'info')`)
   - **Why it matters (bug scenario)**:
     - Follow-up tools (“rewrite selection”, “critique selection”) may operate on stale selection state.
   - **Suggested test shape**:
     - Integration-ish test: tool call → editor state selection updated (not just a highlight).

1. **Declared tools not implemented at all in executor**
   - **Category**: integration boundary untested
   - **Paths**:
     - Declared in `services/gemini/agentTools.ts`: `switch_view`, `show_character_in_graph`, `get_relationships`, `get_open_plot_threads`, `suggest_dialogue`, `generate_scene_beat`, `create_branch`, `explain_plot_issue`, `get_pacing_at_cursor`, `check_contradiction`
     - Missing/partial in `services/gemini/toolExecutor.ts`
   - **Why it matters (bug scenario)**:
     - A tool can exist in the schema and pass unit tests, but be a runtime dead-end.
   - **Suggested test shape**:
     - Table-driven test asserting every declared tool has an executor case (or is explicitly unsupported and not exposed).

1. **Core state/store integration is mostly mocked**
   - **Category**: over-mocked
   - **Paths**:
     - `tests/setup.ts` (global mocks for `EditorContext` and `useProjectStore`)
   - **Why it matters (bug scenario)**:
     - State transition bugs (undo/redo, chapter switch mid-edit, persistence order) can ship because tests don’t exercise real providers.
   - **Suggested test shape**:
     - A small number of “unmocked” integration tests that render real providers and assert real state transitions.

1. **Debounce + concurrency windows are not tested (globally disabled)**
   - **Category**: flaky/time-based, dead code covered by setup
   - **Paths**:
     - `tests/setup.ts` (`__QUILL_WRITE_DEBOUNCE_MS = 0`, Worker mocked)
   - **Why it matters (bug scenario)**:
     - Real user typing involves overlapping debounces and async persistence; race bugs can cause stale writes or desync.
   - **Suggested test shape**:
     - A targeted suite that temporarily restores realistic debounce and uses fake timers to assert correct ordering.

1. **Worker path for intelligence is explicitly skipped**
   - **Category**: no error-path tests, flaky/time-based
   - **Paths**:
     - `tests/features/shared/hooks/useManuscriptIntelligence.test.ts` (skipped test)
     - `features/shared/hooks/useManuscriptIntelligence.ts` (worker init, message handling, cancellation)
   - **Why it matters (bug scenario)**:
     - Worker-only failures (invalid URL, message id mismatch, cancellation races) won’t be caught.
   - **Suggested test shape**:
     - Replace the skipped test with a deterministic “worker adapter” test (mock Worker + URL) that asserts:
       - request id matching
       - progress updates
       - result updates
       - cancellation behavior

1. **Coverage-only intelligence tests don’t fail when behavior regresses**
   - **Category**: missing assertions
   - **Paths**:
     - `tests/services/intelligence/chunkManager_coverage.test.ts`
   - **Why it matters (bug scenario)**:
     - Chunk processing regressions can silently degrade HUD/context quality.
   - **Suggested test shape**:
     - Convert key “no-expect” tests into behavior assertions (e.g., ensure pause prevents processing; ensure destroyed prevents timers).

1. **Significant edit detection is time-based and lightly tested**
   - **Category**: flaky/time-based, no error-path tests
   - **Paths**:
     - `services/appBrain/significantEditMonitor.ts`
   - **Why it matters (bug scenario)**:
     - Misfires can spam bedside notes / proactive cycles, or fail to trigger when needed.
   - **Suggested test shape**:
     - Fake-timer tests around threshold, debounce, cooldown, and duplicate timestamp suppression.

1. **Agent session prompt context formatting is a correctness boundary**
   - **Category**: integration boundary untested
   - **Paths**:
     - `services/core/agentSession.ts` (`buildManuscriptContext`, memory context assembly)
   - **Why it matters (bug scenario)**:
     - If the “ACTIVE chapter” heuristic is wrong, the agent may edit the wrong chapter or refuse edits incorrectly.
   - **Suggested test shape**:
     - Pure string snapshot/expect tests for:
       - active vs read-only chapter labeling
       - separator formatting
       - memory context fallback on errors

1. **Navigation commands are untested (regex-heavy + chapter targeting)**
   - **Category**: missing assertions
   - **Paths**:
     - `services/commands/navigation.ts`
   - **Why it matters (bug scenario)**:
     - Agent navigation can jump to wrong position/chapter; regex mistakes can cause false positives.
   - **Suggested test shape**:
     - Unit tests for:
       - `exact` search
       - `fuzzy` search
       - `dialogue` search (with character)
       - `chapter` filtering and `selectChapter` behavior
       - `not found` messaging

1. **Shadow Reader panel: audit says “missing tests”, and error paths are lightly covered**
   - **Category**: missing assertions, type-only coverage
   - **Paths**:
     - `features/analysis/components/ShadowReaderPanel.tsx` (flagged missing in `docs/TEST_AUDIT.md`)
     - `tests/features/analysis/ShadowReader.test.tsx` (exists, but naming doesn’t match audit expectations)
   - **Why it matters (bug scenario)**:
     - The panel can fail to add comments when quote matching fails (`findQuoteRange` returns null).
     - Audit tooling may be giving a false negative, so “gaps” tracking is unreliable.
   - **Suggested test shape**:
     - Add/rename a matching test file and cover:
       - quote-not-found path
       - severity mapping branches
       - disabled read button when no text

1. **Export formats (especially txt/md) have complex HTML-stripping logic and side effects**
   - **Category**: integration boundary untested
   - **Paths**:
     - `features/export/utils/exportFormats.ts` (low branch coverage)
   - **Why it matters (bug scenario)**:
     - Exports can produce malformed plaintext (lost paragraph breaks, incorrect entity decoding) or leak object URLs.
   - **Suggested test shape**:
     - JSDOM tests that spy on `URL.createObjectURL`/`revokeObjectURL`, and validate transformed output.

1. **Command registry behavior is under-tested (low functions coverage)**
   - **Category**: missing assertions
   - **Paths**:
     - `services/commands/registry.ts`
   - **Why it matters (bug scenario)**:
     - Registry drift can break tool execution and undo/redo expectations.
   - **Suggested test shape**:
     - Tests for `getAllNames`, `getByCategory`, `isReversible`, and “known commands exist”.

1. **Noisy tests reduce signal and can hide real failures**
   - **Category**: flaky/time-based
   - **Paths**:
     - `test_output_2.txt` (vitest warnings)
     - `tests/services/gemini/client.test.ts` (emits warnings about mock usage)
   - **Why it matters (bug scenario)**:
     - When logs are always noisy, teams stop paying attention; genuine warnings become background noise.
   - **Suggested test shape**:
     - Enforce `console.warn/error` expectations (or suppress) so unexpected logs fail tests.

## 3–5 high-bug-surface flows that deserve integration-style tests

1. **Agent tool call round-trip (tool loop boundary)**
   - **Paths**:
     - `services/core/toolRunner.ts`
     - `services/gemini/toolExecutor.ts`
     - `services/gemini/agentTools.ts`
   - **Test shape**:
     - Provide a fake `FunctionCall[]` with several tools (one valid, one invalid) and assert:
       - UI messages are emitted
       - errors produce functionResponse results
       - command history behavior is sane

1. **Editor session → persistence (stale-write / chapter switch race)**
   - **Paths (critical funnel)**:
     - `tests/setup.ts` (currently bypasses debounce)
     - `features/core/context/EditorContext.tsx`
     - `features/project/store/useProjectStore.ts`
   - **Test shape**:
     - Unmocked provider test that simulates typing + switching chapter and asserts persisted chapter content matches UI.

1. **Intelligence pipeline: main-thread fallback vs worker**
   - **Paths**:
     - `features/shared/hooks/useManuscriptIntelligence.ts`
     - `services/intelligence/worker.ts`
   - **Test shape**:
     - Deterministic worker mock that emits READY/PROGRESS/RESULT and verifies hook state transitions.

1. **Proactive trigger: significant edits → bedside note evolution**
   - **Paths**:
     - `services/appBrain/significantEditMonitor.ts`
     - `services/appBrain/eventBus.ts`
   - **Test shape**:
     - Fake timers + event bus: emit many `TEXT_CHANGED` events and assert exactly one trigger per cooldown.

1. **Tool-driven navigation (chapter targeting + cursor range)**
   - **Paths**:
     - `services/commands/navigation.ts`
     - `services/gemini/toolExecutor.ts` (navigation tool calls)
   - **Test shape**:
     - Integrate command + deps stub: ensure chapter selection + `navigateToRange` are called with correct indices.

## Next tests to write (highest ROI)

1. **Tool contract test**
   - **Why**: catches tool drift immediately; protects the agent UX.
   - **Suggested location**: `tests/services/gemini/toolContract.test.ts` (new)

1. **Navigation command tests (`NavigateToTextCommand`, `JumpToSceneCommand`)**
   - **Why**: regex-heavy logic; direct user-visible behavior.
   - **Suggested location**: `tests/services/commands/navigation.test.ts` (new)

1. **Significant edit monitor timing tests**
   - **Why**: prevents spam/missed triggers.
   - **Suggested location**: `tests/services/appBrain/significantEditMonitor.test.ts` (new)

1. **Unskip/replace worker integration test**
   - **Why**: worker path currently has effectively zero trust.
   - **Suggested location**: improve `tests/features/shared/hooks/useManuscriptIntelligence.test.ts`

1. **ExportFormats tests (txt/md conversion + URL lifecycle)**
   - **Why**: user-facing output; low branch coverage + real DOM side effects.
   - **Suggested location**: `tests/features/export/utils/exportFormats.test.ts` (new)

## Stop doing this (repo-specific anti-patterns detected)

- **Writing tests that contain no meaningful assertions**
  - Example: `tests/services/intelligence/chunkManager_coverage.test.ts` has several `it(...)` blocks with no `expect(...)`.

- **Relying on global mocks for core state as the default testing mode**
  - Example: `tests/setup.ts` mocks `EditorContext`, `useProjectStore`, and `services/db`.

- **Using “exports exist” tests as a substitute for behavior tests**
  - Example: `tests/features/index-exports.test.ts`.

- **Leaving critical-path tests permanently skipped**
  - Example: worker test skipped in `tests/features/shared/hooks/useManuscriptIntelligence.test.ts`.

- **Allowing noisy console output in tests without expectations**
  - Evidence: `test_output_2.txt` shows recurring vitest warnings and runtime warnings.
