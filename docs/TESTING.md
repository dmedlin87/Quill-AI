# Quill AI Testing Plan

> This document describes the testing strategy, health suite, and CI flow for Quill AI.  
> For **up‑to‑date coverage and gap analysis**, see:
>
> - [TEST_COVERAGE.md](./TEST_COVERAGE.md) – auto‑generated coverage report
> - [TEST_AUDIT.md](./TEST_AUDIT.md) – auto‑generated test gap audit
> - `coverage/index.html` – full HTML coverage report from Vitest

---

## Overview

Quill AI uses:

- **Vitest** for unit, integration, and component tests
- **V8 coverage** with hard **thresholds** enforced in Vite and CI:
  - Statements **≥ 80%**
  - Branches **≥ 75%**
  - Functions **≥ 80%**
  - Lines **≥ 80%**
- A **Test Health Suite** of Node scripts that:
  - Generate coverage docs
  - Track historical trends
  - Audit missing tests
  - Block regressions in CI

---

## Test Health Suite & CI Flow

### Local Commands

| Command | Purpose |
|--------|---------|
| `npm test` | Run all tests (no coverage, watch‑friendly in dev) |
| `npm run test:run` | Run tests once (no watch) |
| `npm run test:quick` | Fast dot‑reporter run for quick feedback |
| `npm run test:ui` | Open Vitest UI for focused debugging |
| `npm run test:coverage` | Run tests with coverage, write `coverage/coverage-summary.json` & HTML report |
| `npm run test:status` | Generate [docs/TEST_COVERAGE.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_COVERAGE.md:0:0-0:0) + update `coverage/history.json` |
| `npm run test:audit` | Generate [docs/TEST_AUDIT.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_AUDIT.md:0:0-0:0) (missing & stale tests) |
| `npm run test:regression` | Fail if coverage drops more than **2.0 points** vs baseline |
| `npm run test:docs` | Ensure [TEST_COVERAGE.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_COVERAGE.md:0:0-0:0) / [TEST_AUDIT.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_AUDIT.md:0:0-0:0) are **fresh** vs git HEAD date |
| `npm run test:docs:strict` | Ensure coverage docs in the working tree match committed generator output |
| `npm run test:full` | Convenience: `test:coverage` + `test:status` + `test:audit` in one command |

### Coverage Report Generation

Pipeline (matches the **Coverage Report Generation** codemap):

1. **Collect coverage**  
   - `npm run test:coverage` → Vitest writes `coverage/coverage-summary.json` and HTML report.
2. **Generate status report** ([scripts/generate-test-status.mjs](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/scripts/generate-test-status.mjs:0:0-0:0))  
   - Reads `coverage-summary.json` and optional `vitest-report.json`.  
   - Extracts total coverage metrics.  
   - Appends a snapshot to `coverage/history.json` (up to the last 100 runs).  
   - Writes [docs/TEST_COVERAGE.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_COVERAGE.md:0:0-0:0) with:
     - Hero badge line (tests + coverage + date)
     - Coverage summary & threshold health
     - Test counts table
     - Coverage gaps & lowest‑coverage files
     - Historical coverage trend

### Test Gap Auditing

Flow (matches the **Test Gap Auditing** codemap):

1. **Scan source files**  
   - Scans [features/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests/features:0:0-0:0), [services/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests/services:0:0-0:0), [config/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests/config:0:0-0:0), [types/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests/types:0:0-0:0) for `.ts` / `.tsx`.
2. **Scan tests**  
   - Scans [tests/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests:0:0-0:0) for `.test.ts` / `.test.tsx`.
3. **Identify missing tests**  
   - For each source file, looks for a matching test file by basename.  
   - If no match, it is added to **“Source Files Missing Tests”**.
4. **Detect stale tests**  
   - For each test file, checks if a corresponding source file exists.  
   - If not, it goes into **“Potentially Stale Test Files”** (may be integration tests or dead tests).
5. **Generate audit report**  
   - Writes summary + tables to [docs/TEST_AUDIT.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_AUDIT.md:0:0-0:0) with a `Last updated:` stamp.

