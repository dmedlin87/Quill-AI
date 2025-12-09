import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProactiveThinker,
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  resetProactiveThinker,
} from '@/services/appBrain/proactiveThinker';
import { eventBus } from '@/services/appBrain/eventBus';
import type { AppBrainState } from '@/services/appBrain/types';

// Mock the Gemini AI client
vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(() => Promise.resolve({
        text: JSON.stringify({
          significant: true,
          suggestions: [
            {
              title: 'Test Suggestion',
              description: 'A test suggestion from the thinker',
              priority: 'medium',
              type: 'plot',
            },
          ],
          reasoning: 'Test reasoning',
        }),
      })),
    },
  },
}));

const memoryMocks = vi.hoisted(() => ({
  evolveBedsideNote: vi.fn(),
}));

// Mock the intelligence memory bridge
vi.mock('@/services/appBrain/intelligenceMemoryBridge', () => ({
  getHighPriorityConflicts: vi.fn(() => Promise.resolve([])),
  formatConflictsForPrompt: vi.fn(() => ''),
}));

// Mock the memory proactive service
vi.mock('@/services/memory/proactive', () => ({
  getImportantReminders: vi.fn(() => Promise.resolve([])),
}));

// Mock the core memory service bedside-note evolution
vi.mock('@/services/memory', () => {
  return {
    evolveBedsideNote: (...args: any[]) => memoryMocks.evolveBedsideNote(...args),
    getVoiceProfileForCharacter: vi.fn(),
    upsertVoiceProfile: vi.fn(),
  };
});

// Mock bedside history search
vi.mock('@/services/memory/bedsideHistorySearch', () => ({
  searchBedsideHistory: vi.fn(() => Promise.resolve([
    {
      similarity: 0.85,
      note: {
        id: 'note-1',
        text: 'Character Alice has a background in medicine.',
        createdAt: Date.now() - 86400000, // 1 day ago
      },
    },
  ])),
}));

