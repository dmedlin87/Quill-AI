# Test Coverage Roadmap

## Goal
Increase global branch coverage to >90%. Current status: **75.64%**.

## High Priority Targets (The "Zeros" & Low Performers)

These files have very low or zero branch coverage and are critical for the application's intelligence and memory features.

### Phase 1: The "Zeros" (Near 0% Coverage)

1.  **`services/memory/dreaming.ts`**
    *   **Current Coverage:** 0% Branch
    *   **Strategy:** Create `tests/services/memory/dreaming.test.ts`. Focus on mocking the dream generation logic and state transitions.

2.  **`services/memory/relevance.ts`**
    *   **Current Coverage:** 0% Branch
    *   **Strategy:** Create `tests/services/memory/relevance.test.ts`. Test relevance scoring algorithms with various input scenarios.

3.  **`services/appBrain/dreamingService.ts`**
    *   **Current Coverage:** 0% Branch
    *   **Strategy:** Create `tests/services/appBrain/dreamingService.test.ts`. Test the service layer that likely coordinates the memory dreaming.

### Phase 2: Core Intelligence Gaps (<70% Coverage)

4.  **`services/appBrain/proactiveThinker.ts`**
    *   **Current Coverage:** ~50% Branch
    *   **Strategy:** Expand `tests/services/appBrain/proactiveThinker.test.ts`. Mock dependencies to simulate various thought triggers and verify the thinker's output.

5.  **`services/memory/voiceProfiles.ts`**
    *   **Current Coverage:** ~22% Branch
    *   **Strategy:** Expand `tests/services/memory/voiceProfiles.test.ts`. Add tests for profile creation, updating, and matching logic.

### Phase 3: Voice & Complex Async

6.  **`features/voice/hooks/useVoiceSession.ts`**
    *   **Current Coverage:** ~69% Branch
    *   **Strategy:** Enhance tests to better mock the voice session lifecycle (connect, disconnect, speaking states).

7.  **`features/voice/hooks/useAudioController.ts`** (was `useVoiceController` in logs?)
    *   **Current Coverage:** ~53% Branch
    *   **Strategy:** Improve Web Audio API mocks to test more branches of the audio control logic.

### Phase 4: Intelligence Services

8.  **`services/intelligence/worker.ts`**
    *   **Current Coverage:** ~63% Branch
    *   **Strategy:** Test the worker message handling and task dispatching logic.

9.  **`services/intelligence/entityExtractor.ts`**
    *   **Current Coverage:** ~63% Branch
    *   **Strategy:** Add more edge cases for entity extraction (empty inputs, ambiguous entities).

## Execution Plan

I will proceed by tackling Phase 1 and 2 in the current session, verifying coverage improvements after each major change.
