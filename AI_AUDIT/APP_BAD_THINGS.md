# App Audit: The "Bad Things" List

**Date:** 2024-05-24
**Scope:** End-to-End Audit (UX, Architecture, Correctness, Performance, Security, Testing)

## Executive Summary

The biggest risk is a **type-checking / runtime gap**: the app can build via Vite while `tsc` reports 130+ errors. That creates a *false sense of correctness* in critical paths (AI responses, state updates, persistence).

The second risk is a **false sense of test safety**: the suite can “pass” while emitting large volumes of `stderr` noise (e.g., hooks used outside Providers, update-depth warnings). That makes regressions hard to see and can inflate confidence in coverage.

Finally, there are a few **high-impact stability/security pitfalls**: a missing imported component (`QuotaExhaustedModal`), worker fragility (“Worker exploded”), and prompt-injection exposure due to untrusted manuscript content flowing into prompts.

---

## 1. Correctness & Type Safety (Blocker)

### Vite vs. TSC gap

* **Severity:** **Blocker**
* **Evidence:** `tsc_output.txt` (130+ errors).
  * `App.tsx`: `Cannot find module '@/features/settings/components/QuotaExhaustedModal'`.
  * `config/models.ts`: `Property 'env' does not exist on type 'ImportMeta'`.
  * `useSpeechIntent.ts`: `Cannot find name 'SpeechRecognition'`.
  * `readerService.ts`: `Property 'response' does not exist on type 'GenerateContentResponse'`.
* **Impact:** Shipping code with broken types increases the chance of runtime crashes and undefined behavior, especially in AI/tooling/persistence flows.
* **Suggested Direction:** Add `tsc --noEmit` to CI (and ideally local pre-push). Treat `tsc` errors as build blockers.

### Missing file import: `QuotaExhaustedModal`

* **Severity:** **Blocker**
* **Evidence:** `tsc_output.txt` reports it; repository search shows no `QuotaExhaustedModal.*` file present under the workspace.
* **Impact:** If the import is executed (direct import or when route/component renders), the app can crash.
* **Suggested Direction:** Restore the missing component or remove/replace the import in `App.tsx`.

---

## 2. Test Quality & Signal-to-Noise (High)

### Context/provider noise (“phantom tests”)

* **Severity:** **High**
* **Evidence:** `test_full_output.txt` contains repeated errors like:
  * `Error: useEditor must be used within an EditorProvider`
  * `Error: useAnalysis must be used within AnalysisProvider`
* **Why it matters:** If tests render components without required providers, you often end up asserting on error states (or no meaningful UI) while still “executing lines,” which can make coverage look better than actual behavior.
* **Suggested Direction:**
  * Standardize a `renderWithProviders` helper (e.g., in `tests/testUtils`) that wraps components in the required providers (`AppBrain`, `Editor`, `Settings`, `Analysis`, etc.) by default.

### Async instability and environment mismatch

* **Severity:** **High**
* **Evidence:** Logs mentioning worker failures (e.g., `[ChunkManager] ... Worker exploded`) and `DOMException`/abort-related issues in tests.
* **Impact:** Flaky CI and “warning fatigue,” making real failures easy to miss.
* **Suggested Direction:**
  * Make worker paths explicitly testable (and optionally disable workers in unit tests).
  * Fix/contain async state updates (proper `act(...)`, deterministic timers, explicit awaits).

### Coverage pitfalls

* **Mocking reality:** Some tests (e.g., gemini client tests) can end up validating mocks more than integration behavior.
* **Noise masking:** Large `stderr` volume hides legitimate regressions.

---

## 3. Architecture & “Fragile Complexity” (High)

### Intelligence worker orchestration (“Worker exploded”)

* **Severity:** **High**
* **Evidence:** `services/intelligence/worker.ts`, `chunkManager.ts` and logs indicating “Worker exploded,” plus desync symptoms like `getChunkText` returning `null`.
* **Impact:** Stale analysis, dropped results, noisy logs, and hard-to-debug failures where the “intelligence” layer silently degrades.
* **Suggested Direction:**
  * Reduce the surface area of worker messaging and ensure message schemas are typed.
  * Make the fallback-to-main-thread path deterministic and covered by tests.

### Gemini client proxying (“magical” behavior)

* **Severity:** **Medium**
* **Evidence:** `services/gemini/client.ts` uses proxy/interception around `generateContent` for rate-limits/key switching.
* **Impact:** Harder debugging and increased break risk if upstream SDK APIs change.
* **Suggested Direction:**
  * Prefer explicit wrapper APIs over Proxy magic; keep key/cost switching behavior discoverable and testable.

---

## 4. React Patterns & Performance (Medium)

### Potential infinite update loops

* **Severity:** **High** (even though surfaced as a warning)
* **Evidence:** `test_full_output.txt` includes `Warning: Maximum update depth exceeded` related to `useAgentOrchestrator`.
* **Impact:** UI freezes and high CPU usage in real sessions.
* **Suggested Direction:** Audit `useEffect` dependency graphs (especially any “auto re-init” logic). Use stable memoized inputs, and store high-frequency values in `useRef` when they should not trigger rerenders.

### Bundle size

* **Severity:** **Medium**
* **Evidence:** Built output references a ~2MB main JS chunk (exact filename/hash varies).
* **Impact:** Slower initial load.
* **Suggested Direction:** Add code splitting for heavy/rarely-used features (e.g., graph/dashboards/advanced panels).

---

## 5. Security & Privacy (Medium)

### Prompt injection risk via untrusted manuscript content

* **Severity:** **High**
* **Evidence:** `services/gemini/prompts.ts` exists and prompt templates ingest full manuscript content (e.g., placeholder patterns such as `{{FULL_MANUSCRIPT}}`).
* **Impact:** A malicious manuscript can try to override system/tooling instructions (“ignore previous instructions”, “run destructive tools”, etc.).
* **Suggested Direction:**
  * Delimit manuscript/user content clearly (e.g., `<manuscript>...</manuscript>` or equivalent) and instruct the model to treat it as data.
  * Add tool-execution guardrails for destructive actions.

### Client-side API key exposure (deployment-dependent)

* **Severity:** **Low/Medium**
* **Evidence:** `services/gemini/client.ts` manages API keys client-side.
* **Impact:** BYOK is generally acceptable; shipping a paid/shared key in the frontend is not.
* **Suggested Direction:** If operating as SaaS, move paid-key usage behind a backend proxy.

---

## Top 3 Next Moves

1. **Make `tsc` authoritative:** Add `tsc --noEmit` to CI and fix the highest-risk type errors (starting with missing imports like `QuotaExhaustedModal`).
2. **Restore test signal:** Introduce `renderWithProviders` and eliminate provider/noise warnings so failures are actionable.
3. **Harden the AI/worker + prompt boundary:** Stabilize worker fallback behavior and treat manuscript content as untrusted input with clear delimiting + tool guardrails.
