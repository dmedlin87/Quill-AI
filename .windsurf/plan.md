# Agent Hooks Coverage Plan

## Goal
Raise branch coverage for `useAgentOrchestrator` and `useMemoryIntelligence` to >90%.

## Analysis
- **useAgentOrchestrator**: Missing branches in error handling, tool execution, and session initialization.
- **useMemoryIntelligence**: Missing branches in analysis observation, consolidation concurrency, and error handling.

## Changes
1. **useAgentOrchestrator.test.ts**:
   - Added `handles session initialization error`.
   - Added `handles tool execution flow (failure)`.
   - Added `handles sendMessage when chatRef is missing`.
   - Verified `emitToolExecuted` calls.
   - Removed empty/dead tests.

2. **useMemoryIntelligence.test.ts**:
   - Added `handles Bedside Note serialization failure`.
   - Added `handles errors when evolving bedside note`.
   - Added `prevents concurrent consolidation`.
   - Added `handles no project ID` cases for all methods.
   - Added `handles error when refreshing health stats`.
   - Added `responds to ANALYSIS_COMPLETED events`.
   - Added `does not respond to ANALYSIS_COMPLETED if autoObserve is disabled`.

## Verification
- Run `npm run test:run -- tests/features/agent/hooks/` to verify tests pass.
- Check coverage reports to ensure >90% branch coverage for target files.
