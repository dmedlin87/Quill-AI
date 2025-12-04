<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Quill AI

<!-- TEST_HEALTH_BADGES:START - Do not remove or modify this section -->
<!-- Badges are updated by npm run test:status -->
![Tests](https://img.shields.io/badge/tests-800+-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-93%25-brightgreen)
<!-- TEST_HEALTH_BADGES:END -->

AI-powered manuscript editor with real-time analysis, multi-persona agents, and voice interaction.

## Features

- **Manuscript-first editor** with chapters, branches, and inline critique comments.
- **Deterministic intelligence layer** that builds a manuscript index, HUD, entity graph, and pacing/heatmap signals.
- **Omniscient agent** that sees the full App Brain state and can navigate, edit, and explain your draft via tools.
- **Voice mode** for low-friction dictation and agent interaction (experimental/partial, see docs).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

## Testing

```bash
npm test              # Run all tests (watch mode)
npm run test:run      # Run all tests once
npm run test:coverage # Generate coverage report
npm run test:status   # Generate docs/TEST_COVERAGE.md
npm run test:audit    # Analyze test gaps
npm run test:full     # Coverage + status + audit
npm run test:quick    # Fast dot reporter
```

See:

- [docs/TEST_COVERAGE.md](./docs/TEST_COVERAGE.md) — Auto-generated coverage status
- [docs/TEST_AUDIT.md](./docs/TEST_AUDIT.md) — Auto-generated gap analysis
- [docs/TESTING.md](./docs/TESTING.md) — Test strategy and patterns

## Documentation

All project documentation lives in the [`docs/`](./docs/) folder:

- **Architecture & agents**
  - **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Core state layers (persistence, editor session, AI engine, omniscient agent).
  - **[AGENT_ARCHITECTURE.md](./docs/AGENT_ARCHITECTURE.md)** — Omniscient agent + App Brain design and migration plan.
  - **[AGENT_TOOLS_REFERENCE.md](./docs/AGENT_TOOLS_REFERENCE.md)** — Agent tools, commands, and how to add new tools.
  - **[APP_BRAIN_FLOW.md](./docs/APP_BRAIN_FLOW.md)** — Mermaid map of how the App Brain, memory, and intelligence layers interact.
- **Testing & coverage**
  - **[TESTING.md](./docs/TESTING.md)** — Test strategy, CI flow, and local commands.
  - **[TEST_COVERAGE.md](./docs/TEST_COVERAGE.md)** — Auto-generated coverage snapshot.
  - **[TEST_AUDIT.md](./docs/TEST_AUDIT.md)** — Auto-generated test gap audit.
  - **[TEST_COVERAGE_PLAN.md](./docs/TEST_COVERAGE_PLAN.md)** — Plan for driving every file toward ≥90% coverage.
- **API, limits, & memory**
  - **[token-limits.md](./docs/token-limits.md)** — User-facing guidance and developer notes on analysis token limits.
  - **[MEMORY_SYSTEM.md](./docs/MEMORY_SYSTEM.md)** — Agent memory tables, services, and prompt integration.