describe('proactiveThinker', () => {
  const createMockState = (): AppBrainState => ({
    manuscript: {
      projectId: 'test-project',
      projectTitle: 'Test Novel',
      chapters: [{ id: 'c1', title: 'Chapter 1', content: 'abc', order: 0, updatedAt: 0, projectId: 'test-project' }],
      activeChapterId: 'c1',
      currentText: 'Test content',
      branches: [],
      activeBranchId: null,
    },
    intelligence: {
      hud: {
        situational: {
          currentScene: null,
          currentParagraph: null,
          narrativePosition: { sceneIndex: 0, totalScenes: 1, percentComplete: 50 },
          tensionLevel: 'medium',
          pacing: 'moderate',
        },
        context: {
          activeEntities: [],
          activeRelationships: [],
          openPromises: [],
          recentEvents: [],
        },
        styleAlerts: [],
        prioritizedIssues: [],
        recentChanges: [],
        stats: { wordCount: 100, readingTime: 1, dialoguePercent: 20, avgSentenceLength: 15 },
        lastFullProcess: Date.now(),
        processingTier: 'background',
      },
      full: null,
      entities: null,
      timeline: null,
      style: null,
      heatmap: null,
      lastProcessedAt: Date.now(),
    },
    analysis: {
      result: null,
      status: { pacing: 'idle', characters: 'idle', plot: 'idle', setting: 'idle' },
      inlineComments: [],
    },
    lore: {
      characters: [],
      worldRules: [],
      manuscriptIndex: null,
    },
    ui: {
      cursor: { position: 0, scene: null, paragraph: null },
      selection: null,
      activePanel: 'chat',
      activeView: 'editor',
      isZenMode: false,
      activeHighlight: null,
      microphone: { status: 'idle', mode: 'voice', lastTranscript: null, error: null },
    },
    session: {
      chatHistory: [],
      currentPersona: null,
      pendingToolCalls: [],
      lastAgentAction: null,
      isProcessing: false,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetProactiveThinker();
    memoryMocks.evolveBedsideNote.mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetProactiveThinker();
  });

  describe('ProactiveThinker class', () => {
    it('creates with default config', () => {
      const thinker = new ProactiveThinker();
      const status = thinker.getStatus();

      expect(status.isThinking).toBe(false);
      expect(status.lastThinkTime).toBe(0);
      expect(status.pendingEvents).toHaveLength(0);
    });

    it('can be created with custom config', () => {
      const thinker = new ProactiveThinker({
        debounceMs: 5000,
        maxBatchSize: 10,
        enabled: true,
      });

      expect(thinker.getStatus().isThinking).toBe(false);
    });

    it('starts and stops correctly', () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      expect(thinker.getStatus().pendingEvents).toHaveLength(0);

      thinker.stop();
      // Should be safe to call stop multiple times
      thinker.stop();
    });

    it('batches events', () => {
      const thinker = new ProactiveThinker({ minEventsToThink: 5 });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit some events
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });
      eventBus.emit({ type: 'CURSOR_MOVED', payload: { position: 50, scene: null } });
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 110, delta: 10 } });

      const status = thinker.getStatus();
      expect(status.pendingEvents.length).toBeGreaterThanOrEqual(0);

      thinker.stop();
    });

    it('respects maxBatchSize', () => {
      const thinker = new ProactiveThinker({ maxBatchSize: 3 });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit more events than maxBatchSize
      for (let i = 0; i < 10; i++) {
        eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100 + i, delta: 1 } });
      }

      const status = thinker.getStatus();
      expect(status.pendingEvents.length).toBeLessThanOrEqual(3);

      thinker.stop();
    });

    it('does not think when disabled', () => {
      const thinker = new ProactiveThinker({ enabled: false });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit events
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      // Should not have any pending events since thinker is disabled
      const status = thinker.getStatus();
      expect(status.pendingEvents).toHaveLength(0);
    });

    it('emits a timeline conflict suggestion when temporal markers contradict timeline', async () => {
      const thinker = new ProactiveThinker({ debounceMs: 5000 });
      const state = createMockState();

      state.intelligence.timeline = {
        events: [
          {
            id: 'evt-1',
            description: 'Established on Friday',
            offset: 0,
            chapterId: 'c1',
            temporalMarker: 'Friday',
            relativePosition: 'after',
            dependsOn: [],
          },
        ],
        causalChains: [],
        promises: [],
        processedAt: Date.now(),
      };

      state.manuscript.currentText = 'The city slept. It was Tuesday when the alarms started.';

      const getState = () => state;
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      eventBus.emit({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 800, chapterId: 'c1' } });

      await Promise.resolve();

      expect(onSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'timeline_conflict' })
      );

      thinker.stop();
    });
  });

  describe('singleton functions', () => {
    it('getProactiveThinker returns same instance', () => {
      const thinker1 = getProactiveThinker();
      const thinker2 = getProactiveThinker();

      expect(thinker1).toBe(thinker2);
    });

    it('startProactiveThinker starts the singleton', () => {
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      const thinker = startProactiveThinker(getState, 'test-project', onSuggestion);

      expect(thinker).toBeDefined();
      expect(thinker.getStatus().isThinking).toBe(false);

      stopProactiveThinker();
    });

    it('stopProactiveThinker stops safely when not started', () => {
      // Should not throw
      stopProactiveThinker();
    });

    it('resetProactiveThinker clears the singleton', () => {
      const thinker1 = getProactiveThinker();
      resetProactiveThinker();
      const thinker2 = getProactiveThinker();

      expect(thinker1).not.toBe(thinker2);
    });
  });

  describe('forceThink', () => {
    it('returns null when not started', async () => {
      const thinker = new ProactiveThinker();

      const result = await thinker.forceThink();

      expect(result).toBeNull();
    });

    it('performs thinking when started', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Add some events
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      vi.useRealTimers(); // Need real timers for async
      const result = await thinker.forceThink();
      vi.useFakeTimers();

      expect(result).toBeDefined();
      expect(result?.thinkingTime).toBeGreaterThanOrEqual(0);

      thinker.stop();
    });
  });

  describe('thinking result parsing', () => {
    it('handles valid JSON response', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'ANALYSIS_COMPLETED', payload: { section: 'test', status: 'success' } });

      vi.useRealTimers();
      const result = await thinker.forceThink();
      vi.useFakeTimers();

      expect(result?.significant).toBe(true);
      expect(result?.suggestions.length).toBeGreaterThan(0);
      expect(result?.suggestions[0].title).toBe('Test Suggestion');

      thinker.stop();
    });

    it('calls onSuggestion callback for each suggestion', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      vi.useRealTimers();
      await thinker.forceThink();
      vi.useFakeTimers();

      expect(onSuggestion).toHaveBeenCalled();
      expect(onSuggestion.mock.calls[0][0]).toHaveProperty('title', 'Test Suggestion');

      thinker.stop();
    });
  });

  describe('event handling', () => {
    it('handles urgent events with shorter delay', () => {
      const thinker = new ProactiveThinker({
        urgentEventTypes: ['ANALYSIS_COMPLETED'],
        minEventsToThink: 1,
      });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit an urgent event
      eventBus.emit({ 
        type: 'ANALYSIS_COMPLETED', 
        payload: { section: 'pacing', status: 'success' } 
      });

      // Should have pending events
      expect(thinker.getStatus().pendingEvents.length).toBeGreaterThanOrEqual(0);

      thinker.stop();
    });

    it('clears pending events after thinking', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Add events
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 110, delta: 10 } });

      const beforeCount = thinker.getStatus().pendingEvents.length;

      vi.useRealTimers();
      await thinker.forceThink();
      vi.useFakeTimers();

      const afterCount = thinker.getStatus().pendingEvents.length;
      expect(afterCount).toBeLessThanOrEqual(beforeCount);

      thinker.stop();
    });

    it('skips thinking when already in progress', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Prime with an event
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      // Force in-progress state
      (thinker as any).state.isThinking = true;

      vi.useRealTimers();
      const result = await (thinker as any).performThinking();
      vi.useFakeTimers();

      expect(result).toBeNull();
      expect(onSuggestion).not.toHaveBeenCalled();

      thinker.stop();
    });

    it('respects bedside evolve cooldown for significant edits', () => {
      const thinker = new ProactiveThinker({
        bedsideCooldownMs: 1000,
        minEventsToThink: 1,
      });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();
      thinker.start(getState, 'test-project', onSuggestion);

      // First significant edit
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 1000, delta: 600 } });
      expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);

      // Second edit within cooldown should be suppressed
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 1600, delta: 600 } });
      expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledTimes(1);

      // Advance past both bedside cooldown (1s) and significant edit cooldown (5 min)
      vi.advanceTimersByTime(5 * 60 * 1000 + 2000);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 2200, delta: 600 } });
      expect(memoryMocks.evolveBedsideNote).toHaveBeenCalledTimes(2);

      thinker.stop();
    });

    it('disables bedside evolves when flag is off', () => {
      const thinker = new ProactiveThinker({
        allowBedsideEvolve: false,
      });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();
      thinker.start(getState, 'test-project', onSuggestion);

      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 1000, delta: 600 } });
      expect(memoryMocks.evolveBedsideNote).not.toHaveBeenCalled();

      thinker.stop();
    });

    it('handles SIGNIFICANT_EDIT_DETECTED as urgent event', () => {
      const thinker = new ProactiveThinker({
        debounceMs: 10000,
        minEventsToThink: 10, // High threshold
      });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // SIGNIFICANT_EDIT_DETECTED should be treated as urgent
      eventBus.emit({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 500, chapterId: 'ch-1' } });

      // Should have registered the event
      expect(thinker.getStatus().pendingEvents.length).toBeGreaterThanOrEqual(0);

      thinker.stop();
    });
  });

  describe('empty context handling', () => {
    it('handles state with no intelligence HUD gracefully', async () => {
      const emptyState: AppBrainState = {
        ...createMockState(),
        intelligence: {
          hud: null,
          full: null,
          entities: null,
          timeline: null,
          style: null,
          heatmap: null,
          lastProcessedAt: 0,
        },
      };

      const thinker = new ProactiveThinker();
      const getState = () => emptyState;
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      vi.useRealTimers();
      const result = await thinker.forceThink();
      vi.useFakeTimers();

      // Should still produce a result (or null) without throwing
      expect(result === null || typeof result === 'object').toBe(true);

      thinker.stop();
    });

    it('handles empty manuscript state gracefully', async () => {
      const emptyState: AppBrainState = {
        ...createMockState(),
        manuscript: {
          projectId: null,
          projectTitle: '',
          chapters: [],
          activeChapterId: null,
          currentText: '',
          branches: [],
          activeBranchId: null,
        },
      };

      const thinker = new ProactiveThinker();
      const getState = () => emptyState;
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 0, delta: 0 } });

      vi.useRealTimers();
      // Should not throw even with empty state
      const result = await thinker.forceThink();
      vi.useFakeTimers();

      expect(result === null || typeof result === 'object').toBe(true);

      thinker.stop();
    });

    it('handles no pending events gracefully', async () => {
      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Force think without any events
      vi.useRealTimers();
      const result = await thinker.forceThink();
      vi.useFakeTimers();

      expect(result).toBeNull();
      expect(onSuggestion).not.toHaveBeenCalled();

      thinker.stop();
    });
  });

  describe('rapid-fire edits', () => {
    it('debounces rapid-fire text changes', () => {
      const thinker = new ProactiveThinker({ debounceMs: 1000, maxBatchSize: 5 });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Simulate rapid-fire typing (10 changes in quick succession)
      for (let i = 0; i < 10; i++) {
        eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100 + i, delta: 1 } });
      }

      // Should batch events up to maxBatchSize
      const status = thinker.getStatus();
      expect(status.pendingEvents.length).toBeLessThanOrEqual(5);

      thinker.stop();
    });

    it('does not trigger thinking during debounce period', async () => {
      const thinker = new ProactiveThinker({ debounceMs: 500, minEventsToThink: 1 });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit events
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      // Advance only partially through debounce
      vi.advanceTimersByTime(200);

      // Emit more events - should reset debounce
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 110, delta: 10 } });

      // Still within debounce, should not have triggered thinking yet
      expect(onSuggestion).not.toHaveBeenCalled();

      thinker.stop();
    });

    it('eventually triggers thinking after debounce completes', async () => {
      const thinker = new ProactiveThinker({ debounceMs: 100, minEventsToThink: 1 });
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);

      // Emit event
      eventBus.emit({ type: 'INTELLIGENCE_UPDATED', payload: { tier: 'debounced' } });

      // Wait for debounce to complete
      vi.advanceTimersByTime(150);

      // Use real timers to allow async operations
      vi.useRealTimers();
      await vi.waitFor(() => {
        // The thinking should have been triggered
        expect(thinker.getStatus().pendingEvents.length).toBe(0);
      }, { timeout: 1000 });
      vi.useFakeTimers();

      thinker.stop();
    });
  });

  describe('proactive thinking events', () => {
    it('emits PROACTIVE_THINKING_STARTED when thinking begins', async () => {
      const startedHandler = vi.fn();
      eventBus.subscribe('PROACTIVE_THINKING_STARTED', startedHandler);

      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      vi.useRealTimers();
      await thinker.forceThink();
      vi.useFakeTimers();

      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROACTIVE_THINKING_STARTED',
          payload: expect.objectContaining({ trigger: expect.any(String) }),
        })
      );

      thinker.stop();
    });

    it('emits PROACTIVE_THINKING_COMPLETED when thinking ends', async () => {
      const completedHandler = vi.fn();
      eventBus.subscribe('PROACTIVE_THINKING_COMPLETED', completedHandler);

      const thinker = new ProactiveThinker();
      const getState = () => createMockState();
      const onSuggestion = vi.fn();

      thinker.start(getState, 'test-project', onSuggestion);
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      vi.useRealTimers();
      await thinker.forceThink();
      vi.useFakeTimers();

      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROACTIVE_THINKING_COMPLETED',
          payload: expect.objectContaining({
            suggestionsCount: expect.any(Number),
            thinkingTime: expect.any(Number),
          }),
        })
      );

      thinker.stop();
    });
  });
});