### Coverage Regression Checking

Flow (matches the **Coverage Regression Checking** codemap):

1. **Load current metrics**  
   - Reads `coverage/coverage-summary.json` → current statements/branches/functions/lines.
2. **Load baseline from history**  
   - Reads `coverage/history.json`.  
   - Uses the **previous snapshot** as the regression baseline.
3. **Compare metrics**  
   - Computes deltas between current and baseline.  
   - Applies `MAX_DROP` thresholds: **2.0 percentage points** per metric.
4. **Enforce outcome**  
   - If any metric drops by more than 2.0 points → exits with non‑zero status (CI failure).  
   - Otherwise prints a “NO REGRESSION” summary and succeeds.

### CI Workflow (GitHub Actions)

Flow (see [.github/workflows/tests.yml](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/.github/workflows/tests.yml:0:0-0:0)):

1. **Test execution phase**  
   - `npm run test:coverage` (with `CI=true`).
2. **Quality enforcement phase**  
   - `npm run test:regression` – block coverage regressions > 2 points.
3. **Documentation validation phase**  
   - `npm run test:docs` – coverage docs are recent vs HEAD commit date.  
   - `npm run test:docs:strict` – coverage docs match committed generator output.
4. **Coverage report on PRs**  
   - `davelosert/vitest-coverage-report-action@v2` posts coverage details as a PR comment.

