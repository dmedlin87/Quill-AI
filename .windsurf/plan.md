# Plan: Add missing test files from TEST_AUDIT

***Begin Plan***
1. Confirm scope and priorities for the 23 missing source files listed in docs/TEST_AUDIT.md.
2. Inspect each source to outline behaviors/exports and determine mocking needs, grouping similar files (components/hooks/services/types).
3. Add Vitest files covering key behaviors for each missing source, following existing testing patterns and keeping implementations minimal.
4. Run targeted Vitest for new tests, then `npm run test:audit` to refresh the report; collect results.
***End Plan***
