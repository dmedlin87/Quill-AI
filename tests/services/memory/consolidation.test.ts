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
  mergeSimilarMemories,
  archiveStaleMemories,
  reinforceMemory,
  reinforceMemories,
  runConsolidation,
  getMemoryHealthStats,
  archiveOldGoals,
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
    it('recovers from update errors during decay', async () => {
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([
        { id: 'm1', importance: 0.8, createdAt: oneWeekAgo, text: 't', type: 'fact', scope: 'project', projectId: mockProjectId, topicTags: [] }
      ]);
      vi.mocked(updateMemory).mockRejectedValue(new Error('Update Failed'));

      const result = await applyImportanceDecay({ projectId: mockProjectId });
      
      expect(result.decayed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Update Failed');
    });
    it('skips update if importance change is insignificant', async () => {
       const mem = { id: 'm1', importance: 0.8, createdAt: now - (1000 * 60 * 60 * 24), text: 't', type: 'fact', scope: 'project', projectId: mockProjectId, topicTags: [] } as any;
       // 1 day old. Default decay 0.02.
       // New importance = 0.78. Change 0.02 > 0.01.
       
       // Let's create a case where decay is TINY.
       // Age = decayStartDays + 0.1 days.
       // daysOld = floor(0.1) = 0. Decay = 0.
       // diff = 0. Skip.
       
       // Or simpler: importance is already at floor.
       // Or importance change is < 0.01.
       
       // Let's mock decay rate to be super small.
       vi.mocked(getMemoriesForConsolidation).mockResolvedValue([mem]);
       
       const result = await applyImportanceDecay({ projectId: mockProjectId, decayRate: 0.001, decayStartDays: 0 });
       // Age 1 day. daysOld = 1. decay = 0.001. Diff 0.001 < 0.01. 
       
       expect(result.decayed).toBe(0);
       expect(updateMemory).not.toHaveBeenCalled();
    });
  });

  describe('mergeSimilarMemories', () => {
    it('appends text if similarity is high but not almost exact', async () => {
       const mem1 = { id: 'm1', text: 'This is a long memory text about consolidation', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.8 } as any;
       const mem2 = { id: 'm2', text: 'This is a long memory text about consolidation process', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.7 } as any;
       // Similarity should be > mergeThreshold (0.7) but < 0.9
       
       vi.mocked(getMemories).mockResolvedValue([mem1, mem2]);
       vi.mocked(updateMemory).mockResolvedValue(mem1);

       await mergeSimilarMemories({ projectId: mockProjectId, mergeThreshold: 0.7 });

       const updateCall = vi.mocked(updateMemory).mock.calls[0];
       const updatedText = updateCall[1].text;
       expect(updatedText).toContain('[Merged:');
    });
    
    it('skips merge if tags do not overlap significantly', async () => {
       const mem1 = { id: 'm1', text: 'Same text', type: 'fact', projectId: mockProjectId, topicTags: ['tag1', 'tag2'], importance: 0.8 } as any;
       const mem2 = { id: 'm2', text: 'Same text', type: 'fact', projectId: mockProjectId, topicTags: ['tag9', 'tag8'], importance: 0.8 } as any;
       // Disjoint tags -> no candidate due to tag index or overlap check
       
       vi.mocked(getMemories).mockResolvedValue([mem1, mem2]);
       
       const result = await mergeSimilarMemories({ projectId: mockProjectId });
       expect(result.merged).toBe(0);
    });

    it('handles empty text gracefully (100% similarity)', async () => {
       const mem1 = { id: 'm1', text: '', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.8 } as any;
       const mem2 = { id: 'm2', text: '', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.7 } as any;
       
       vi.mocked(getMemories).mockResolvedValue([mem1, mem2]);
       vi.mocked(updateMemory).mockResolvedValue(mem1);
       
       const result = await mergeSimilarMemories({ projectId: mockProjectId });
       expect(result.merged).toBe(1);
    });
    
    // ... existing merge tests ...

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

      const result = await mergeSimilarMemories({ 
        projectId: mockProjectId,
        mergeThreshold: 0.6,
      });

      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(result.errors).toHaveLength(0);
    });

    it('handles database errors gracefully during merge', async () => {
        const memory1 = {
          id: 'mem-1',
          text: 'Shared text',
          type: 'observation' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['tag'],
          importance: 0.8,
          createdAt: now,
        };
        const memory2 = {
          id: 'mem-2',
          text: 'Shared text',
          type: 'observation' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['tag'],
          importance: 0.6,
          createdAt: now,
        };
  
        vi.mocked(getMemories).mockResolvedValue([memory1, memory2]);
        vi.mocked(updateMemory).mockRejectedValue(new Error('DB Error'));
  
        const result = await mergeSimilarMemories({ projectId: mockProjectId });
  
        expect(result.merged).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('DB Error');
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

      const result = await mergeSimilarMemories({ projectId: mockProjectId });

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

      const result = await mergeSimilarMemories({
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

    it('handles delete errors gracefully', async () => {
      vi.mocked(getMemoriesForConsolidation).mockResolvedValue([
        { id: 'm1', importance: 0.05, createdAt: oneWeekAgo, text: 't', type: 'fact', scope: 'project', projectId: mockProjectId, topicTags: [] }
      ]);
      vi.mocked(deleteMemory).mockRejectedValue(new Error('Delete Fail'));

      const result = await archiveStaleMemories({ projectId: mockProjectId });
      
      expect(result.archived).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Jaccard Similarity Edge Cases (via merge)', () => {
    it('handles one empty text (0 similarity)', async () => {
       const mem1 = { id: 'm1', text: '', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.8 } as any;
       const mem2 = { id: 'm2', text: 'Full text', type: 'fact', projectId: mockProjectId, topicTags: ['tag'], importance: 0.7 } as any;
       
       vi.mocked(getMemories).mockResolvedValue([mem1, mem2]);
       
       const result = await mergeSimilarMemories({ projectId: mockProjectId, mergeThreshold: 0.1 });
       expect(result.merged).toBe(0); // Similarity 0 < 0.1
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
    it('handles database errors gracefully', async () => {
      vi.mocked(db.memories.get).mockRejectedValue(new Error('DB Fail'));
      const success = await reinforceMemory({ memoryId: 'm1', reason: 'manual' });
      expect(success).toBe(false);
    });
  });

  describe('reinforceMemories', () => {
    it('reinforces multiple memories', async () => {
      const memory = { id: 'mem-1', importance: 0.5 };
      vi.mocked(db.memories.get).mockResolvedValue(memory as any);
      vi.mocked(updateMemory).mockResolvedValue(memory as any);

      const result = await reinforceMemories([
        { memoryId: 'mem-1', reason: 'searched' },
        { memoryId: 'mem-2', reason: 'suggested' },
      ]);

      expect(result.reinforced).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('counts failures correctly', async () => {
       // Mock first success, second failure (undefined memory)
       vi.mocked(db.memories.get)
         .mockResolvedValueOnce({ id: 'm1', importance: 0.5 } as any)
         .mockResolvedValueOnce(undefined);
       vi.mocked(updateMemory).mockResolvedValue({} as any);

       const result = await reinforceMemories([
         { memoryId: 'm1', reason: 'manual' },
         { memoryId: 'm2', reason: 'manual' }
       ]);
       
       expect(result.reinforced).toBe(1);
       expect(result.failed).toBe(1);
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

  describe('archiveOldGoals', () => {
    it('archives completed or abandoned goals older than threshold', async () => {
      const oldDate = now - (31 * 24 * 60 * 60 * 1000); // 31 days ago
      const recentDate = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      const goals = [
        { id: 'g1', status: 'completed', createdAt: oldDate, projectId: mockProjectId }, // Should archive
        { id: 'g2', status: 'abandoned', createdAt: oldDate, projectId: mockProjectId }, // Should archive
        { id: 'g3', status: 'active', createdAt: oldDate, projectId: mockProjectId },    // Should keep (active)
        { id: 'g4', status: 'completed', createdAt: recentDate, projectId: mockProjectId }, // Should keep (recent)
      ];

      // Mock chain: where -> equals -> filter -> toArray
      const mockFilter = vi.fn().mockImplementation((predicate) => {
        const filtered = goals.filter(predicate);
        return {
          toArray: vi.fn().mockResolvedValue(filtered)
        };
      });

      vi.mocked(db.goals.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: mockFilter
        })
      } as any);

      const result = await archiveOldGoals(mockProjectId, { maxAgeDays: 30 });

      expect(result.archived).toBe(2);
      expect(db.goals.bulkDelete).toHaveBeenCalledWith(['g1', 'g2']);
    });

    it('respects dryRun mode', async () => {
        const oldDate = now - (31 * 24 * 60 * 60 * 1000);
        const goals = [{ id: 'g1', status: 'completed', createdAt: oldDate, projectId: mockProjectId }];
        
        // Setup mock to return this goal
        vi.mocked(db.goals.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({
              filter: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue(goals)
              })
            })
        } as any);

        const result = await archiveOldGoals(mockProjectId, { maxAgeDays: 30, dryRun: true });

        expect(result.archived).toBe(1);
        expect(db.goals.bulkDelete).not.toHaveBeenCalled();
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

    it('handles empty memory set gracefully', async () => {
        vi.mocked(countProjectMemories).mockResolvedValue(0);
        vi.mocked(getMemories).mockResolvedValue([]);
        vi.mocked(db.goals.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([])
            })
        } as any);

        const stats = await getMemoryHealthStats(mockProjectId);
        
        expect(stats.totalMemories).toBe(0);
        expect(stats.avgImportance).toBe(0);
        expect(stats.oldMemoriesCount).toBe(0);
    });

    it('extrapolates stats from sample for large datasets', async () => {
        vi.mocked(countProjectMemories).mockResolvedValue(1000); // Total
        // Sample says: 50 items returned (5% sample). 
        // 10 are low importance. 5 are old.
        // Expect extrapolation: low = 200, old = 100.
        
        const sampleMemories = Array.from({ length: 50 }, (_, i) => ({
            id: `mem-${i}`,
            importance: i < 10 ? 0.1 : 0.8, // 10 low importance
            createdAt: i < 5 ? (now - 100 * 24 * 3600 * 1000) : now, // 5 old
            text: 'sample',
            type: 'observation',
            scope: 'project',
            topicTags: [],
            projectId: mockProjectId
        }));

        vi.mocked(getMemories).mockResolvedValue(sampleMemories as any);
        vi.mocked(db.goals.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
        } as any);

        const stats = await getMemoryHealthStats(mockProjectId);
        
        expect(stats.totalMemories).toBe(1000);
        // Sample ratio = 1000 / 50 = 20
        // Low: 10 * 20 = 200
        expect(stats.lowImportanceCount).toBe(200);
        // Old: 5 * 20 = 100
        expect(stats.oldMemoriesCount).toBe(100);
    });
  });
});
