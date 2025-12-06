# Plan: MemoryManager refactor

- [ ] Analyze features/memory/MemoryManager.tsx for typing gaps, memo/callback needs, and lifecycle cleanup.
- [ ] Refactor MemoryManager with stricter typing, memoized callbacks, JSDoc on complex flows, and leak prevention.
- [ ] Add/adjust tests for MemoryManager behaviors and run relevant vitest suites.

## Plan: ImportWizard refactor & tests

1. Inspect ImportWizard for missing identifiers (id, cursorPos, mergeChapters, splitChapter) flagged by IDE.
2. Implement/correct chapter operations (merge, split, delete) ensuring proper state updates and history.
3. Validate fixes (build/check relevant tests).
4. Summarize changes and test results.

## Plan: ImportWizard runtime review

1. Analyze ImportWizard.tsx for runtime risks (race conditions in effects, null/undefined handling, event listener cleanup).
