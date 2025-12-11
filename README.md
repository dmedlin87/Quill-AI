# Quill AI

![Quill AI Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

<!-- TEST_HEALTH_BADGES:START - Do not remove or modify this section -->
<!-- Badges are updated by npm run test:status -->
![Tests](https://img.shields.io/badge/tests-4000%2B-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)
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
2. Create `.env.local` and set `VITE_GEMINI_API_KEY` to your Gemini API key (the app also respects `GEMINI_API_KEY` / `API_KEY` in the environment, but `VITE_GEMINI_API_KEY` is recommended for local dev).
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

## Documentation (start here)

1. **Docs index:** [docs/README.md](./docs/README.md) — curated map of every doc.
2. **Agent routing guide:** [docs/AGENT_ROUTING.md](./docs/AGENT_ROUTING.md) — step-by-step flow for how the agent thinks, which files to read, and where to extend/debug it.
3. **Architecture & flows**
   - [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Persistence → editor session → AI engine → omniscient agent.
   - [APP_BRAIN_FLOW.md](./docs/APP_BRAIN_FLOW.md) — App Brain + memory + intelligence diagram.
   - [AGENT_ARCHITECTURE.md](./docs/AGENT_ARCHITECTURE.md) — App Brain + orchestrator vision and phases.
   - [INTELLIGENCE_ENGINE.md](./docs/INTELLIGENCE_ENGINE.md) — Deterministic manuscript indexing and HUD signals.
4. **Agent tools & memory**
   - [AGENT_TOOLS_REFERENCE.md](./docs/AGENT_TOOLS_REFERENCE.md) — Tool catalog and how to add tools.
   - Memory + bedside notes: [MEMORY_SYSTEM.md](./docs/MEMORY_SYSTEM.md) and [BEDSIDE_NOTE_ROADMAP.md](./docs/BEDSIDE_NOTE_ROADMAP.md).
5. **Testing & coverage**
   - [TESTING.md](./docs/TESTING.md) — Strategy, CI flow, patterns.
   - [TEST_COVERAGE.md](./docs/TEST_COVERAGE.md), [TEST_AUDIT.md](./docs/TEST_AUDIT.md), [TEST_COVERAGE_PLAN.md](./docs/TEST_COVERAGE_PLAN.md) — Coverage status and gap plans.
6. **Limits**
   - [token-limits.md](./docs/token-limits.md) — Analysis and model token guidance.
