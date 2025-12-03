# App Brain, Memory, and Intelligence Flow

This diagram shows how Quill AI threads together the App Brain, the persistent memory system, and the deterministic intelligence layer when serving the agent.

```mermaid
graph TD
  UI[User Inputs & UI State] -->|cursor, selections, panels| Brain[(App Brain)]
  Manuscript[Manuscript & Lore Stores] -->|chapters, branches, lore| Brain
  Engine[Intelligence Engine] -->|HUD, entities, timeline| Brain
  MemorySvc[Memory Service] -->|memories & goals for context| Brain
  Brain -->|context builders (with memory)| Orchestrator[Agent Orchestrator]
  Orchestrator -->|tool calls & prompts| AgentLLM[Agent Session / LLM]
  AgentLLM -->|actions & critiques| Orchestrator
  Orchestrator -->|event bus updates| Brain
  MemorySvc <-->|Dexie persistence| DB[(IndexedDB)]
```

**Flow notes**

- The App Brain aggregates manuscript, UI, analysis, and intelligence signals into a single state container that every agent session can read from.
- Context builders pull in persisted memories and goals when the project ID is known so prompts include long-term knowledge alongside the live App Brain state.
- The agent orchestrator reads the App Brain state, initializes sessions with full manuscript and intelligence context, and streams tool executions back through the App Brain event bus.
- Memory CRUD flows through the memory service into IndexedDB, and the App Brain consumes the formatted memory slices when constructing prompts.
