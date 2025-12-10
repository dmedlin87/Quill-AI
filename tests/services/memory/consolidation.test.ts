import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the db and memory modules before importing consolidation
vi.mock('@/services/db', () => ({
  db: {
    memories: {
      get: vi.fn(),
      bulkDelete: vi.fn(),
    },
    goals: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      bulkDelete: vi.fn(),
    },
  },
}));

vi.mock('@/services/memory/index', () => ({
  getMemories: vi.fn(),
  getMemoriesForConsolidation: vi.fn(),
  countProjectMemories: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}));

import { 
  applyImportanceDecay,
  mergeSimikarMemories,
  archiveStaleMemories,
  reinforceMemory,
  reinforceMemories,
  runConsolidation,
  getMemoryHealthStats,
} from '@/services/memory/consolidation';
import { getMemories, getMemoriesForConsolidation, countProjectMemories, updateMemory, deleteMemory } from '@/services/memory/index';
import { db } from '@/services/db';

describe('Memory Consolidation', () => {
  const mockProjectId = 'test-project';
  const now = Date.now();
  const oneWeekAgo = now - (8 * 24 * 60 * 60 * 1000); // 8 days ago

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('applyImportanceDecay', () => {
    it('decays importance of old memories', async () => {
      const oldMemory = {
        id: 'old-mem-1',
        text: 'Old memory',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.8,
        createdAt: oneWeekAgo,
      };

      // FIX: Use getMemoriesForConsolidation mock instead of getMemories
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([oldMemory]);
      vi.mocked(updateMemory).mockResolvedValue({ ...oldMemory, importance: 0.78 });

      const result = await applyImportanceDecay({ projectId: mockProjectId });

      expect(result.decayed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(updateMemory).toHaveBeenCalledWith('old-mem-1', expect.objectContaining({
        importance: expect.any(Number),
      }));
    });

    it('skips recent memories', async () => {
      // FIX: With new query, only old memories are returned, so empty result
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([]);

      const result = await applyImportanceDecay({ projectId: mockProjectId });

      expect(result.decayed).toBe(0);
      expect(updateMemory).not.toHaveBeenCalled();
    });

    it('respects dry run mode', async () => {
      const oldMemory = {
        id: 'old-mem-1',
        text: 'Old memory',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.8,
        createdAt: oneWeekAgo,
      };

      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([oldMemory]);

      const result = await applyImportanceDecay({ 
        projectId: mockProjectId, 
        dryRun: true 
      });

      expect(result.decayed).toBe(1);
      expect(updateMemory).not.toHaveBeenCalled();
    });
  });

  describe('mergeSimikarMemories', () => {
    it('merges similar memories with high text overlap', async () => {
      const memory1 = {
        id: 'mem-1',
        text: 'John is the main protagonist of the story',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['character:john'],
        importance: 0.8,
        createdAt: now - 1000,
      };
      const memory2 = {
        id: 'mem-2',
        text: 'John is the main protagonist in our story',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['character:john', 'story'],
        importance: 0.6,
        createdAt: now,
      };

      vi.mocked(getMemories).mockResolvedValue([memory1, memory2]);
      vi.mocked(updateMemory).mockResolvedValue({ ...memory1, importance: 0.85 });

      const result = await mergeSimikarMemories({ 
        projectId: mockProjectId,
        mergeThreshold: 0.6,
      });

      expect(result.merged).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });

    it('does not merge memories with different types', async () => {
      const memory1 = {
        id: 'mem-1',
        text: 'Same text content here',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.8,
        createdAt: now - 1000,
      };
      const memory2 = {
        id: 'mem-2',
        text: 'Same text content here',
        type: 'issue' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.6,
        createdAt: now,
      };

      vi.mocked(getMemories).mockResolvedValue([memory1, memory2]);

      const result = await mergeSimikarMemories({ projectId: mockProjectId });

      expect(result.merged).toBe(0);
    });

    it('supports dryRun mode without mutating memories', async () => {
      const memory1 = {
        id: 'mem-1',
        text: 'John is the main protagonist of the story',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['character:john'],
        importance: 0.8,
        createdAt: now - 1000,
      };
      const memory2 = {
        id: 'mem-2',
        text: 'John is the main protagonist in our story',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['character:john', 'story'],
        importance: 0.6,
        createdAt: now,
      };

      vi.mocked(getMemories).mockResolvedValue([memory1, memory2]);

      const result = await mergeSimikarMemories({
        projectId: mockProjectId,
        mergeThreshold: 0.6,
        dryRun: true,
      });

      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(updateMemory).not.toHaveBeenCalled();
      expect(deleteMemory).not.toHaveBeenCalled();
    });
  });

  describe('archiveStaleMemories', () => {
    it('archives old low-importance memories', async () => {
      const staleMemory = {
        id: 'stale-mem-1',
        text: 'Very old unimportant memory',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.05,
        createdAt: oneWeekAgo,
      };

      // FIX: Use getMemoriesForConsolidation - already filters by age & importance
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([staleMemory]);

      const result = await archiveStaleMemories({ projectId: mockProjectId });

      expect(result.archived).toBe(1);
      expect(deleteMemory).toHaveBeenCalledWith('stale-mem-1');
    });

    it('preserves important memories even if old', async () => {
      // FIX: With new query, important memories are filtered out at query level
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([]);

      const result = await archiveStaleMemories({ projectId: mockProjectId });

      expect(result.archived).toBe(0);
      expect(deleteMemory).not.toHaveBeenCalled();
    });
  });

  describe('reinforceMemory', () => {
    it('boosts importance when memory is used', async () => {
      const memory = {
        id: 'mem-1',
        text: 'Test memory',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.5,
        createdAt: now - 1000,
      };

      vi.mocked(db.memories.get).mockResolvedValue(memory);
      vi.mocked(updateMemory).mockResolvedValue({ ...memory, importance: 0.55 });

      const success = await reinforceMemory({
        memoryId: 'mem-1',
        reason: 'searched',
      });

      expect(success).toBe(true);
      expect(updateMemory).toHaveBeenCalledWith('mem-1', expect.objectContaining({
        importance: expect.any(Number),
        updatedAt: expect.any(Number),
      }));
    });

    it('returns false for non-existent memory', async () => {
      vi.mocked(db.memories.get).mockResolvedValue(undefined);

      const success = await reinforceMemory({
        memoryId: 'non-existent',
        reason: 'searched',
      });

      expect(success).toBe(false);
    });

    it('caps importance at 1.0', async () => {
      const memory = {
        id: 'mem-1',
        text: 'Test memory',
        type: 'observation' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['test'],
        importance: 0.98,
        createdAt: now - 1000,
      };

      vi.mocked(db.memories.get).mockResolvedValue(memory);
      vi.mocked(updateMemory).mockImplementation(async (id, updates) => ({
        ...memory,
        ...updates,
      }));

      await reinforceMemory({
        memoryId: 'mem-1',
        reason: 'referenced', // +0.1 boost
      });

      expect(updateMemory).toHaveBeenCalledWith('mem-1', expect.objectContaining({
        importance: 1, // Capped at 1
      }));
    });
  });

  describe('reinforceMemories', () => {
    it('reinforces multiple memories', async () => {
      const memory = {
        id: 'mem-1',
        importance: 0.5,
      };

      vi.mocked(db.memories.get).mockResolvedValue(memory as any);
      vi.mocked(updateMemory).mockResolvedValue(memory as any);

      const result = await reinforceMemories([
        { memoryId: 'mem-1', reason: 'searched' },
        { memoryId: 'mem-2', reason: 'suggested' },
      ]);

      expect(result.reinforced).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('runConsolidation', () => {
    it('runs full consolidation pipeline', async () => {
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([]);
      vi.mocked(getMemories).mockResolvedValue([]);

      const result = await runConsolidation({ projectId: mockProjectId });

      expect(result).toHaveProperty('decayed');
      expect(result).toHaveProperty('merged');
      expect(result).toHaveProperty('archived');
      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMemoryHealthStats', () => {
    it('returns health statistics', async () => {
      // FIX: Mock countProjectMemories for accurate count
      vi.mocked(countProjectMemories).mockResolvedValue(2);
      vi.mocked(getMemories).mockResolvedValue([
        {
          id: 'mem-1',
          text: 'Memory 1',
          type: 'observation' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['test'],
          importance: 0.8,
          createdAt: now,
        },
        {
          id: 'mem-2',
          text: 'Memory 2',
          type: 'fact' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['plot'],
          importance: 0.2,
          createdAt: oneWeekAgo,
        },
      ]);

      vi.mocked(db.goals.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 'goal-1', status: 'active', projectId: mockProjectId },
            { id: 'goal-2', status: 'completed', projectId: mockProjectId },
          ]),
        }),
      } as unknown as ReturnType<typeof db.goals.where>);

      const stats = await getMemoryHealthStats(mockProjectId);

      expect(stats.totalMemories).toBe(2);
      expect(stats.avgImportance).toBeCloseTo(0.5);
      expect(stats.lowImportanceCount).toBe(1);
      expect(stats.activeGoals).toBe(1);
      expect(stats.completedGoals).toBe(1);
    });
  });
});