> **Note:** CI does **not** regenerate docs. Doc generation (`test:status`, `test:audit`) is a **local** responsibility. See [Contributing Workflow](#contributing-workflow) below.

### Contributing Workflow

Coverage docs (`TEST_COVERAGE.md`, `TEST_AUDIT.md`) are **committed artifacts**. When your PR changes coverage:

```bash
# 1. Run the full test suite with doc generation
npm run test:full

# 2. Commit the updated docs alongside your code changes
git add docs/TEST_COVERAGE.md docs/TEST_AUDIT.md
git commit -m "Update coverage docs"
```

CI will **fail** if:

- Docs are missing or malformed
- Docs are stale (> 2 days older than HEAD commit)
- Docs don't match what the generators would produce

This ensures the repository always has accurate, up-to-date coverage documentation.

---

## Current Coverage & Thresholds

Exact percentages change frequently and are **not hard‑coded** here. To see them:

- **Snapshot report:** [docs/TEST_COVERAGE.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_COVERAGE.md:0:0-0:0)
- **Historical trend:** `coverage/history.json` (latest 100 snapshots)
- **Gap analysis:** [docs/TEST_AUDIT.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_AUDIT.md:0:0-0:0)
- **HTML report:** `coverage/index.html`

Thresholds enforced (in Vite + Test Health Suite):

- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

CI additionally prevents **regressions** larger than **2.0 percentage points** relative to the previous snapshot.

---

## Definition of Done

Testing is considered **complete enough** when:

1. **80%+ statement coverage** on all non‑UI logic (services, stores, hooks, utilities).
2. **60%+ statement coverage** on React components (render + key interactions).
3. **All critical paths** have explicit tests:
   - Persistence / IndexedDB
   - AI calls and error handling
   - Branching, version control, and export flows.
4. **Zero regressions** – coverage cannot silently drop without CI failure.
5. **Docs stay in sync** – [TEST_COVERAGE.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_COVERAGE.md:0:0-0:0) and [TEST_AUDIT.md](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/docs/TEST_AUDIT.md:0:0-0:0) are fresh and committed.

---

## Testing Phases

These phases describe **how we structure test work**, not current numeric coverage.

### Phase 1: Core Logic (Critical)

**Goal:** Cover business logic that doesn’t require React rendering.  
**Examples:**

- `services/gemini/*` – agent orchestration, prompts, token guards, parsing.
- `services/manuscriptParser.ts`, `services/manuscriptIndexer.ts` – manuscript parsing/indexing.
- `services/pdfExport.ts` – export pipeline.
- `config/*` – API/model configuration.

Most of these modules now have strong coverage; new logic should follow the same pattern.

### Phase 2: State Management (High)

**Goal:** Verify state machines, stores, and contexts.

- Zustand stores:
  - `features/project/store/useProjectStore.ts`
  - `features/settings/store/useSettingsStore.ts`
- React contexts:
  - `features/shared/context/EditorContext.tsx`
  - `features/shared/context/EngineContext.tsx`
  - `features/shared/context/UsageContext.tsx`
  - `features/analysis/context/AnalysisContext.tsx`

New stateful modules should add tests alongside their context/store files.

### Phase 3: Custom Hooks (High)

**Goal:** Cover hooks with `renderHook` and realistic mocks.

Key hook families:

- Agent + editor:
  - `features/agent/hooks/useAgentService.ts`
  - `features/agent/hooks/useAgenticEditor.ts`
- Editor:
  - `features/editor/hooks/useMagicEditor.ts`
  - `features/editor/hooks/useDocumentHistory.ts`
  - `features/editor/hooks/useBranching.ts`
  - `features/editor/hooks/useInlineComments.ts`
  - `features/editor/hooks/useEditorSelection.ts`
  - `features/editor/hooks/useAutoResize.ts`
- Shared & voice:
  - `features/shared/hooks/useDraftSmithEngine.ts`
  - `features/shared/hooks/usePlotSuggestions.ts`
  - `features/shared/hooks/useViewportCollision.ts`
  - `features/voice/hooks/useVoiceSession.ts`
  - `features/voice/hooks/useTextToSpeech.ts`
  - `features/voice/hooks/useAudioController.ts`

When adding new hooks, follow the same pattern: unit-test decision logic and side effects.

For the agent layer specifically, the shared Gemini tool-call loop and its orchestrators are covered by:

- `tests/services/core/agentToolLoop.test.ts` – pure helper loop behavior (tool rounds, abort paths).
- `tests/services/core/AgentController.test.ts` – `DefaultAgentController` usage of the loop and state transitions.
- `tests/hooks/useAgentOrchestrator.test.ts` – AppBrain-powered hook behavior, including tool round-trips and abort handling.

### Phase 4: React Components (Medium)

**Goal:** Render tests + key user interactions per component.

Focus on:

- Rich editor UI:
  - [features/editor/components/RichTextEditor.tsx](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/features/editor/components/RichTextEditor.tsx:0:0-0:0)
  - [features/editor/components/MagicBar.tsx](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/features/editor/components/MagicBar.tsx:0:0-0:0)
  - [features/editor/components/CommentCard.tsx](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/features/editor/components/CommentCard.tsx:0:0-0:0)
  - [features/editor/components/EditorWorkspace.tsx](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/features/editor/components/EditorWorkspace.tsx:0:0-0:0)
- Agent / analysis UI:
  - `features/agent/components/ChatInterface.tsx`
  - `features/analysis/components/AnalysisPanel.tsx`
- Project & visualization:
  - `features/project/components/ProjectDashboard.tsx`
  - `features/project/components/ImportWizard.tsx`
  - `features/lore/components/LoreManager.tsx`
  - `features/lore/components/KnowledgeGraph.tsx`
  - `features/voice/components/VoiceMode.tsx`

Tests should exercise **real user flows** (clicks, keyboard shortcuts, state transitions), not just snapshots.

### Phase 5: Integration Flows (Lower Volume, High Value)

**Goal:** End‑to‑end flows without a browser, using real stores + mocks at the boundaries.

Representative flows:

- Project lifecycle:
  - Create project → add chapter → save → reopen.
- Analysis:
  - Request analysis → receive results → render dashboards/panels.
- Agent:
  - Chat request → AI response → manuscript edit applied.

Existing tests in [tests/integration/](cci:7://file:///c:/Users/dmedl/Projects/Quill%20AI/tests/integration:0:0-0:0) cover core flows; new high‑level features should add similar integration tests.

---

## Testing Patterns

### 1. Service Mocking (Gemini API)

```typescript
// tests/mocks/geminiClient.ts
vi.mock('@/services/gemini/client', () => ({
  getClient: () => ({
    models: { generateContent: vi.fn() }
  })
}));
