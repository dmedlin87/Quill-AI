# Plan: MemoryManager refactor

- [x] Review memory module files (MemoryManager, autoObserver, memory service/types) for typing gaps, memo/callback misuse, leaks.
- [ ] Refactor to strict typing and React 18 patterns; add JSDoc for complex logic; fix leaks.
- [ ] Add/adjust tests if needed; run targeted test suite.

## Plan: ImportWizard refactor & tests

1. Inspect ImportWizard for missing identifiers (id, cursorPos, mergeChapters, splitChapter) flagged by IDE.
2. Implement/correct chapter operations (merge, split, delete) ensuring proper state updates and history.
3. Validate fixes (build/check relevant tests).
4. Summarize changes and test results.

## Plan: ImportWizard runtime review

1. Analyze ImportWizard.tsx for runtime risks (race conditions in effects, null/undefined handling, event listener cleanup).
