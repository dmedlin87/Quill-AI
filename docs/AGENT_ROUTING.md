# Agent Routing Guide

**Audience:** Anyone extending, debugging, or prompting the omniscient agent.  
**Goal:** Provide an end-to-end path (docs + files) so there are no dead ends: start from README, trace how the agent thinks, and know where to patch or inspect.

## Quick menu

- **Understand the flow in 5 minutes:** Read [docs/README.md](./README.md) → skim this guide → open [APP_BRAIN_FLOW.md](./APP_BRAIN_FLOW.md) diagram.  
- **Add or change a tool:** See [Agent tools](#agent-tools-how-to-add-or-change-one).  
- **Debug agent behavior:** See [Debugging playbook](#debugging-playbook).  
- **Bedside note / planning memory:** See [Planning memory triggers](#planning-memory-triggers).

## The routing map (what to open, in order)

### 1. Architecture & State
- **State Provider:** `features/core/context/AppBrainContext.tsx` — The central hub. Aggregates manuscript, analysis, intelligence, and UI state into the `AppBrainState`.
- **Context Builders:** `services/appBrain/contextBuilder.ts`, `services/appBrain/adaptiveContext.ts` — Where raw state is converted into "Smart Context" prompts for the AI.

### 2. Parallel Agent Paths
The application has three distinct ways of using agentic intelligence:

*   **A. Conversational Orchestrator (Main Agent)**
    *   **Entrypoint:** `features/agent/hooks/useAgentOrchestrator.ts` (UI hook).
    *   **Logic:** `services/core/agentOrchestratorMachine.ts` (State machine) + `services/core/agentToolLoop.ts` (Execution).
    *   **Use case:** Chat, complex multi-step editing, research, analysis requests.

*   **B. Shadow Reader (Reactions)**
    *   **Entrypoint:** `services/agent/readerService.ts`.
    *   **Logic:** Stateless, direct-to-LLM calls using specific "Reader Personas".
    *   **Use case:** Generating inline reactions ("boring", "love this") in `ShadowReaderPanel`.

*   **C. Proactive Thinker (Background)**
    *   **Entrypoint:** `services/appBrain/proactiveThinker.ts`.
    *   **Logic:** Event-driven, debounced background loop. Watches for significant edits or chapter changes.
    *   **Use case:** Unsolicited suggestions ("Timeline conflict detected", "Voice drift") and memory consolidation.

### 3. Intelligence Layer (The "Senses")
Before the agent "thinks," the application "sees" the manuscript via deterministic analysis.
- **Unified API:** `services/intelligence/index.ts`.
- **Components:** `structuralParser` (scenes/paragraphs), `entityExtractor` (characters/locations), `timelineTracker` (chronology), `voiceProfiler` (dialogue style).
- **Flow:** Code changes → `useManuscriptIntelligence` → `AppBrainState` → Agent Context.

## How the agent gets context (files to inspect)

- **Smart Context:** `services/appBrain/index.ts` exports `getSmartAgentContext`. This selects the right "Profile" (Editing vs. Analysis vs. General) to budget tokens.
- **Memory Fetch:** `services/memory/index.ts` and `services/memory/bedsideHistorySearch.ts` retrieve relevant long-term memories and bedside notes.
- **Token Budgeting:** `config/models.ts` and `config/api.ts` define the hard limits for different models (Flash vs. Pro).

## Tools catalog

Tools are the "hands" of the agent.

- **Definition:** `services/gemini/agentTools.ts` — Contains the `FunctionDeclaration` schema for all tools (Navigation, Editing, Analysis, Memory, etc.).
- **Registry:** `services/commands/registry.ts` — Maps tool names to executable Command classes.
- **Implementation:** `services/commands/*.ts` — The actual logic for each command.
- **Execution:** `services/gemini/toolExecutor.ts` — The bridge between the LLM's function call and the Command Registry.

**Reference:** See [AGENT_TOOLS_REFERENCE.md](./AGENT_TOOLS_REFERENCE.md) for the full list of available tools.

## Legacy paths (Deprecated)

Avoid touching these unless fixing regressions in old code:
- `features/agent/hooks/useAgentService.ts`: Old distinct state management.
- `features/agent/hooks/useAgenticEditor.ts`: Wrapper around the legacy service for editor specific tasks.
- `features/agent/components/ChatInterface.tsx`: Some parts may still reference the old service pattern, but are migrating to `useAgentOrchestrator`.

## Agent tools: how to add or change one

1. **Define/modify tool schema:** `services/gemini/agentTools.ts` (FunctionDeclarations).  
2. **Wire execution:** Add or update a command in `services/commands/*.ts` and register it in `services/commands/registry.ts`.  
3. **Expose to orchestrator:** Ensure the **tool name** in `agentTools.ts` matches the command name in `CommandRegistry`.
4. **Docs:** Add the tool to [AGENT_TOOLS_REFERENCE.md](./AGENT_TOOLS_REFERENCE.md).
5. **Tests:** Add coverage under `tests/services/commands/`.

## Planning memory triggers

The bedside-note planning memory is evolved from multiple entrypoints:

- **Proactive thinker:** `services/appBrain/proactiveThinker.ts` (chapter transition, significant edits).
- **Analysis → plan:** `features/agent/hooks/useMemoryIntelligence.ts` (turns analysis + goals into plan text).  
- **Goals lifecycle:** `services/memory/index.ts`.
- **Agent tools:** The `update_bedside_note` tool allows the agent to explicitly modify the plan during conversation.
- **Reference doc:** [BEDSIDE_NOTE_ROADMAP.md](./BEDSIDE_NOTE_ROADMAP.md).

## Debugging playbook

1. **Reproduce with App Brain:** Confirm `projectId`, active chapter, and pending events are correct in the debug panel (if available) or console logs.
2. **Inspect prompt assembly:** Log `getSmartAgentContext` output to verify what the agent actually "sees".
3. **Check event flow:** Verify the `eventBus` fired the expected event (e.g., `TEXT_CHANGED`) and `proactiveThinker` received it (if debugging background suggestions).
4. **Tool path check:** If a tool fails, check `services/core/agentToolLoop.ts` logs. Does the tool name match the registry?
5. **Memory effects:** Inspect `evolveBedsideNote` calls to see why a plan updated (or didn't).

## Proposing new agent ideas

- **New proactive behaviors:** Add logic to `services/appBrain/proactiveThinker.ts`.
- **New context signals:** Extend `services/intelligence` (deterministic) and expose it via `AppBrainState`.
- **New tool capabilities:** Create a new Command in `services/commands/` and register it.
