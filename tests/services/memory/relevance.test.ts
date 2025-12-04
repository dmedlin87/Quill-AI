import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryNote } from '@/services/memory/types';

// Mock the db before importing memory module
vi.mock('@/services/db', () => ({
  db: {
    memories: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      toCollection: vi.fn().mockReturnThis(),
    },
    goals: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { getRelevantMemoriesForContext, getMemories } from '@/services/memory';
import { db } from '@/services/db';

describe('getRelevantMemoriesForContext', () => {
  const now = Date.now();
  
  const baseMemory: Omit<MemoryNote, 'id' | 'text' | 'topicTags'> = {
    scope: 'project',
    projectId: 'proj1',
    type: 'fact',
    importance: 0.5,
    createdAt: now,
  };

  const authorMemory: MemoryNote = {
    id: 'author1',
    scope: 'author',
    text: 'Author prefers short chapters',
    type: 'preference',
    topicTags: ['style'],
    importance: 0.8,
    createdAt: now,
  };

  const sethMemory: MemoryNote = {
    ...baseMemory,
    id: 'mem1',
    text: 'Seth has green eyes and is protective',
    topicTags: ['character:seth', 'appearance'],
  };

  const sarahMemory: MemoryNote = {
    ...baseMemory,
    id: 'mem2',
    text: 'Sarah is a doctor from Chicago',
    topicTags: ['character:sarah', 'occupation'],
  };

  const plotMemory: MemoryNote = {
    ...baseMemory,
    id: 'mem3',
    text: 'The climax happens in the hospital',
    topicTags: ['plot', 'location'],
    importance: 0.9,
  };

  // Helper to set up db mock for different scenarios
  const setupDbMock = (authorMems: MemoryNote[], projectMems: MemoryNote[]) => {
    // Mock for getMemories - it uses where().equals().toArray() chain
    const mockWhere = vi.fn().mockImplementation((field: string) => {
      return {
        equals: vi.fn().mockImplementation((value: any) => {
          return {
            toArray: vi.fn().mockImplementation(() => {
              // Handle compound index [scope+projectId]
              if (field === '[scope+projectId]') {
                const [scope] = value;
                return Promise.resolve(scope === 'author' ? authorMems : projectMems);
              }
              // Handle scope alone
              if (field === 'scope') {
                return Promise.resolve(value === 'author' ? authorMems : projectMems);
              }
              return Promise.resolve(projectMems);
            }),
          };
        }),
      };
    });

    vi.mocked(db.memories.where).mockImplementation(mockWhere);
    vi.mocked(db.memories.toCollection).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([...authorMems, ...projectMems]),
    } as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all memories when no relevance filters provided', async () => {
    const allProjectMemories = [sethMemory, sarahMemory, plotMemory];
    setupDbMock([authorMemory], allProjectMemories);

    const result = await getRelevantMemoriesForContext('proj1', {});

    expect(result.author).toHaveLength(1);
    expect(result.project).toHaveLength(3);
  });

  it('prioritizes memories matching active entity names', async () => {
    const allProjectMemories = [plotMemory, sarahMemory, sethMemory]; // Different order
    setupDbMock([authorMemory], allProjectMemories);

    const result = await getRelevantMemoriesForContext('proj1', {
      activeEntityNames: ['Seth'],
    });

    // Seth memory should be first due to entity match
    expect(result.project[0].id).toBe('mem1');
  });

  it('prioritizes memories matching selection keywords', async () => {
    const allProjectMemories = [sethMemory, sarahMemory, plotMemory];
    setupDbMock([authorMemory], allProjectMemories);

    const result = await getRelevantMemoriesForContext('proj1', {
      selectionKeywords: ['hospital', 'climax'],
    });

    // Plot memory should be first (matches both keywords)
    expect(result.project[0].id).toBe('mem3');
  });

  it('combines entity and keyword scoring', async () => {
    const mixedMemory: MemoryNote = {
      ...baseMemory,
      id: 'mem4',
      text: 'Seth goes to the hospital',
      topicTags: ['character:seth', 'location'],
      importance: 0.5,
    };

    setupDbMock([], [sethMemory, plotMemory, mixedMemory]);

    const result = await getRelevantMemoriesForContext('proj1', {
      activeEntityNames: ['Seth'],
      selectionKeywords: ['hospital'],
    });

    // Mixed memory should be first (matches both entity AND keyword)
    expect(result.project[0].id).toBe('mem4');
  });

  it('always includes all author memories', async () => {
    const authorMemories = [
      authorMemory, 
      { ...authorMemory, id: 'author2', text: 'Another preference' }
    ];

    setupDbMock(authorMemories, [sethMemory]);

    const result = await getRelevantMemoriesForContext('proj1', {
      activeEntityNames: ['NonexistentCharacter'],
    });

    // Author memories are always included regardless of relevance filter
    expect(result.author).toHaveLength(2);
  });

  it('falls back to all memories when no matches found', async () => {
    const projectMemories = [sethMemory, sarahMemory];
    setupDbMock([], projectMemories);

    const result = await getRelevantMemoriesForContext('proj1', {
      activeEntityNames: ['CompletelyUnknownName'],
      selectionKeywords: ['xyznonexistent'],
    });

    // Should fall back to returning all project memories
    expect(result.project.length).toBe(2);
  });

  it('respects limit option', async () => {
    const manyMemories = Array.from({ length: 100 }, (_, i) => ({
      ...baseMemory,
      id: `mem${i}`,
      text: `Memory ${i}`,
      topicTags: ['general'],
    })) as MemoryNote[];

    setupDbMock([], manyMemories);

    const result = await getRelevantMemoriesForContext('proj1', {}, { limit: 10 });

    expect(result.project.length).toBeLessThanOrEqual(10);
  });

  it('handles case-insensitive entity matching', async () => {
    setupDbMock([], [sethMemory, sarahMemory]);

    const result = await getRelevantMemoriesForContext('proj1', {
      activeEntityNames: ['SETH', 'seth', 'Seth'],
    });

    // Should match regardless of case
    expect(result.project[0].id).toBe('mem1');
  });
});
