# Coverage illusions (repo-specific) — Quill AI

Date: 2025-12-12

## What this file is

This is a repo-specific inventory of patterns that can produce **high coverage numbers** while still allowing **real runtime bugs** to ship.

All examples below cite concrete file paths in this repo.

---

## 1) Global module mocks that change the system under test

### 1.1 Gemini SDK is globally mocked

- File: `tests/setup.ts`
  - `vi.mock('@google/genai', () => { ... })`

Why this can inflate coverage:

- Any code that imports `@google/genai` will execute against a **lightweight stub** instead of the real SDK behavior (error shapes, streaming, tool-call payload details, retries/backoff behavior, etc.).

### 1.2 Dexie/IndexedDB is globally mocked (Map-backed)

- File: `tests/setup.ts`
  - `vi.mock('@/services/db', () => { ... })`

Why this can inflate coverage:

- This replaces Dexie semantics with a simplified in-memory `Map` implementation.
- Logic that depends on **Dexie indexes, query semantics, transactions, or edge cases** can appear “covered” while not being exercised under real IndexedDB/Dexie behavior.

Concrete evidence of divergence:

- The mock implements only a subset of query methods (`where().equals().sortBy()`, `orderBy().reverse().toArray()`, etc.).

### 1.3 Core React contexts/stores are globally mocked

- File: `tests/setup.ts`
  - `vi.mock('@/features/core/context/EditorContext', () => ({ ... }))`
  - `vi.mock('@/features/project/store/useProjectStore', () => ({ useProjectStore: mockUseProjectStore }))`

Why this can inflate coverage:

- Many component tests can import/render UI without the real providers/stores.
- This can mask bugs that only appear with **real state transitions** (undo/redo, branching, persistence debounce, selector behavior, etc.).

Concrete “unmock boundary” example:

- `tests/store/useProjectStore.test.ts` explicitly starts with:
  - `vi.unmock('@/features/project/store/useProjectStore');`

This is a strong signal that, by default, most tests are running against the mocked store unless they opt out.

---

## 2) Coverage-driven tests (explicitly written to move coverage)

### 2.1 Barrel export coverage tests

- File: `tests/features/index-exports.test.ts`

Evidence it is coverage-motivated:

- The header comment states these tests exist to “provide coverage for the index.ts files which are otherwise at 0% branch coverage.”

Why this can inflate coverage:

- These tests primarily assert `toBeDefined()` on exports after `import(...)`.
- They validate that the module loads and symbols exist, but not that components behave correctly at runtime.

Also note:

- This test file mocks significant dependencies to ensure imports don’t crash:
  - `vi.mock('framer-motion', ...)`
  - `vi.mock('@/services/gemini/agent', ...)`
  - `vi.mock('@/services/gemini/errors', ...)`

So a “pass” can still hide import-time/runtime problems in real environments.

---

## 3) “Coverage-only” test files in intelligence subsystem

These are explicitly named as coverage tests:

- `tests/services/intelligence/chunkManager_coverage.test.ts`
- `tests/services/intelligence/entityExtractor_coverage.test.ts`
- `tests/services/intelligence/index_coverage.test.ts`
- `tests/services/intelligence/structuralParser_coverage.test.ts`

### 3.1 `chunkManager_coverage.test.ts`: mocks the production dependency and uses weak/no assertions

- File: `tests/services/intelligence/chunkManager_coverage.test.ts`

Coverage-inflating patterns inside:

- **Mocks the main processing dependency**:
  - `vi.mock('@/services/intelligence/index', ...)` overrides `processManuscriptCached`.
  - This means the test does not exercise real analysis/indexing behavior.

- **Tests that assert nothing meaningful (or nothing at all)**:
  - `it('getAnalysisAtCursor returns analysis', () => { ... })` has no `expect(...)`.
  - `it('pause and resume', () => { ... })` has no `expect(...)`.
  - `it('should stop processing when destroyed', () => { ... })` has no `expect(...)`.
  - `it('handleEdit does nothing if destroyed', () => { ... })` has no `expect(...)`.

- **Reaches into private/internal state**:
  - Several tests access `(manager as any).chapterTexts`.

Net effect:

- These tests can increase line/branch coverage but may not fail when behavior regresses.

### 3.2 `structuralParser_coverage.test.ts`: weak assertions + conditional “skip assertions”

- File: `tests/services/intelligence/structuralParser_coverage.test.ts`

Coverage-inflating patterns:

- Uses `toBeTruthy()`:
  - Example: `expect(result.scenes[0]?.timeMarker).toBeTruthy();`

- Uses conditional guards that can prevent assertions from running:
  - `if (resultD.scenes.length > 0) { expect(...) }`
  - If scene detection breaks and returns `[]`, the test can still pass without asserting a failure condition.

### 3.3 `entityExtractor_coverage.test.ts`: intentionally relaxed assertions

- File: `tests/services/intelligence/entityExtractor_coverage.test.ts`

Evidence:

- The “surname logic” test explicitly accepts multiple outcomes:
  - It asserts `darcyNodes.length > 0` and comments that it accepts either merged or separate nodes.

Why this can inflate coverage:

- If the behavior is wrong (e.g., consolidating when it shouldn’t), the test can still pass.

---

## 4) Tests that validate mock code (not production code)

These tests increase coverage but do not directly reduce runtime bug risk:

- `tests/mocks/geminiClient.test.ts`
  - Header comment says it “Covers lines ... for improved branch coverage”.
  - It tests the **mock utilities** in `tests/mocks/geminiClient.ts`.

- `tests/mocks/testFactories.test.ts`
  - Header comment says it covers ranges “for improved branch coverage”.
  - It tests **test factories** in `tests/mocks/testFactories.ts`.

- `tests/helpers/testUtils.test.ts`
  - Header comment says it covers ranges “for improved branch coverage”.
  - It tests helper utilities in `tests/helpers/testUtils.ts`.

---

## 5) Snapshot usage (limited, but present)

- File: `tests/features/memory/BedsideNotePanel.test.tsx`
  - Has `expect(container).toMatchSnapshot();`.

Why snapshots can inflate perceived safety:

- Snapshot tests can pass while behavior is broken, especially if the snapshot is updated to match a regression.
- In this repo, snapshot usage appears limited (based on search results), but this file is a concrete example.

---

## 6) Timing/concurrency shortcuts that can hide race bugs

### 6.1 Debounce bypass

- File: `tests/setup.ts`
  - `(globalThis as any).__QUILL_WRITE_DEBOUNCE_MS = 0;`

Why this can inflate confidence:

- Tests will not naturally reproduce real “typing vs persistence” timing windows if the debounce delay is forced to zero.

### 6.2 Worker concurrency bypass

- File: `tests/setup.ts`
  - Global `Worker` is replaced by `MockWorker`.

Why this can inflate confidence:

- Code paths that only fail under real worker scheduling/cancellation (late responses, races) won’t be exercised.

---

## 7) Bottom line (what to watch when diagnosing “high coverage, still bugs”)

In this repo, the highest-probability sources of “coverage lies” are:

- **Global mocks of core state** (`EditorContext`, `useProjectStore`, `services/db`, `@google/genai`) masking integration issues.
- **Coverage-motivated test files** that either:
  - primarily assert exports exist (`tests/features/index-exports.test.ts`), or
  - contain weak/no assertions (`tests/services/intelligence/chunkManager_coverage.test.ts`).
- **Bypassed timing/concurrency** (`__QUILL_WRITE_DEBOUNCE_MS = 0`, mocked `Worker`).
