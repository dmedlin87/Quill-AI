# App Audit: High-Risk Findings

> **Status:** Draft
> **Auditor:** Jules
> **Date:** 2025-12-13

## 1. Security & Safety Risks

### Data Loss Risk (Medium)
While the app is single-user, the Agent has tools that can modify text (`replace_text`) and delete memories (`delete_memory_note`).
*   **Evidence:** `services/gemini/toolExecutor.ts`
*   **Mitigation:** `replace_text` requires exact text matching, which limits the "blast radius" of a hallucination (it can't replace "Chapter 1" with "Deleted" unless the user wrote exactly that).
*   **Gap:** There is no "Undo" stack integration explicitly visible in the Agent tool handling. If the Agent makes a mistake, is it undoable via the standard Editor Undo? (Likely yes, if it goes through Tiptap, but worth verifying).

### API Key Handling (Low)
*   **Evidence:** `process.env.GEMINI_API_KEY` is used standardly.
*   **Risk:** Logs or screenshots might leak the key if not careful, but code itself handles it correctly via environment variables.

## 2. Fragility & Correctness (High)

### The "Intelligence" Facade (High Severity)
The app claims to have "Intelligence" (structural parsing, sentiment analysis), but the implementation is extremely fragile and naive.
*   **Evidence:** `services/intelligence/structuralParser.ts`
*   **Fragility:**
    *   **Dialogue Detection:** Relies on hardcoded regex `/"([^"]+)"/g`. This fails for:
        *   Smart quotes (`“”`).
        *   Single quotes (`‘’`).
        *   Unquoted dialogue (McCarthy style).
        *   Multi-paragraph dialogue.
    *   **Tension Analysis:** Uses a hardcoded list of words (`run` = high tension, `slowly` = low tension). This is context-blind and will misclassify "She slowly pulled the trigger" as low tension.
    *   **Speaker Attribution:** Assumes names start with Uppercase (`/^[A-Z]/.test(potentialName)`).
*   **Impact:** The "Smart Context" fed to the AI will be populated with garbage data (wrong speakers, wrong tension), leading the AI to give bad advice or hallucinate story facts.

### Flaky Orchestration Tests (Medium Severity)
The core agent loop is tested, but the tests are flaky under load.
*   **Evidence:** `tests/features/agent/hooks/useAgentOrchestrator.test.ts` failed with a 7.5s timeout during full test run, but passed in isolation.
*   **Cause:** Race conditions in `waitFor` vs `useEffect` async state updates.
*   **Impact:** CI will be unreliable, leading to "retry until green" habits that hide real bugs.

## 3. Test Quality & "Lying" Coverage

### Coverage Padding (High Severity)
A significant number of test files exist solely to import and check for undefined exports, falsely inflating coverage statistics without testing behavior.
*   **Evidence:**
    *   `tests/features/agent/index.test.ts`
    *   `tests/features/analysis/index.test.ts`
    *   `tests/features/project/index.test.ts`
*   **Impact:** These files contribute 0% confidence but make the coverage report look green (99.2% files with tests).

### Test Code in Production (Medium Severity)
Production services contain methods specifically for testing.
*   **Evidence:**
    *   `services/appBrain/eventBus.ts`: `clearPersistentLog()`, `dispose()` (marked "for tests").
    *   `services/core/contextService.ts`: Exports `createNoOpContextService` and `createMockContextService`.
*   **Impact:** Bloats bundle size and exposes dangerous methods (like "clear logs") to the runtime that shouldn't exist in production.

## 4. Build Issues

### Bundle Size (Low)
*   **Evidence:** Build warns about chunks >500kB.
*   **Impact:** Slower load times (less critical for a local-first app).

---

## Top 3 Next Moves

1.  **Delete Coverage Padding:** Remove `index.test.ts` files. If coverage drops, let it drop. Real numbers are better than fake ones.
2.  **Harden Intelligence Parser:** Replace naive Regex with a more robust tokenizer or at least support Smart Quotes and common variations. Ideally, use a proper NLP library or simple LLM pass for classification if budget allows.
3.  **Fix Test Flakiness:** Refactor `useAgentOrchestrator` tests to mock the `useEffect` timing explicitly or increase timeout/robustness of `waitFor` conditions.
