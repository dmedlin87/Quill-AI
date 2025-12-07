import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMemories,
  getMemoriesForConsolidation,
  countProjectMemories,
  getMemory,
  getMemoriesForContext,
  searchMemoriesByTags,
} from '@/services/memory/memoryQueries';
import type { MemoryNote } from '@/services/memory/types';

// Mock db
vi.mock('@/services/db', () => ({
  db: {
    memories: {
      get: vi.fn(),
      where: vi.fn(),
      toCollection: vi.fn(),
    },
  },
}));

import { db } from '@/services/db';

const createMockNote = (overrides?: Partial<MemoryNote>): MemoryNote => ({
  id: 'mem-1',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Test memory',
  type: 'fact',
  topicTags: ['test'],
  importance: 0.7,
  createdAt: Date.now(),
  ...overrides,
});

describe('memoryQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMemories', () => {
    it('returns all memories when no filters', async () => {
      const mockNotes = [
        createMockNote({ id: 'n1', importance: 0.5 }),
        createMockNote({ id: 'n2', importance: 0.8 }),
      ];

      const mockCollection = {
        filter: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      const result = await getMemories();

      expect(result).toHaveLength(2);
      // Should be sorted by importance desc
      expect(result[0].importance).toBe(0.8);
    });

    it('filters by scope', async () => {
      const mockNotes = [createMockNote({ scope: 'author' })];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemories({ scope: 'author' });

      expect(db.memories.where).toHaveBeenCalledWith('scope');
      expect(result).toHaveLength(1);
    });

    it('filters by scope and projectId together', async () => {
      const mockNotes = [createMockNote()];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      await getMemories({ scope: 'project', projectId: 'proj-1' });

      expect(db.memories.where).toHaveBeenCalledWith('[scope+projectId]');
    });

    it('filters by type', async () => {
      const mockNotes = [
        createMockNote({ type: 'fact' }),
        createMockNote({ type: 'observation' }),
      ];

      const mockCollection = {
        filter: vi.fn().mockImplementation((fn) => ({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockNotes.filter(fn)),
        })),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      const result = await getMemories({ type: 'fact' });

      expect(mockCollection.filter).toHaveBeenCalled();
    });

    it('filters by minImportance', async () => {
      const mockNotes = [
        createMockNote({ importance: 0.3 }),
        createMockNote({ importance: 0.8 }),
      ];

      const mockCollection = {
        filter: vi.fn().mockImplementation((fn) => ({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockNotes.filter(fn)),
        })),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      await getMemories({ minImportance: 0.5 });

      expect(mockCollection.filter).toHaveBeenCalled();
    });

    it('filters by topicTags (all must match)', async () => {
      const mockNotes = [
        createMockNote({ topicTags: ['character', 'sarah'] }),
        createMockNote({ topicTags: ['character'] }),
      ];

      const mockCollection = {
        filter: vi.fn().mockImplementation((fn) => ({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockNotes.filter(fn)),
        })),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      await getMemories({ topicTags: ['character', 'sarah'] });

      expect(mockCollection.filter).toHaveBeenCalled();
    });

    it('respects limit', async () => {
      const mockNotes = Array.from({ length: 10 }, (_, i) =>
        createMockNote({ id: `n${i}` })
      );

      const mockCollection = {
        filter: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      const result = await getMemories({ limit: 3 });

      expect(result).toHaveLength(3);
    });

    it('sorts by importance then recency', async () => {
      const mockNotes = [
        createMockNote({ id: 'n1', importance: 0.5, createdAt: 3000 }),
        createMockNote({ id: 'n2', importance: 0.8, createdAt: 1000 }),
        createMockNote({ id: 'n3', importance: 0.8, createdAt: 2000 }),
      ];

      const mockCollection = {
        filter: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockNotes),
      };
      vi.mocked(db.memories.toCollection).mockReturnValue(mockCollection as any);

      const result = await getMemories();

      expect(result[0].id).toBe('n3'); // Higher importance, more recent
      expect(result[1].id).toBe('n2'); // Higher importance, older
      expect(result[2].id).toBe('n1'); // Lower importance
    });

    it('handles array-like data source', async () => {
      const mockNotes = [createMockNote()];

      // Simulate array-like behavior
      (db as any).memories = mockNotes;

      const result = await getMemories();

      expect(result).toHaveLength(1);

      // Reset
      (db as any).memories = {
        get: vi.fn(),
        where: vi.fn(),
        toCollection: vi.fn(),
      };
    });
  });

  describe('getMemoriesForConsolidation', () => {
    it('returns memories sorted oldest first', async () => {
      const mockNotes = [
        createMockNote({ id: 'n1', createdAt: 3000 }),
        createMockNote({ id: 'n2', createdAt: 1000 }),
        createMockNote({ id: 'n3', createdAt: 2000 }),
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForConsolidation('proj-1');

      expect(result[0].createdAt).toBe(1000);
      expect(result[2].createdAt).toBe(3000);
    });

    it('filters by maxImportance', async () => {
      const mockNotes = [
        createMockNote({ importance: 0.3 }),
        createMockNote({ importance: 0.9 }),
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForConsolidation('proj-1', { maxImportance: 0.5 });

      expect(result.every((m) => m.importance <= 0.5)).toBe(true);
    });

    it('filters by minAge', async () => {
      const now = Date.now();
      const mockNotes = [
        createMockNote({ createdAt: now - 1000 }), // 1 second old
        createMockNote({ createdAt: now - 100000 }), // 100 seconds old
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForConsolidation('proj-1', { minAge: 50000 });

      expect(result).toHaveLength(1);
    });

    it('supports offset and limit for pagination', async () => {
      const mockNotes = Array.from({ length: 10 }, (_, i) =>
        createMockNote({ id: `n${i}`, createdAt: i * 1000 })
      );

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForConsolidation('proj-1', { offset: 3, limit: 2 });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('n3');
    });
  });

  describe('countProjectMemories', () => {
    it('returns count of project memories', async () => {
      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(42),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const count = await countProjectMemories('proj-1');

      expect(count).toBe(42);
    });
  });

  describe('getMemory', () => {
    it('returns memory by id', async () => {
      const mockNote = createMockNote({ id: 'mem-123' });
      vi.mocked(db.memories.get).mockResolvedValue(mockNote);

      const result = await getMemory('mem-123');

      expect(result).toEqual(mockNote);
      expect(db.memories.get).toHaveBeenCalledWith('mem-123');
    });

    it('returns undefined for non-existent id', async () => {
      vi.mocked(db.memories.get).mockResolvedValue(undefined);

      const result = await getMemory('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getMemoriesForContext', () => {
    it('returns both author and project memories', async () => {
      const authorNotes = [createMockNote({ scope: 'author', id: 'author-1' })];
      const projectNotes = [createMockNote({ scope: 'project', id: 'proj-1' })];

      const mockWhere = {
        equals: vi.fn().mockImplementation((args) => ({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(
            args[0] === 'author' ? authorNotes : projectNotes
          ),
        })),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForContext('proj-1');

      expect(result.author).toBeDefined();
      expect(result.project).toBeDefined();
    });

    it('respects limit option', async () => {
      const notes = Array.from({ length: 100 }, (_, i) => createMockNote({ id: `n${i}` }));

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(notes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await getMemoriesForContext('proj-1', { limit: 10 });

      expect(result.author.length).toBeLessThanOrEqual(10);
      expect(result.project.length).toBeLessThanOrEqual(10);
    });
  });

  describe('searchMemoriesByTags', () => {
    it('returns memories matching any of the tags', async () => {
      const mockNotes = [
        createMockNote({ id: 'n1', topicTags: ['character'] }),
        createMockNote({ id: 'n2', topicTags: ['setting'] }),
      ];

      const mockWhere = {
        equals: vi.fn().mockImplementation((tag) => ({
          toArray: vi.fn().mockResolvedValue(
            mockNotes.filter((n) => n.topicTags.includes(tag))
          ),
        })),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await searchMemoriesByTags(['character', 'setting']);

      expect(result.length).toBeGreaterThan(0);
    });

    it('filters by projectId when provided', async () => {
      const mockNotes = [
        createMockNote({ id: 'n1', projectId: 'proj-1', topicTags: ['tag'] }),
        createMockNote({ id: 'n2', projectId: 'proj-2', topicTags: ['tag'] }),
      ];

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await searchMemoriesByTags(['tag'], { projectId: 'proj-1' });

      expect(result.every((n) => n.projectId === 'proj-1' || n.scope !== 'project')).toBe(true);
    });

    it('deduplicates results when note matches multiple tags', async () => {
      const mockNote = createMockNote({ id: 'n1', topicTags: ['tag1', 'tag2'] });

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([mockNote]),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await searchMemoriesByTags(['tag1', 'tag2']);

      expect(result).toHaveLength(1);
    });

    it('respects limit option', async () => {
      const mockNotes = Array.from({ length: 50 }, (_, i) =>
        createMockNote({ id: `n${i}`, topicTags: ['tag'] })
      );

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockNotes),
        }),
      };
      vi.mocked(db.memories.where).mockReturnValue(mockWhere as any);

      const result = await searchMemoriesByTags(['tag'], { limit: 5 });

      expect(result).toHaveLength(5);
    });
  });
});
