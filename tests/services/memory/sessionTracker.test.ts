import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackSessionMemory,
  trackSessionMemoryUpdate,
  trackSessionMemoryDelete,
  trackSessionGoal,
  clearSessionMemories,
  getSessionState,
  getSessionMemoryCount,
  shouldRefreshContext,
  getSessionMemorySummary,
  enrichToolResponse,
  findSessionMemoriesByTag,
  hasRecentSimilarMemory,
} from '@/services/memory/sessionTracker';
import type { MemoryNote } from '@/services/memory/types';

const createMockNote = (overrides?: Partial<MemoryNote>): MemoryNote => ({
  id: 'mem-1',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Sarah has blue eyes',
  type: 'fact',
  topicTags: ['character:sarah'],
  importance: 0.7,
  createdAt: Date.now(),
  ...overrides,
});

describe('sessionTracker', () => {
  beforeEach(() => {
    clearSessionMemories();
  });

  describe('trackSessionMemory', () => {
    it('adds memory to session state', () => {
      const note = createMockNote();
      trackSessionMemory(note);

      const state = getSessionState();
      expect(state.created).toHaveLength(1);
      expect(state.created[0]).toEqual(note);
    });

    it('replaces existing memory with same id', () => {
      const note1 = createMockNote({ id: 'mem-1', text: 'Original' });
      const note2 = createMockNote({ id: 'mem-1', text: 'Updated' });

      trackSessionMemory(note1);
      trackSessionMemory(note2);

      const state = getSessionState();
      expect(state.created).toHaveLength(1);
      expect(state.created[0].text).toBe('Updated');
    });

    it('adds multiple different memories', () => {
      trackSessionMemory(createMockNote({ id: 'mem-1' }));
      trackSessionMemory(createMockNote({ id: 'mem-2' }));
      trackSessionMemory(createMockNote({ id: 'mem-3' }));

      expect(getSessionMemoryCount()).toBe(3);
    });
  });

  describe('trackSessionMemoryUpdate', () => {
    it('tracks memory update', () => {
      trackSessionMemoryUpdate('mem-1', 'Updated importance');

      const state = getSessionState();
      expect(state.updated).toHaveLength(1);
      expect(state.updated[0]).toEqual({ id: 'mem-1', changes: 'Updated importance' });
    });

    it('tracks multiple updates', () => {
      trackSessionMemoryUpdate('mem-1', 'First update');
      trackSessionMemoryUpdate('mem-2', 'Second update');

      const state = getSessionState();
      expect(state.updated).toHaveLength(2);
    });
  });

  describe('trackSessionMemoryDelete', () => {
    it('tracks deleted memory id', () => {
      trackSessionMemoryDelete('mem-1');

      const state = getSessionState();
      expect(state.deleted).toContain('mem-1');
    });

    it('does not duplicate delete tracking', () => {
      trackSessionMemoryDelete('mem-1');
      trackSessionMemoryDelete('mem-1');

      const state = getSessionState();
      expect(state.deleted).toHaveLength(1);
    });

    it('removes from created if memory was created this session', () => {
      const note = createMockNote({ id: 'mem-1' });
      trackSessionMemory(note);
      expect(getSessionMemoryCount()).toBe(1);

      trackSessionMemoryDelete('mem-1');

      expect(getSessionMemoryCount()).toBe(0);
      expect(getSessionState().deleted).toContain('mem-1');
    });
  });

  describe('trackSessionGoal', () => {
    it('tracks goal creation', () => {
      trackSessionGoal('goal-1');

      const state = getSessionState();
      expect(state.goalsCreated).toContain('goal-1');
    });

    it('does not duplicate goal tracking', () => {
      trackSessionGoal('goal-1');
      trackSessionGoal('goal-1');

      const state = getSessionState();
      expect(state.goalsCreated).toHaveLength(1);
    });
  });

  describe('clearSessionMemories', () => {
    it('resets all session state', () => {
      trackSessionMemory(createMockNote());
      trackSessionMemoryUpdate('mem-1', 'update');
      trackSessionMemoryDelete('mem-2');
      trackSessionGoal('goal-1');

      clearSessionMemories();

      const state = getSessionState();
      expect(state.created).toHaveLength(0);
      expect(state.updated).toHaveLength(0);
      expect(state.deleted).toHaveLength(0);
      expect(state.goalsCreated).toHaveLength(0);
    });

    it('resets session start time', () => {
      const beforeClear = getSessionState().startedAt;

      // Wait a bit
      clearSessionMemories();

      const afterClear = getSessionState().startedAt;
      expect(afterClear).toBeGreaterThanOrEqual(beforeClear);
    });
  });

  describe('getSessionState', () => {
    it('returns immutable copy of state', () => {
      trackSessionMemory(createMockNote());

      const state1 = getSessionState();
      const state2 = getSessionState();

      expect(state1).not.toBe(state2);
      expect(state1.created).not.toBe(state2.created);
    });

    it('includes startedAt timestamp', () => {
      const state = getSessionState();
      expect(state.startedAt).toBeDefined();
      expect(typeof state.startedAt).toBe('number');
    });
  });

  describe('getSessionMemoryCount', () => {
    it('returns count of created memories', () => {
      expect(getSessionMemoryCount()).toBe(0);

      trackSessionMemory(createMockNote({ id: 'mem-1' }));
      expect(getSessionMemoryCount()).toBe(1);

      trackSessionMemory(createMockNote({ id: 'mem-2' }));
      expect(getSessionMemoryCount()).toBe(2);
    });
  });

  describe('shouldRefreshContext', () => {
    it('returns false when no changes', () => {
      expect(shouldRefreshContext()).toBe(false);
    });

    it('returns true when changes exceed threshold', () => {
      for (let i = 0; i < 5; i++) {
        trackSessionMemory(createMockNote({ id: `mem-${i}` }));
      }

      expect(shouldRefreshContext()).toBe(true);
    });

    it('respects custom threshold', () => {
      trackSessionMemory(createMockNote({ id: 'mem-1' }));
      trackSessionMemory(createMockNote({ id: 'mem-2' }));

      expect(shouldRefreshContext(3)).toBe(false);
      expect(shouldRefreshContext(2)).toBe(true);
    });

    it('counts all change types', () => {
      trackSessionMemory(createMockNote());
      trackSessionMemoryUpdate('mem-2', 'update');
      trackSessionMemoryDelete('mem-3');
      trackSessionGoal('goal-1');

      expect(shouldRefreshContext(4)).toBe(true);
    });
  });

  describe('getSessionMemorySummary', () => {
    it('returns empty string when no activity', () => {
      expect(getSessionMemorySummary()).toBe('');
    });

    it('summarizes created memories', () => {
      trackSessionMemory(createMockNote({ text: 'First memory about Sarah', type: 'fact', topicTags: ['character'] }));
      trackSessionMemory(createMockNote({ id: 'mem-2', text: 'Second memory', type: 'observation', topicTags: ['plot'] }));

      const summary = getSessionMemorySummary();

      expect(summary).toContain('2 memories created');
      expect(summary).toContain('fact');
    });

    it('summarizes goals created', () => {
      trackSessionGoal('goal-1');
      trackSessionGoal('goal-2');

      const summary = getSessionMemorySummary();

      expect(summary).toContain('2 goals created');
    });

    it('summarizes updates', () => {
      trackSessionMemoryUpdate('mem-1', 'change');

      const summary = getSessionMemorySummary();

      expect(summary).toContain('1 memories updated');
    });

    it('truncates long memory text in preview', () => {
      const longText = 'A'.repeat(100);
      trackSessionMemory(createMockNote({ text: longText }));

      const summary = getSessionMemorySummary();

      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(longText.length + 100);
    });

    it('shows only last 3 memories with ...and N more', () => {
      for (let i = 0; i < 5; i++) {
        trackSessionMemory(createMockNote({ id: `mem-${i}`, text: `Memory ${i}` }));
      }

      const summary = getSessionMemorySummary();

      expect(summary).toContain('...and 2 more');
    });
  });

  describe('enrichToolResponse', () => {
    it('returns base response when no session activity', () => {
      const result = enrichToolResponse('Tool completed successfully');

      expect(result).toBe('Tool completed successfully');
    });

    it('appends session summary when activity exists', () => {
      trackSessionMemory(createMockNote());

      const result = enrichToolResponse('Tool completed successfully');

      expect(result).toContain('Tool completed successfully');
      expect(result).toContain('memories created');
    });

    it('respects includeSessionSummary flag', () => {
      trackSessionMemory(createMockNote());

      const result = enrichToolResponse('Base response', false);

      expect(result).toBe('Base response');
    });
  });

  describe('findSessionMemoriesByTag', () => {
    beforeEach(() => {
      trackSessionMemory(createMockNote({ id: 'mem-1', topicTags: ['character:sarah', 'plot'] }));
      trackSessionMemory(createMockNote({ id: 'mem-2', topicTags: ['setting', 'location'] }));
      trackSessionMemory(createMockNote({ id: 'mem-3', topicTags: ['character:marcus'] }));
    });

    it('finds memories by tag', () => {
      const result = findSessionMemoriesByTag('character');

      expect(result).toHaveLength(2);
    });

    it('is case-insensitive', () => {
      const result = findSessionMemoriesByTag('CHARACTER');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      const result = findSessionMemoriesByTag('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('matches partial tag names', () => {
      const result = findSessionMemoriesByTag('sarah');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mem-1');
    });
  });

  describe('hasRecentSimilarMemory', () => {
    beforeEach(() => {
      trackSessionMemory(createMockNote({ text: 'Sarah has blue eyes' }));
    });

    it('returns true for very similar text', () => {
      expect(hasRecentSimilarMemory('Sarah has blue eyes')).toBe(true);
    });

    it('returns true for similar text above threshold', () => {
      expect(hasRecentSimilarMemory('Sarah has pretty blue eyes')).toBe(true);
    });

    it('returns false for different text', () => {
      expect(hasRecentSimilarMemory('Marcus lives in Paris')).toBe(false);
    });

    it('respects custom threshold', () => {
      // Very high threshold - should not match
      expect(hasRecentSimilarMemory('Sarah has blue eyes color', 0.99)).toBe(false);

      // Low threshold - should match
      expect(hasRecentSimilarMemory('Sarah eyes blue', 0.3)).toBe(true);
    });

    it('returns false when no session memories', () => {
      clearSessionMemories();
      expect(hasRecentSimilarMemory('Any text')).toBe(false);
    });

    it('handles similar phrases with common words', () => {
      // Similar text should be detected as similar
      clearSessionMemories();
      trackSessionMemory(createMockNote({ text: 'The big cat sat on the mat' }));

      // Very similar text should match
      expect(hasRecentSimilarMemory('The big cat sat on the mat', 0.5)).toBe(true);
      
      // Completely different text should not match
      expect(hasRecentSimilarMemory('The weather is sunny today', 0.5)).toBe(false);
    });
  });
});
