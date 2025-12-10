---
# Plan

1. Analyze useAgentOrchestrator, useMemoryIntelligence, AnalysisStatus/AppBrainActions contexts, and ChatInterface to identify uncovered error/cleanup branches.
2. Add/extend tests covering agent orchestration error/abort/race paths, context provider usage/errors, and ChatInterface timeout/optimistic/retry failure flows.
3. Run verification: npx vitest tests/features/agent tests/features/core; summarize coverage changes.