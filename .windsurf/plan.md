# Plan

1) Lock coverage guardrails: confirm Vitest thresholds at 90/90/90/90 and add smoke coverage for zero-covered barrels (features/*/index.ts, services/*/index.ts). **(Done)** — thresholds aligned; barrel smoke tests added; coverage run executed.
2) Phase 1 branch lifts: add focused tests for agent UI/hooks (ChatInterface, useAgentOrchestrator, useMemoryIntelligence), core contexts (AppBrainContext, EditorContext, useSettingsStore), and shared hooks (useManuscriptIntelligence, useTiptapSync, useChunkIndex). **(In Progress)** — starting agent UI/hooks batch.
3) Measure branch delta, rerun `npm run test:audit`, and prioritize next Phase 2 batch (intelligence/memory/AppBrain). **(Not started)**
