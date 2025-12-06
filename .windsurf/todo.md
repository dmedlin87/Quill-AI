# Current tasks

- [ ] Audit KnowledgeGraph component for typing, memo/callback usage, and event cleanup.
- [ ] Refactor KnowledgeGraph with strict typing, memoization, ResizeObserver fallback, and docs.
- [ ] Add or update tests for KnowledgeGraph behaviors and cleanup.
- [ ] Run KnowledgeGraph test suite and report results.
- [ ] Refactor tests/features/core/AppBrainContext.test.tsx for strict typing and modern React 18 patterns
- [ ] Tighten mocks and add JSDoc for complex test setup
- [ ] Add/regression tests where gaps found and run relevant suite
- [ ] Fix constructor mocks: make manuscriptIndexer and pdfExport tolerate non-constructible mocks (GoogleGenAI/jsPDF).
- [ ] Repair cache.test syntax error at splitIntoSections offset loop.
- [ ] Run targeted suites: tests/services/manuscriptIndexer.test.ts, tests/services/pdfExport.test.ts, tests/services/intelligence/cache.test.ts.
- [ ] Re-run broader suite to surface remaining failures after initial fixes.
