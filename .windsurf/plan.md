# Plan

1) Lock coverage guardrails: confirm Vitest thresholds at 90/90/90/90 and add smoke coverage for zero-covered barrels (features/*/index.ts, services/*/index.ts). **(Done)** — thresholds aligned; barrel smoke tests added; coverage run executed.
2) Phase 1 branch lifts:
    1. Add branch-coverage tests for ChatInterface edge paths (memory fetch failure fallback, init abort when unmounted, empty initialMessage, interview mode intro, clear session re-init).
    2. Add branch-coverage tests for useMagicEditor error/abort paths (grammar check error, abort handling, applyAll grammar stale text, dismissGrammarSuggestion branches).
    3. Run targeted tests (ChatInterface.test.tsx, useMagicEditor.test.ts) then full coverage to verify branch improvements.
    Add focused tests for agent UI/hooks (ChatInterface, useAgentOrchestrator, useMemoryIntelligence), core contexts (AppBrainContext, EditorContext, useSettingsStore), and shared hooks (useManuscriptIntelligence, useTiptapSync, useChunkIndex). **(In Progress)** — agent UI/hooks done; expanding to low-branch services (telemetry, appBrain, memory).
3) Measure branch delta, rerun `npm run test:audit`, and prioritize next Phase 2 batch (intelligence/memory/AppBrain). **(In Progress)** — coverage run failed on global branches; lifting low-branch files now.
