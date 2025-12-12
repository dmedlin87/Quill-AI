# AI Audit 03 — Risk Register (Coverage vs Confidence)

Inputs (repo-generated):

- `coverage/coverage-summary.json`
- `docs/TEST_AUDIT.md`
- `AI_AUDIT/logs/p3_final_top25_xray_v5.json`

Scoring fields used below (from `p3_final_top25_xray_v5.json`):

- **Coverage**: per-file % for statements/branches/functions/lines.
- **Test mix**: unit vs integration test count (by file path convention: `tests/integration/*` or `*.integration.test.*`).
- **Mocking intensity**: derived from `vi.mock(` frequency per test file.
- **Confidence score (0–5)**: heuristic combining coverage level + integration presence + assertion density penalties (e.g., high `toBeDefined`) + mocking penalties + “coverage-only” tests.
- **Risk score**: combines criticality (runtime funnel weight), confidence penalty, coverage penalty, mocking penalty, code size/branch complexity penalty.

## Top 15 Risk Areas (ranked)

Notes:

- “Coverage-only” tests are detected by filename `*_coverage.test.*`.
- Several high-risk items are “covered” but still risky due to **high mocking**, **thin assertions**, or **coverage concentrated in unit-only tests**.

| Rank | Module | Criticality | Coverage (S/B/F/L) | Tests (unit/integration) | Mocking | Confidence | Risk | Key evidence / why risky |
|------|--------|-------------|---------------------|--------------------------|---------|------------|------|--------------------------|
| 1 | `features/core/context/AppBrainContext.tsx` | 3 | 94.7 / **75.51** / 92.98 / 94.24 | 4 / 0 | **high** (avg `vi.mock`/test: **8.5**) | **2** | **11.49** | Central context aggregator; branch coverage is below threshold while tests are unit-only and heavily mocked. See tests: `tests/context/AppBrainContext.test.tsx`, `tests/features/core/AppBrainContext.test.tsx`, `tests/components/EditorLayout.test.tsx`, `tests/features/layout/EditorLayout.test.tsx`. |
| 2 | `services/appBrain/runtime.ts` | 3 | 89.61 / **74.19** / **73.33** / 89.47 | 1 / 0 | medium | **2** | **10.66** | Runtime orchestrator has **only 1 test file** and relies on heavy mocking for memory + Gemini + proactive thinker (see `tests/services/appBrain/runtime.test.ts`: `vi.mock('@/services/memory'...)`, `vi.mock('@/services/gemini/client'...)`, `vi.mock('@/services/appBrain/proactiveThinker'...)`). Low branches + functions indicates missing lifecycle edge cases. |
| 3 | `features/editor/components/EditorWorkspace.tsx` | 2 | 91.01 / **78.49** / 85.71 / 90.58 | 2 / 0 | **high** | **2** | **8.47** | Core editor surface; tests are largely component wiring with broad mocks (see `tests/components/EditorWorkspace.test.tsx` and `tests/features/editor/components/EditorWorkspace.test.tsx`: mocks `EditorContext`, `ProjectStore`, `useEngine`, `useManuscriptIntelligence`, layout store, and subcomponents). Branch coverage remains low. |
| 4 | `features/shared/hooks/useManuscriptIntelligence.ts` | 2 | **76.06** / **63.01** / 91.66 / 75.4 | 3 / 0 | **high** | **2** | **8.37** | Deterministic intelligence pipeline uses timers/work scheduling; tests mock the entire intelligence service surface (`tests/features/shared/hooks/useManuscriptIntelligence.test.ts` mocks `@/services/intelligence`) and rely heavily on fake timers, which can miss worker/idle-callback behavior and concurrency branches. |
| 5 | `features/project/store/useProjectStore.ts` | 3 | 95.18 / **79.59** / 98.18 / 96.4 | 6 / 3 | medium | **3** | **7.99** | Project persistence + debounce + Dexie interactions. Despite integration tests, the store frequently depends on mocked DB/indexer in unit tests (e.g. `tests/store/useProjectStore.test.ts`). Branch coverage < 80 suggests edge conditions around persistence/flush/keep-alive are under-tested. |
| 6 | `features/analysis/components/ShadowReaderPanel.tsx` | 2 | **79.16** / **55.88** / 85.71 / 82.6 | 1 / 0 | medium | **2** | **7.67** | `docs/TEST_AUDIT.md` flags this file as **missing tests**. There is a test importing `ShadowReaderPanel` (`tests/features/analysis/ShadowReader.test.tsx`), but the audit’s “missing” signal suggests the test suite may not be matched/recognized by naming heuristics (and branch coverage is very low). The existing test uses mocks for `useReaderStore`, `EditorContext`, and `findQuoteRange`, and has low assertion count (9 expects total). |
| 7 | `features/export/utils/exportFormats.ts` | 2 | **72.22** / **42.85** / 100 / 76.47 | 2 / 0 | medium | **2** | **7.61** | Export format branching is wide (TXT/MD/DOCX/PDF). Branch coverage is extremely low. Tests mock `pdfExportService`, `docxExporter`, and manuscript export adapters (`tests/features/export/utils/exportFormats.test.ts`), which reduces realism for failure + formatting edge cases. |
| 8 | `services/intelligence/index.ts` | 3 | 99.14 / **82.97** / 100 / 100 | 18 / 1 | low | **3** | **7.49** | Contains `*_coverage.test.ts` (`tests/services/intelligence/index_coverage.test.ts`) indicating intentional coverage chasing. Also high `toBeDefined` usage (114) suggests weaker assertions; risk remains in async scheduling/caching behaviors even with high overall statement coverage. |
| 9 | `services/appBrain/proactiveThinker.ts` | 3 | 94.34 / **83.96** / 93.33 / 96.4 | 3 / 1 | **high** (avg `vi.mock`/test: **5.75**) | 4 | 5.81 | Complex background orchestration calling Gemini + memory + intelligence bridges. Tests heavily hoist mocks for Gemini, memory, and event bus (`tests/services/appBrain/proactiveThinker.test.ts`). High complexity (branchesTotal 262) means many unvalidated decision paths. |
| 10 | `services/intelligence/chunkManager.ts` | 3 | 93.01 / **80.43** / 95.23 / 94.77 | 3 / 1 | low | 4 | 4.94 | Has a dedicated coverage test (`tests/services/intelligence/chunkManager_coverage.test.ts`). Coverage-only tests + asynchronous chunking logic can conceal correctness issues (ordering, cancellation, cache invalidation). |
| 11 | `services/gemini/toolExecutor.ts` | 3 | 98.46 / **89.11** / 94.44 / 98.93 | 4 / 0 | medium | 4 | 4.74 | Tool routing & argument mapping is high impact. Tests mock command history, command registry, and memory (`tests/services/gemini/toolExecutor.test.ts` includes `vi.mock('@/services/commands/registry'...)` and `vi.mock('@/services/memory'...)`). Risk remains in “real” registry/tool wiring + error propagation. |
| 12 | `services/core/AgentController.ts` | 3 | 98.88 / **84** / 100 / 98.88 | 2 / 0 | medium | 4 | 4.25 | Agent loop controller correctness depends on model response shapes + tool loop integration. Tests mock `agentSession`, memory bedside note retrieval, and appBrain context (`tests/services/core/AgentController.test.ts`), which reduces end-to-end realism. |
| 13 | `services/appBrain/significantEditMonitor.ts` | 3 | 85.71 / **80** / 82.35 / 86.66 | 2 / 1 | medium | 4 | 4.2 | Threshold/cooldown/debounce logic can be flaky. Tests use a custom mocked `eventBus` implementation and fake timers (`tests/services/appBrain/significantEditMonitor.test.ts`), with modest assertion density (46 expects total across 3 tests). |
| 14 | `services/core/agentSession.ts` | 3 | **82** / **84.37** / 100 / **82** | 3 / 0 | medium | 4 | 4.16 | Prompt/context assembly for the agent. Tests mock Gemini session creation and memory providers (`tests/services/core/agentSession.test.ts`), leaving risk around prompt formatting drift and integration with real model adapter. |
| 15 | `services/memory/chains.ts` | 2 | 100 / **89.74** / 100 / 100 | 7 / 0 | medium | 4 | 3.78 | Strong overall test surface, but moderate branch gaps remain; chains are core to “memory correctness.” Some tests rely on mocked DB & memory services (e.g., `tests/services/memory/chains.test.ts`). |

## Top-25 Critical Modules (for reference)

The full top-25 dataset (with computed labels/scores) is recorded in:

- `AI_AUDIT/logs/p3_final_top25_xray_v5.json`

This Risk Register focuses on the top 15 by computed risk score.
