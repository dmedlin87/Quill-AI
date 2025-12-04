# Token limits and analysis truncation

Quill AI automatically trims analysis requests that exceed the configured maximum context length. When this happens, you will see a warning banner in the Analysis panel with details about how much text was removed.

To avoid truncation:

- Analyze a smaller selection of the manuscript.
- Break long chapters into sections and run analysis on each section separately.
- Keep supplemental context (like lore or notes) concise.

If you continue to hit limits, consider refactoring the scene or running multiple focused analyses instead of one long request.

## Developer notes

- Implementation: `services/gemini/tokenGuard.ts`, `config/models.ts`, and `config/api.ts` define limits and token-budget helpers.
- UI reference: `public/token-limits.html` renders a small dev helper page for visualising limits.
- When changing limits or budgets, keep this document and the Analysis panel warning text in sync.
