import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeMemoryTool,
  isMemoryTool,
  withMemoryTools,
  getMemoryToolNames,
} from '@/services/gemini/memoryToolHandlers';
import {
  createMemory,
  getMemories,
  updateMemory,
  deleteMemory,
  addGoal,
  updateGoal,
  addWatchedEntity,
} from '@/services/memory';
import {
  hasRecentSimilarMemory,
  trackSessionMemory,
  getSessionMemorySummary,
  getSessionMemoryCount,
} from '@/services/memory/sessionTracker';

// Mock dependencies
vi.mock('@/services/memory', () => ({
  createMemory: vi.fn(),
  getMemories: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  addWatchedEntity: vi.fn(),
}));

vi.mock('@/services/memory/sessionTracker', () => ({
  trackSessionMemory: vi.fn(),
  trackSessionMemoryUpdate: vi.fn(),
  trackSessionMemoryDelete: vi.fn(),
  trackSessionGoal: vi.fn(),
  hasRecentSimilarMemory: vi.fn(),
  getSessionMemoryCount: vi.fn(),
  getSessionMemorySummary: vi.fn(),
}));

describe('MemoryToolHandlers', () => {
  const context = { projectId: 'p1' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionMemorySummary).mockReturnValue('Session Summary');
    vi.mocked(getSessionMemoryCount).mockReturnValue(1);
  });

  describe('formatWithSessionSummary', () => {
      // Need to test the case where summary is empty
      it('returns original message if no summary', async () => {
          vi.mocked(getSessionMemorySummary).mockReturnValue('');
          vi.mocked(createMemory).mockResolvedValue({ id: 'm1' } as any);
          vi.mocked(hasRecentSimilarMemory).mockReturnValue(false);

          const result = await executeMemoryTool(
            'write_memory_note',
            { text: 'test', type: 'fact', scope: 'project' },
            context,
          );

          expect(result).not.toContain('Session summary');
          expect(result).toContain('Memory saved');
      });
  });

  describe('write_memory_note', () => {
    it('creates memory and tracks session', async () => {
      vi.mocked(createMemory).mockResolvedValue({ id: 'm1' } as any);
      vi.mocked(hasRecentSimilarMemory).mockReturnValue(false);

      const result = await executeMemoryTool(
        'write_memory_note',
        { text: 'test', type: 'fact', scope: 'project' },
        context,
      );

      expect(createMemory).toHaveBeenCalledWith({
        text: 'test',
        type: 'fact',
        scope: 'project',
        projectId: 'p1',
        topicTags: [],
        importance: 0.5,
      });
      expect(trackSessionMemory).toHaveBeenCalled();
      expect(result).toContain('Memory saved');
      expect(result).toContain('Session Summary');
    });

    it('shows session count note if > 1', async () => {
        vi.mocked(getSessionMemoryCount).mockReturnValue(2);
        vi.mocked(createMemory).mockResolvedValue({ id: 'm2' } as any);
        const result = await executeMemoryTool('write_memory_note', { text: 't', type: 'fact', scope: 'project' }, context);
        expect(result).toContain('(2 memories saved this session)');
    });

    it('returns error on missing fields', async () => {
      const result = await executeMemoryTool('write_memory_note', {}, context);
      expect(result).toContain('Error: Missing required fields');
    });

    it('detects duplicates', async () => {
      vi.mocked(hasRecentSimilarMemory).mockReturnValue(true);
      const result = await executeMemoryTool(
        'write_memory_note',
        { text: 'dup', type: 'fact', scope: 'project' },
        context,
      );
      expect(result).toContain('Skipped to avoid duplication');
      expect(createMemory).not.toHaveBeenCalled();
    });

    it('handles creation error', async () => {
        vi.mocked(hasRecentSimilarMemory).mockReturnValue(false);
        vi.mocked(createMemory).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool(
            'write_memory_note',
            { text: 'test', type: 'fact', scope: 'project' },
            context
        );
        expect(result).toContain('Error saving memory: fail');
    });
  });

  describe('search_memory', () => {
    it('searches project and author memories by default (scope undefined)', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        { id: 'm1', text: 'found', type: 'fact', scope: 'project', importance: 1, topicTags: [], createdAt: 0 } as any,
      ]);

      // When scope is not provided, it searches both scopes and merges results.
      // Since our mock returns the same array for both calls, we get 2 items.
      const result = await executeMemoryTool('search_memory', { tags: ['foo'] }, context);

      expect(getMemories).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', topicTags: ['foo'] }));
      expect(result).toContain('Found 2 memories');
      expect(result).toContain('found');
    });

    it('searches project memories explicitly', async () => {
        vi.mocked(getMemories).mockResolvedValue([
            { id: 'm1', text: 'found', type: 'fact', scope: 'project', importance: 1, topicTags: [], createdAt: 0 } as any,
        ]);

        const result = await executeMemoryTool('search_memory', { tags: ['foo'], scope: 'project' }, context);

        expect(getMemories).toHaveBeenCalledTimes(1);
        expect(result).toContain('Found 1 memories');
    });

    it('searches all scopes', async () => {
      vi.mocked(getMemories).mockResolvedValueOnce([]); // author
      vi.mocked(getMemories).mockResolvedValueOnce([]); // project

      await executeMemoryTool('search_memory', { scope: 'all' }, context);

      expect(getMemories).toHaveBeenCalledTimes(2);
    });

    it('searches author scope', async () => {
        vi.mocked(getMemories).mockResolvedValueOnce([]);
        await executeMemoryTool('search_memory', { scope: 'author' }, context);
        expect(getMemories).toHaveBeenCalledWith(expect.objectContaining({ scope: 'author' }));
    });

    it('returns message when no results found', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);
      const result = await executeMemoryTool('search_memory', { scope: 'project' }, context);
      expect(result).toContain('No memories found');
    });

    it('handles search error', async () => {
        vi.mocked(getMemories).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('search_memory', {}, context);
        expect(result).toContain('Error searching memories: fail');
    });
  });

  describe('update_memory_note', () => {
    it('updates memory and returns summary', async () => {
      vi.mocked(updateMemory).mockResolvedValue({ id: 'm1' } as any);

      const result = await executeMemoryTool(
        'update_memory_note',
        { id: 'm1', text: 'new text' },
        context,
      );

      expect(updateMemory).toHaveBeenCalledWith('m1', { text: 'new text' });
      expect(result).toContain('Memory updated');
    });

    it('returns error if id missing', async () => {
      const result = await executeMemoryTool('update_memory_note', { text: 'no id' }, context);
      expect(result).toContain('Error: Memory ID is required');
    });

    it('returns error if no updates provided', async () => {
        const result = await executeMemoryTool('update_memory_note', { id: 'm1' }, context);
        expect(result).toContain('No updates provided');
    });

    it('returns message if memory not found', async () => {
        vi.mocked(updateMemory).mockResolvedValue(null);
        const result = await executeMemoryTool('update_memory_note', { id: 'm1', text: 'new' }, context);
        expect(result).toContain('not found');
    });

    it('handles update error', async () => {
        vi.mocked(updateMemory).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('update_memory_note', { id: 'm1', text: 'new' }, context);
        expect(result).toContain('Error updating memory: fail');
    });
  });

  describe('delete_memory_note', () => {
    it('deletes memory and returns summary', async () => {
      const result = await executeMemoryTool('delete_memory_note', { id: 'm1' }, context);
      expect(deleteMemory).toHaveBeenCalledWith('m1');
      expect(result).toContain('Memory deleted');
    });

    it('returns error if id missing', async () => {
      const result = await executeMemoryTool('delete_memory_note', {}, context);
      expect(result).toContain('Error: Memory ID is required');
    });

    it('handles delete error', async () => {
        vi.mocked(deleteMemory).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('delete_memory_note', { id: 'm1' }, context);
        expect(result).toContain('Error deleting memory: fail');
    });
  });

  describe('create_goal', () => {
    it('creates goal', async () => {
      vi.mocked(addGoal).mockResolvedValue({ id: 'g1' } as any);
      const result = await executeMemoryTool('create_goal', { title: 'Win' }, context);
      expect(addGoal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Win', projectId: 'p1' }));
      expect(result).toContain('Goal created');
    });

    it('returns error if title missing', async () => {
      const result = await executeMemoryTool('create_goal', {}, context);
      expect(result).toContain('Error: Goal title is required');
    });

    it('handles create goal error', async () => {
        vi.mocked(addGoal).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('create_goal', { title: 'Win' }, context);
        expect(result).toContain('Error creating goal: fail');
    });
  });

  describe('update_goal', () => {
    it('updates goal', async () => {
      vi.mocked(updateGoal).mockResolvedValue({ id: 'g1', status: 'completed', progress: 100 } as any);
      const result = await executeMemoryTool('update_goal', { id: 'g1', status: 'completed' }, context);
      expect(updateGoal).toHaveBeenCalledWith('g1', { status: 'completed' });
      expect(result).toContain('Goal updated');
    });

    it('returns error if id missing', async () => {
        const result = await executeMemoryTool('update_goal', { status: 'completed' }, context);
        expect(result).toContain('Error: Goal ID is required');
    });

    it('returns error if no updates', async () => {
        const result = await executeMemoryTool('update_goal', { id: 'g1' }, context);
        expect(result).toContain('No updates provided');
    });

    it('returns message if goal not found', async () => {
        vi.mocked(updateGoal).mockResolvedValue(null);
        const result = await executeMemoryTool('update_goal', { id: 'g1', status: 'completed' }, context);
        expect(result).toContain('not found');
    });

    it('handles update goal error', async () => {
        vi.mocked(updateGoal).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('update_goal', { id: 'g1', status: 'completed' }, context);
        expect(result).toContain('Error updating goal: fail');
    });
  });

  describe('watch_entity', () => {
    it('adds watched entity', async () => {
      vi.mocked(addWatchedEntity).mockResolvedValue({ id: 'e1', priority: 'medium' } as any);
      const result = await executeMemoryTool('watch_entity', { name: 'Bob' }, context);
      expect(addWatchedEntity).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob', projectId: 'p1' }));
      expect(result).toContain('Now watching');
    });

    it('returns error if name missing', async () => {
      const result = await executeMemoryTool('watch_entity', {}, context);
      expect(result).toContain('Error: Entity name is required');
    });

    it('handles watch entity error', async () => {
        vi.mocked(addWatchedEntity).mockRejectedValue(new Error('fail'));
        const result = await executeMemoryTool('watch_entity', { name: 'Bob' }, context);
        expect(result).toContain('Error adding to watchlist: fail');
    });
  });

  describe('Helpers', () => {
    it('isMemoryTool returns true for memory tools', () => {
      expect(isMemoryTool('write_memory_note')).toBe(true);
      expect(isMemoryTool('other')).toBe(false);
    });

    it('getMemoryToolNames returns list', () => {
      expect(getMemoryToolNames()).toContain('write_memory_note');
    });

    it('executeMemoryTool returns null for unknown tool', async () => {
      const result = await executeMemoryTool('unknown', {}, context);
      expect(result).toBeNull();
    });
  });

  describe('withMemoryTools', () => {
    const existing = vi.fn(async () => 'existing');
    const getProject = vi.fn(() => 'p1');
    const wrapper = withMemoryTools(existing, getProject);

    it('delegates to existing handler for non-memory tools', async () => {
      const result = await wrapper('other', {});
      expect(result).toBe('existing');
      expect(existing).toHaveBeenCalled();
    });

    it('intercepts memory tools', async () => {
      vi.mocked(createMemory).mockResolvedValue({ id: 'm1' } as any);
      vi.mocked(hasRecentSimilarMemory).mockReturnValue(false);
      const result = await wrapper('write_memory_note', { text: 't', type: 'fact', scope: 'project' });
      expect(result).toContain('Memory saved');
      expect(existing).not.toHaveBeenCalled();
    });

    it('returns error if project missing for memory tool', async () => {
      getProject.mockReturnValue(null);
      const result = await wrapper('write_memory_note', {});
      expect(result).toContain('Error: No project loaded');
    });
  });
});
