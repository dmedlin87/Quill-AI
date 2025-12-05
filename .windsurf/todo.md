# TODO

## Current task: UX must-haves (tooltips/shortcuts/inline guidance/context)

1. Add tooltips with shortcuts and disabled reasons to primary MagicBar actions and any editor toolbar buttons.
2. Add inline guidance/empty-state hints when no selection or empty doc (e.g., “Highlight text and press Shift+Enter to open Magic”).
3. Wire smart context assembly (getSmartAgentContext) into AgentController sendMessage to use model-aware budgets and relevant memories.
4. Add targeted tests or instrumentation where feasible (context wiring), and run relevant suites.

## Current task: Test failures from `npm run test:coverage`

1. Memory mocks: ensure db.memories fallback/toCollection works in tests (autoObserver/memoryQueries); update mocks if needed.
2. AdaptiveContext: ensure stale bedside refresh, hierarchical merge order, conflict alert injection, and getMemoriesForContext/goals calls are triggered as expected.
3. Gemini audio/client: mock GoogleGenAI and AudioContext constructors; make generateSpeech return mocked AudioBuffer; adjust live session mocks.
4. Intelligence chunk index/manager: fix dirty queue/priority ordering, hash/dirty flags, and processing callbacks/batching.
5. Contradiction & timeline tracker: align causal chain/plot promise/timeline marker detection with expectations.
6. Re-run targeted suites (memory, appBrain/adaptiveContext, gemini audio/client, intelligence timeline/chunk/contradiction) to confirm passing.

## Previous refactor tasks (backlog)

1. Wire shared context + tool adapter: replace promptBuilder usage in AgentController and useAgentOrchestrator with agentContextBuilder; use createToolCallAdapter in orchestrator; add streaming guard.
2. Cleanup lifecycle: ensure eventBus unsubscribe on reinit/unmount and tighten reset/dispose semantics in AgentController.
3. Add tests for tool loop, abort, persona reinit, streaming guard, and subscription cleanup.
4. Run targeted tests (or at least relevant suites) after refactor.
