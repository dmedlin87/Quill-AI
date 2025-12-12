# Test system map — Quill AI

Date: 2025-12-12

## 1) Test runner + framework

- **Runner**: **Vitest**
  - Evidence:
    - `package.json` scripts use `vitest` (e.g. `"test": "... vitest"`, `"test:run": "... vitest run"`).
    - Vitest is configured in `vite.config.ts` under `test: { ... }`.

- **React testing**: **@testing-library/react** + **@testing-library/jest-dom**
  - Evidence:
    - `tests/setup.ts` imports `@testing-library/jest-dom`.

- **Coverage**: **V8 coverage** (Vitest)
  - Evidence:
    - `devDependencies` includes `@vitest/coverage-v8` in `package.json`.
    - `vite.config.ts` sets `test.coverage.reporter` and `test.coverage.thresholds`.

## 2) How tests are executed (scripts)

From `package.json`:

- **Watch mode**: `npm test` → `vitest`
- **Run once**: `npm run test:run` → `vitest run`
- **Coverage + status**: `npm run test:coverage` → `vitest run --coverage && npm run test:status`
- **Status doc generation**: `npm run test:status` → `node scripts/generate-test-status.mjs`
- **Audit**: `npm run test:audit` → `node scripts/audit-test-gaps.mjs`
- **Full reporting**: `npm run test:full` → `npm run test:coverage && npm run test:audit`

## 3) Vitest configuration (authoritative)

File: `vite.config.ts`

- **Environment**: `jsdom`
- **Globals**: `globals: true` (so `describe/it/expect` can be used globally)
- **Isolation**: `isolate: true`
- **Setup file**: `setupFiles: ['./tests/setup.ts']`
- **Coverage outputs**:
  - Reporters: `text`, `json`, `json-summary`, `html`
  - Thresholds: statements/branches/functions/lines all `90`
  - Excludes:
    - `scripts/**/*.mjs`
    - `types/**/*.ts`
  - JSON reporter output file: `coverage/vitest-report.json`
- **Concurrency/pool**:
  - `pool` is **`threads` on Windows** and **`forks` on non-Windows** (via `process.platform`)
  - `maxConcurrency: 5`

## 4) Global test setup (where most “harness behavior” lives)

File: `tests/setup.ts` (wired via `vite.config.ts` `setupFiles`)

### 4.1 Global matchers / RTL cleanup

- Imports `@testing-library/jest-dom` for DOM matchers.
- `afterEach` does:
  - `cleanup()` (RTL DOM cleanup)
  - resets the in-memory DB (via `import('@/services/db')` and calling `db.reset()` if present)
  - `vi.clearAllMocks()`
  - clears `localStorage` and `sessionStorage` when available

### 4.2 Global runtime flags that change behavior vs production

- `(globalThis as any).__QUILL_WRITE_DEBOUNCE_MS = 0;`
  - Forces **zero-latency persistence** in tests (bypasses debounce timing).

### 4.3 Global module mocks (high-impact)

These mocks apply to *all tests by default* unless a test explicitly `vi.unmock(...)` or overrides.

- **Gemini SDK**:
  - `vi.mock('@google/genai', ...)` → lightweight stub implementation.
- **Dexie/DB**:
  - `vi.mock('@/services/db', ...)` → in-memory Map-backed DB with `reset()`.
- **Editor session context**:
  - `vi.mock('@/features/core/context/EditorContext', ...)` → stubs providers + `useEditor/useEditorState/useEditorActions`.
- **Project store**:
  - `vi.mock('@/features/project/store/useProjectStore', ...)` → a selector-aware mock store returning safe defaults.

### 4.4 Environment shims / browser API shims

In `tests/setup.ts`:

- **Web Audio**: `AudioContext` / `webkitAudioContext` stub
- **Speech synthesis**: `speechSynthesis` stub
- **Responsive APIs**: `window.matchMedia` mock
- **Observers**: `ResizeObserver` mock
- **Web Workers**: global `Worker` replaced with `MockWorker`

### 4.5 Environment variables

- `vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key-for-testing');`

## 5) Shared test utilities (helpers / factories / mocks)

### 5.1 Behavioral helper utilities

- `tests/helpers/testUtils.ts`
  - Fake timer helpers: `setupFakeTimers`, `advanceTimersAndFlush`, `flushPromises`
  - Cleanup helper: `cleanupTest`, `setupAutoCleanup`
  - Strict assertion helpers: `assertStrictEqual`, `assertCalledWithExact`, etc.

### 5.2 Factories

- `tests/factories/analysisResultFactory.ts`
  - `createAnalysisResult(...)`, `createCharacter(...)`

- `tests/mocks/testFactories.ts`
  - Factories for “app-shaped” data:
    - `createMockEditorContext*`
    - `createMockChapter*`
    - `createMockPersona`
    - `createMockAppBrainState*` (uses `createEmptyAppBrainState` from `@/services/appBrain`)

### 5.3 Gemini mocking helpers

- `tests/mocks/geminiClient.ts`
  - `mockAi` structure approximates the SDK surface used by the app.
  - `setupGeminiClientMock()` uses `vi.mock('@/services/gemini/client', ...)` to inject `mockAi`.
  - Provides “chaos” responses and error constructors (e.g. status=429/413).

## 6) Unmocking boundaries (getting back to “real” behavior)

Because `tests/setup.ts` mocks core modules globally, tests that need the real implementation typically use **`vi.unmock(...)` before import**.

Concrete examples:

- Real project store tests:
  - `tests/store/useProjectStore.test.ts` starts with `vi.unmock('@/features/project/store/useProjectStore');`
- Integration tests (selectively real):
  - `tests/integration/agent-flow.test.ts` unmock:
    - `@/features/project/store/useProjectStore`
    - `@/features/core/context/EditorContext`

## 7) Test pyramid reality (repo-specific)

- **Unit tests (dominant)**
  - `tests/services/**` (service-level logic)
  - `tests/features/**` and `tests/components/**` (UI/component logic)

- **Integration tests (present but limited)**
  - `tests/integration/agent-flow.test.ts`
  - `tests/integration/analysis-flow.test.tsx`
  - `tests/integration/proactive-flow.test.ts`
  - `tests/integration/project-flow.test.ts`

- **E2E tests**
  - None found in the repo structure examined (no Playwright/Cypress harness observed).

## 8) Rigor guidelines (intent)

- `tests/TEST_RIGOR_GUIDELINES.md` defines standards against “testing theatre” (strict assertions, determinism, mutation resistance, snapshot rules).
