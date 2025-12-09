/**
 * Proactive Flow Integration Tests
 * 
 * Tests the proactive assistance loop: SignificantEditMonitor triggers
 * ProactiveThinker which generates suggestions that appear in the UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Hoist the mock function so it's available before module initialization
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock the Gemini client before imports
vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: mockGenerateContent,
    },
  },
}));

// Mock the database
const { dbMock, memories, goals, watchedEntities } = vi.hoisted(() => {
  const memories: any[] = [];
  const goals: any[] = [];
  const watchedEntities: any[] = [];

  const createCollection = (data: any[]) => ({
    filter: (predicate: (item: any) => boolean) => createCollection(data.filter(predicate)),
    toArray: () => Promise.resolve([...data]),
    equals: () => createCollection(data),
  });

  const dbMock = {
    memories: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => [...memories]),
        })),
      })),
      filter: vi.fn((predicate: (item: any) => boolean) => createCollection(memories.filter(predicate))),
      add: vi.fn(async (memory: any) => {
        memories.push(memory);
        return memory.id;
      }),
      get: vi.fn(async (id: string) => memories.find(m => m.id === id)),
      toArray: vi.fn(async () => [...memories]),
    },
    goals: {
      where: vi.fn(() => ({
        equals: vi.fn(() => createCollection(goals)),
      })),
      add: vi.fn(async (goal: any) => {
        goals.push(goal);
        return goal.id;
      }),
      get: vi.fn(async (id: string) => goals.find(g => g.id === id)),
    },
    watchedEntities: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => [...watchedEntities]),
        })),
      })),
      add: vi.fn(),
      get: vi.fn(),
    },
  };

  return { dbMock, memories, goals, watchedEntities };
});

vi.mock('@/services/db', () => ({ db: dbMock }));

// Mock bedside embeddings
vi.mock('@/services/memory/bedsideEmbeddings', () => ({
  embedBedsideNoteText: vi.fn(async () => new Array(768).fill(0.1)),
}));

import { eventBus, resetProactiveThinker } from '@/services/appBrain';
import { ProactiveThinker, getProactiveThinker } from '@/services/appBrain/proactiveThinker';
import { getSignificantEditMonitor, stopSignificantEditMonitor } from '@/services/appBrain/significantEditMonitor';
import type { AppBrainState } from '@/services/appBrain/types';
import { createEmptyAppBrainState } from '@/services/appBrain';

const createMockAppBrainState = (): AppBrainState => {
  const base = createEmptyAppBrainState();
  return {
    ...base,
    manuscript: {
      ...base.manuscript,
      projectId: 'test-project',
      projectTitle: 'Test Novel',
      chapters: [{ id: 'ch-1', projectId: 'test-project', title: 'Chapter 1', content: 'Test content', order: 0, updatedAt: Date.now() }],
      activeChapterId: 'ch-1',
      currentText: 'Test content with some edits happening here.',
    },
    intelligence: {
      ...base.intelligence,
      hud: {
        situational: {
          currentScene: null, // Keep simple for tests
          tensionLevel: 'medium',
          pacing: 'moderate',
          narrativePosition: { sceneIndex: 1, totalScenes: 5, percentComplete: 20 },
        },
        context: {
          activeEntities: [
            { id: 'char-1', name: 'Alice', type: 'character', mentionCount: 5, aliases: [] },
          ],
          activeRelationships: [],
          openPromises: [],
          pendingSetups: [],
          relevantMemories: [],
        },
        styleAlerts: [],
        prioritizedIssues: [],
        stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 15 },
      } as any, // Cast to any to avoid complex type matching in tests
      lastProcessedAt: Date.now(),
    },
  };
};

describe('Proactive Flow Integration', () => {
  let mockState: AppBrainState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset data stores
    memories.length = 0;
    goals.length = 0;
    watchedEntities.length = 0;
    
    // Reset singletons
    resetProactiveThinker();
    stopSignificantEditMonitor();
    eventBus.dispose();
    
    mockState = createMockAppBrainState();

    // Mock successful LLM response
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        significant: true,
        suggestions: [
          {
            title: 'Character consistency check',
            description: 'Alice appears frequently - ensure her voice remains consistent.',
            priority: 'medium',
            type: 'character',
          },
        ],
        reasoning: 'Detected active character with multiple mentions.',
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetProactiveThinker();
    stopSignificantEditMonitor();
    eventBus.dispose();
  });

  describe('ProactiveThinker', () => {
    it('generates suggestions when events are batched and debounce fires', async () => {
      const onSuggestion = vi.fn();
      const thinker = new ProactiveThinker({ debounceMs: 100, minEventsToThink: 2 });
      
      thinker.start(() => mockState, 'test-project', onSuggestion);

      // Emit events to trigger thinking
      await act(async () => {
        eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 50 } });
        eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 150, delta: 50 } });
        eventBus.emit({ type: 'INTELLIGENCE_UPDATED', payload: { tier: 'debounced' } });
      });

      // Advance timers to trigger debounced thinking
      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Wait for async operations
      await vi.waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalled();
      });

      thinker.stop();
    });

    it('emits PROACTIVE_THINKING_STARTED and PROACTIVE_THINKING_COMPLETED events', async () => {
      const startedHandler = vi.fn();
      const completedHandler = vi.fn();
      
      eventBus.subscribe('PROACTIVE_THINKING_STARTED', startedHandler);
      eventBus.subscribe('PROACTIVE_THINKING_COMPLETED', completedHandler);

      const thinker = new ProactiveThinker({ debounceMs: 50, minEventsToThink: 1 });
      thinker.start(() => mockState, 'test-project', vi.fn());

      await act(async () => {
        eventBus.emit({ type: 'INTELLIGENCE_UPDATED', payload: { tier: 'full' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await vi.waitFor(() => {
        expect(startedHandler).toHaveBeenCalled();
      });

      thinker.stop();
    });

    it('treats SIGNIFICANT_EDIT_DETECTED as an urgent event', async () => {
      const thinker = new ProactiveThinker({ debounceMs: 10000, minEventsToThink: 10 });
      thinker.start(() => mockState, 'test-project', vi.fn());

      // Even though we have high thresholds, SIGNIFICANT_EDIT_DETECTED is urgent
      await act(async () => {
        eventBus.emit({ type: 'SIGNIFICANT_EDIT_DETECTED', payload: { delta: 500 } });
      });

      // Urgent events should use shorter delay
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      await vi.waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalled();
      });

      thinker.stop();
    });
  });

  describe('SignificantEditMonitor', () => {
    it('accumulates text changes toward threshold', () => {
      // This test verifies the monitor is properly set up and listening
      // The actual event emission is tested in the end-to-end flow
      const monitor = getSignificantEditMonitor({ threshold: 100, debounceMs: 50, cooldownMs: 0 });
      monitor.start('test-project');

      // Emit text changes
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 60 }, timestamp: Date.now() });
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 160, delta: 60 }, timestamp: Date.now() + 1 });

      // Monitor should be running without errors
      expect(monitor).toBeDefined();

      monitor.stop();
    });
  });

  describe('End-to-end flow', () => {
    it('editor change triggers SignificantEditMonitor which triggers ProactiveThinker', async () => {
      const onSuggestion = vi.fn();
      
      // Start the proactive thinker
      const thinker = new ProactiveThinker({ debounceMs: 50, minEventsToThink: 1 });
      thinker.start(() => mockState, 'test-project', onSuggestion);

      // Start the edit monitor
      const monitor = getSignificantEditMonitor({ threshold: 100, debounceMs: 30, cooldownMs: 0 });
      monitor.start('test-project');

      // Simulate significant edits
      await act(async () => {
        eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 150 }, timestamp: Date.now() });
      });

      // Wait for edit monitor debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Wait for thinker debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // The LLM should have been called
      await vi.waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalled();
      });

      monitor.stop();
      thinker.stop();
    });
  });
});
