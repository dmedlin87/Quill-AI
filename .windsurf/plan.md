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

## Plan: Security + AppBrain perf + Agent continuity + Tool loop + Persistence

1. **Security Enhancements**
 1.1. Remove **GEMINI_API_KEY** bundling in Vite.
 1.2. Add runtime key guard/UX with local storage.
2. **AppBrain Performance Optimization**
 2.1. Split volatile editor state from stable metadata.
 2.2. Update consumers to use the new store structure.
3. **Agent Continuity**
 3.1. Pass stored chat history into **createAgentSession** on re-init.
4. **Tool Loop Safety**
 4.1. Add max-iteration guard to prevent runaway cycles.
5. **Persistence**
 5.1. Ensure **beforeunload** flush sends pending writes (beacon or fallback).
 5.2. Make debounce configurable.
6. **Regression Testing**
 6.1. Add coverage for the above changes.
 6.2. Run targeted test suites.
