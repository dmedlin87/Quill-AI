# Plan

1) Refactor KnowledgeGraph.tsx: enforce strict types for nodes/links/legend/props; memoize derived data; stabilize callbacks; harden ResizeObserver fallback and cleanup for observer/listeners/animation frame.
2) Consolidate tests: strengthen tests/components/KnowledgeGraph.test.tsx for empty vs populated render, hover/click selection, resize behavior (mocked ResizeObserver), and unmount cleanup; port unique scenarios from tests/features/lore/KnowledgeGraphFlow.test.tsx.
3) Remove stale flow test file after porting coverage.
4) Verify via npm test tests/components/KnowledgeGraph.test.tsx and report results.