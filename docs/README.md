# Quill AI Documentation

This folder contains project documentation and development guides. Start here to pick the right doc for the task at hand.

## Quick routes

- **New to the agent?** Read [AGENT_ROUTING.md](./AGENT_ROUTING.md) first — it explains how the agent thinks, which docs/files to open, and where to plug in new ideas or debug issues.
- **Architecture refresh:** [ARCHITECTURE.md](./ARCHITECTURE.md) and [APP_BRAIN_FLOW.md](./APP_BRAIN_FLOW.md).
- **Memory + bedside notes:** [MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md) and [BEDSIDE_NOTE_ROADMAP.md](./BEDSIDE_NOTE_ROADMAP.md).
- **Agent tools:** [AGENT_TOOLS_REFERENCE.md](./AGENT_TOOLS_REFERENCE.md).
- **Testing:** [TESTING.md](./TESTING.md) plus generated coverage docs below.

## Contents

| Area | Read this | Why |
|------|-----------|-----|
| Agent routing & flow | [AGENT_ROUTING.md](./AGENT_ROUTING.md) | Step-by-step path to trace/extend the agent, with file pointers. |
| Core architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) | Persistence → editor session → AI engine → omniscient agent layers. |
| App Brain flow | [APP_BRAIN_FLOW.md](./APP_BRAIN_FLOW.md) | Diagram of App Brain, memory, intelligence, and orchestrator. |
| Omniscient agent | [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) | App Brain vision, phases, and legacy vs. current paths. |
| Agent tools | [AGENT_TOOLS_REFERENCE.md](./AGENT_TOOLS_REFERENCE.md) | Tool catalog and how to add/modify tools. |
| Memory system | [MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md) | Memory schemas, services, prompt integration. |
| Bedside notes | [BEDSIDE_NOTE_ROADMAP.md](./BEDSIDE_NOTE_ROADMAP.md) | Current state, triggers, and roadmap slices for planning memory. |
| Intelligence engine | [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md) | Deterministic manuscript indexing, HUD, entities. |
| Token limits | [token-limits.md](./token-limits.md) | Model/token guard guidance. |
| Testing strategy | [TESTING.md](./TESTING.md) | How we test, patterns, CI flow. |
| Coverage snapshots | [TEST_COVERAGE.md](./TEST_COVERAGE.md) | Auto-generated coverage status. |
| Gap audit | [TEST_AUDIT.md](./TEST_AUDIT.md) | Auto-generated test gap analysis. |
| Coverage plan | [TEST_COVERAGE_PLAN.md](./TEST_COVERAGE_PLAN.md) | Plan to drive files to ≥90% coverage. |

## Core systems quick map

- **AppBrain state aggregation** – How unified manuscript, analysis, intelligence, and UI state are built and passed to the agent. See:
  - [ARCHITECTURE.md](./ARCHITECTURE.md)
  - [APP_BRAIN_FLOW.md](./APP_BRAIN_FLOW.md)
  - [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md)
- **Agent tool execution** – How Gemini tool calls become concrete app actions. See:
  - [AGENT_ROUTING.md](./AGENT_ROUTING.md)
  - [AGENT_TOOLS_REFERENCE.md](./AGENT_TOOLS_REFERENCE.md)
  - [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md)
- **Memory retrieval & bedside notes** – How persistent memory and planning notes are stored and injected into prompts. See:
  - [MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md)
  - [BEDSIDE_NOTE_ROADMAP.md](./BEDSIDE_NOTE_ROADMAP.md)
  - [APP_BRAIN_FLOW.md](./APP_BRAIN_FLOW.md)
- **Analysis pipeline & token guard** – How manuscript analysis runs through the engine, token guard, and Dexie. See:
  - [ARCHITECTURE.md](./ARCHITECTURE.md)
  - [INTELLIGENCE_ENGINE.md](./INTELLIGENCE_ENGINE.md)
  - [token-limits.md](./token-limits.md)

## Quick commands

- **Run tests:** `npm test`
- **Coverage report:** `npm run test:coverage` → open `coverage/index.html`
- **Dev server:** `npm run dev`
