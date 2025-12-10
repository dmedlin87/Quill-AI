import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as chains from '@/services/memory/chains';
import { BEDSIDE_NOTE_TAG, BEDSIDE_NOTE_DEFAULT_TAGS, type MemoryNote } from '@/services/memory/types';

// Hoisted db mock
const dbMocks = vi.hoisted(() => ({
  memoriesFilter: vi.fn(),
  memoriesWhere: vi.fn(),
  memoriesAdd: vi.fn(),
  memoriesGet: vi.fn(),
  memoriesPut: vi.fn(),
  memoriesDelete: vi.fn(),
}));

vi.mock('@/services/db', () => ({
  db: {
    memories: {
      filter: dbMocks.memoriesFilter,
      where: dbMocks.memoriesWhere,
      add: dbMocks.memoriesAdd,
      get: dbMocks.memoriesGet,
      put: dbMocks.memoriesPut,
      delete: dbMocks.memoriesDelete,
    },
    projects: {
      get: vi.fn().mockResolvedValue({ title: 'Test Project' }),
    },
  },
}));

const memoryMocks = vi.hoisted(() => ({
  getMemories: vi.fn(),
  createMemory: vi.fn(),
  getMemory: vi.fn(),
  updateMemory: vi.fn(),
  embedBedsideNoteText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  serializeBedsideNote: vi.fn().mockReturnValue({ text: '' }),
}));

// Mock memoryService - chains.ts imports from here
vi.mock('@/services/memory/memoryService', () => ({
  createMemory: (...args: any[]) => memoryMocks.createMemory(...args),
  updateMemory: (...args: any[]) => memoryMocks.updateMemory(...args),
}));

// Mock memoryQueries - chains.ts imports from here
vi.mock('@/services/memory/memoryQueries', () => ({
  getMemory: (...args: any[]) => memoryMocks.getMemory(...args),
  getMemories: (...args: any[]) => memoryMocks.getMemories(...args),
}));

// Mock bedsideEmbeddings - chains.ts imports this too
vi.mock('@/services/memory/bedsideEmbeddings', () => ({
  embedBedsideNoteText: (...args: any[]) => memoryMocks.embedBedsideNoteText(...args),
}));

// Mock bedsideNoteSerializer
vi.mock('@/services/memory/bedsideNoteSerializer', () => ({
  serializeBedsideNote: (...args: any[]) => memoryMocks.serializeBedsideNote(...args),
}));

const {
  getOrCreateBedsideNote,
  getOrCreateAuthorBedsideNote,
  evolveBedsideNote,
  detectBedsideNoteConflicts,
  seedProjectBedsideNoteFromAuthor,
  recordProjectRetrospective,
  getChainEvolution,
  getAllChains,
  formatChainForPrompt,
  getMemoryChain,
  evolveMemory,
  createMemoryChain,
  getLatestInChain,
  isSuperseded,
  getSuccessor,
} = chains;

describe('memory chains bedside-note helpers', () => {
  const projectId = 'proj-bedside';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrCreateBedsideNote creates a bedside-note plan when none exists', async () => {
    const createdNote: MemoryNote = {
      id: 'bed-1',
      scope: 'project',
      projectId,
      type: 'plan',
      text:
        'Project planning notes for this manuscript. This note will be updated over time with key goals, concerns, and constraints.',
      topicTags: BEDSIDE_NOTE_DEFAULT_TAGS,
      importance: 0.85,
      createdAt: Date.now(),
    };

    memoryMocks.getMemories.mockResolvedValueOnce([]);
    memoryMocks.createMemory.mockResolvedValueOnce(createdNote);

    const result = await getOrCreateBedsideNote(projectId);

    expect(memoryMocks.getMemories).toHaveBeenCalledWith({
      scope: 'project',
      projectId,
      type: 'plan',
      topicTags: [BEDSIDE_NOTE_TAG],
      limit: 1,
    });
    expect(memoryMocks.createMemory).toHaveBeenCalledTimes(1);
    expect(result).toBe(createdNote);
  });

  it('getOrCreateBedsideNote reuses an existing bedside-note plan when present', async () => {
    const existing: MemoryNote = {
      id: 'bed-existing',
      scope: 'project',
      projectId,
      type: 'plan',
      text: 'Existing bedside note',
      topicTags: BEDSIDE_NOTE_DEFAULT_TAGS,
      importance: 0.9,
      createdAt: Date.now() - 1000,
    };

    memoryMocks.getMemories.mockResolvedValueOnce([existing]);

    const result = await getOrCreateBedsideNote(projectId);

    expect(memoryMocks.createMemory).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('detectBedsideNoteConflicts flags contradictory statements with heuristics', async () => {
    const conflicts = await detectBedsideNoteConflicts(
      'Sarah has green eyes. Keep Sarah alive.',
      'Sarah has blue eyes. Sarah must die.'
    );

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0]).toMatchObject({
      previous: 'Sarah has blue eyes',
      current: 'Sarah has green eyes',
      strategy: 'heuristic',
    });
  });

  it('evolveBedsideNote delegates to evolveMemory with chain metadata', async () => {
    const base: MemoryNote = {
      id: 'bed-base',
      scope: 'project',
      projectId,
      type: 'plan',
      text: 'Base bedside note',
      topicTags: BEDSIDE_NOTE_DEFAULT_TAGS,
      importance: 0.8,
      createdAt: Date.now() - 5000,
    };

    memoryMocks.getMemories.mockResolvedValueOnce([base]);
    memoryMocks.getMemory.mockResolvedValueOnce(base);
    memoryMocks.updateMemory.mockResolvedValue(base as MemoryNote);

    memoryMocks.createMemory.mockImplementation(async (input: any) => ({
      ...base,
      ...input,
      id: 'bed-evolved',
      createdAt: Date.now(),
    } as MemoryNote));

    const structuredContent = { currentFocus: 'Updated bedside plan' } as any;
    const result = await evolveBedsideNote(projectId, 'Updated bedside plan text', {
      changeReason: 'analysis_update',
      structuredContent,
    });

    expect(memoryMocks.getMemory).toHaveBeenCalledWith('bed-base');
    expect(memoryMocks.createMemory).toHaveBeenCalledTimes(1);
    const [createInput] = memoryMocks.createMemory.mock.calls[0];
    expect(createInput.text).toBe('Updated bedside plan text');
    expect(createInput.scope).toBe('project');
    expect(createInput.type).toBe('plan');
    expect(createInput.projectId).toBe(projectId);
    expect(createInput.topicTags).toEqual(
      expect.arrayContaining([
        ...BEDSIDE_NOTE_DEFAULT_TAGS,
        expect.stringMatching(/^chain:/),
        expect.stringMatching(/^chain_version:/),
        `supersedes:${base.id}`,
        'change_reason:analysis_update',
      ])
    );
    expect(createInput.structuredContent).toEqual(structuredContent);
    expect(result.id).toBe('bed-evolved');
  });

  it.each(['auto', 'agent', 'user'] as const)(
    'evolveBedsideNote tags conflicts and resolution path (%s)',
    async resolutionStrategy => {
      const base: MemoryNote = {
        id: 'bed-base',
        scope: 'project',
        projectId,
        type: 'plan',
        text: 'Sarah has blue eyes. Keep Sarah alive.',
        topicTags: BEDSIDE_NOTE_DEFAULT_TAGS,
        importance: 0.8,
        createdAt: Date.now() - 5000,
      };

      memoryMocks.getMemories.mockResolvedValueOnce([base]);
      memoryMocks.getMemory.mockResolvedValueOnce(base);

      let createdMemory: MemoryNote | undefined;
      memoryMocks.createMemory.mockImplementation(async (input: any) => {
        createdMemory = {
          ...base,
          ...input,
          id: `bed-evolved-${resolutionStrategy}`,
          createdAt: Date.now(),
        } as MemoryNote;
        return createdMemory;
      });

      memoryMocks.updateMemory.mockImplementation(async (_id: string, updates: any) => ({
        ...(createdMemory as MemoryNote),
        ...updates,
      } as MemoryNote));

      const result = await evolveBedsideNote(projectId, 'Sarah has green eyes. Sarah is not alive.', {
        conflictResolution: resolutionStrategy,
      });

      expect(memoryMocks.createMemory).toHaveBeenCalledTimes(1);
      const [createInput] = memoryMocks.createMemory.mock.calls[0];
      expect(createInput.structuredContent?.conflicts?.[0]).toMatchObject({ resolution: resolutionStrategy });
      expect(createInput.structuredContent?.warnings?.[0]).toContain('Conflict:');

      expect(result.topicTags).toEqual(
        expect.arrayContaining(['conflict:detected', `conflict:resolution:${resolutionStrategy}`])
      );
      expect((result.structuredContent as any)?.conflicts?.[0].resolution).toBe(resolutionStrategy);
    }
  );

  it('rolls chapter bedside updates up to arc and project scopes', async () => {
    const chapterNote: MemoryNote = {
      id: 'bed-chapter',
      scope: 'project',
      projectId,
      type: 'plan',
      text: 'Chapter bedside',
      topicTags: [BEDSIDE_NOTE_TAG, 'chapter:ch-1'],
      importance: 0.8,
      createdAt: Date.now(),
    };

    const arcNote: MemoryNote = {
      ...chapterNote,
      id: 'bed-arc',
      topicTags: [BEDSIDE_NOTE_TAG, 'arc:arc-1'],
    };

    const projectNote: MemoryNote = {
      ...chapterNote,
      id: 'bed-project',
      topicTags: [BEDSIDE_NOTE_TAG],
    };

    memoryMocks.getMemories
      .mockResolvedValueOnce([chapterNote])
      .mockResolvedValueOnce([arcNote])
      .mockResolvedValueOnce([projectNote]);

    memoryMocks.getMemory.mockImplementation(async (id: string) => {
      if (id === chapterNote.id) return chapterNote;
      if (id === arcNote.id) return arcNote;
      if (id === projectNote.id) return projectNote;
      return undefined;
    });

    memoryMocks.createMemory.mockImplementation(async (input: any) => ({
      ...chapterNote,
      ...input,
      id: input.id || `${(input.topicTags || []).join('-')}-next`,
      createdAt: Date.now(),
    }));

    memoryMocks.updateMemory.mockImplementation(async (_id: string, updates: any) => ({
      ...chapterNote,
      ...updates,
    } as MemoryNote));

    await chains.evolveBedsideNote(projectId, 'Fresh insight', {
      chapterId: 'ch-1',
      arcId: 'arc-1',
    });

    const rollupCalls = memoryMocks.createMemory.mock.calls.filter(([input]) =>
      (input.topicTags || []).includes('change_reason:roll_up')
    );
    expect(rollupCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('creates an author-scoped bedside note with author tag', async () => {
    memoryMocks.getMemories.mockResolvedValueOnce([]);

    const createdAuthor: MemoryNote = {
      id: 'author-bed-1',
      scope: 'author',
      type: 'plan',
      text: 'Author bedside notebook — keep cross-project lessons, recurring issues, and style reminders here.',
      topicTags: [BEDSIDE_NOTE_TAG, 'planner:global', 'arc:story', 'scope:author'],
      importance: 0.9,
      createdAt: Date.now(),
    };

    memoryMocks.createMemory.mockResolvedValueOnce(createdAuthor);

    const result = await getOrCreateAuthorBedsideNote();

    expect(memoryMocks.getMemories).toHaveBeenCalledWith({
      scope: 'author',
      type: 'plan',
      topicTags: [BEDSIDE_NOTE_TAG, 'scope:author'],
      limit: 1,
    });
    expect(memoryMocks.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'author', topicTags: expect.arrayContaining(['scope:author']) })
    );
    expect(result).toBe(createdAuthor);
  });

  it('seeds project bedside note with author warnings and tags', async () => {
    const projectBase: MemoryNote = {
      id: 'bed-project',
      scope: 'project',
      projectId,
      type: 'plan',
      text: 'Project planning notes',
      topicTags: [BEDSIDE_NOTE_TAG],
      importance: 0.8,
      createdAt: Date.now(),
    };

    const authorBase: MemoryNote = {
      id: 'bed-author',
      scope: 'author',
      type: 'plan',
      text: 'Author bedside note text',
      topicTags: [BEDSIDE_NOTE_TAG, 'scope:author'],
      importance: 0.9,
      createdAt: Date.now(),
      structuredContent: { warnings: ['Avoid overwriting key symbols'] },
    };

    memoryMocks.getMemories.mockImplementation(async params => {
      if (params.scope === 'author') return [authorBase];
      return [projectBase];
    });

    memoryMocks.getMemory.mockResolvedValue(projectBase);

    memoryMocks.createMemory.mockImplementation(async input => ({
      ...projectBase,
      ...input,
      id: 'bed-project-next',
      createdAt: Date.now(),
    } as MemoryNote));

    memoryMocks.updateMemory.mockImplementation(async (_id: string, updates: any) => ({
      ...projectBase,
      ...updates,
    } as MemoryNote));

    const seeded = await seedProjectBedsideNoteFromAuthor(projectId);

    expect(memoryMocks.createMemory).toHaveBeenCalled();
    const [seedCreateCall] = memoryMocks.createMemory.mock.calls[0];
    expect(seedCreateCall.text).toContain('Author bedside note text');
    const taggedUpdate = memoryMocks.updateMemory.mock.calls.find(([_id, payload]) =>
      (payload.topicTags || []).includes('seeded_from:author_bedside')
    );
    expect(taggedUpdate?.[1].topicTags).toEqual(expect.arrayContaining(['seeded_from:author_bedside']));
  });

  it('records a project retrospective into the author bedside note', async () => {
    const projectBase: MemoryNote = {
      id: 'bed-project',
      scope: 'project',
      projectId,
      type: 'plan',
      text: 'Final bedside focus',
      topicTags: [BEDSIDE_NOTE_TAG],
      importance: 0.8,
      createdAt: Date.now(),
      structuredContent: { warnings: ['Track eye colors'] },
    };

    const authorBase: MemoryNote = {
      id: 'bed-author',
      scope: 'author',
      type: 'plan',
      text: 'Existing author bedside',
      topicTags: [BEDSIDE_NOTE_TAG, 'scope:author'],
      importance: 0.9,
      createdAt: Date.now(),
    };

    memoryMocks.getMemories.mockImplementation(async params => {
      if (params.scope === 'project') return [projectBase];
      return [authorBase];
    });

    memoryMocks.getMemory.mockImplementation(async id => {
      if (id === authorBase.id) return authorBase;
      return projectBase;
    });

    memoryMocks.createMemory.mockImplementation(async input => ({
      ...authorBase,
      ...input,
      id: 'bed-author-next',
      createdAt: Date.now(),
    } as MemoryNote));

    memoryMocks.updateMemory.mockImplementation(async (_id: string, updates: any) => ({
      ...authorBase,
      ...updates,
    } as MemoryNote));

    const result = await recordProjectRetrospective(projectId, { summary: 'Project finished strong' });

    expect(memoryMocks.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'author',
        text: 'Project finished strong',
        topicTags: expect.arrayContaining(['scope:author']),
      })
    );
    expect(result.topicTags).toContain(`retrospective:project:${projectId}`);
  });
});

describe('memory chains - evolveMemory', () => {
  const projectId = 'proj-evolution';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates initial chain entry when no prior chain exists', async () => {
    const baseMemory: MemoryNote = {
      id: 'base-evolve',
      scope: 'project',
      projectId,
      type: 'fact',
      text: 'Initial text',
      topicTags: ['topic:test'],
      importance: 0.7,
      createdAt: Date.now() - 1000,
    };

    memoryMocks.getMemory.mockResolvedValue(baseMemory);
    memoryMocks.getMemories.mockResolvedValue([]);
    memoryMocks.createMemory.mockImplementation(async input => ({
      ...baseMemory,
      ...input,
      id: 'evolved-1',
      createdAt: Date.now(),
    } as MemoryNote));
    memoryMocks.updateMemory.mockImplementation(async (_id, updates) => ({
      ...baseMemory,
      ...updates,
    } as MemoryNote));

    const result = await evolveMemory('base-evolve', 'Updated text');

    expect(memoryMocks.createMemory).toHaveBeenCalled();
    expect(result.text).toBe('Updated text');
  });

  it('appends to existing chain', async () => {
    const existingChain: MemoryNote[] = [
      {
        id: 'chain-v1',
        scope: 'project',
        projectId,
        type: 'fact',
        text: 'Version 1 text',
        topicTags: ['chain:test-chain', 'chain_version:1'],
        importance: 0.7,
        createdAt: Date.now() - 2000,
      },
      {
        id: 'chain-v2',
        scope: 'project',
        projectId,
        type: 'fact',
        text: 'Version 2 text',
        topicTags: ['chain:test-chain', 'chain_version:2', 'supersedes:chain-v1'],
        importance: 0.7,
        createdAt: Date.now() - 1000,
      },
    ];

    memoryMocks.getMemory.mockResolvedValue(existingChain[1]);
    memoryMocks.getMemories.mockResolvedValue(existingChain);
    memoryMocks.createMemory.mockImplementation(async input => ({
      ...existingChain[1],
      ...input,
      id: 'chain-v3',
      createdAt: Date.now(),
    } as MemoryNote));
    memoryMocks.updateMemory.mockImplementation(async (_id, updates) => ({
      ...existingChain[1],
      ...updates,
    } as MemoryNote));

    const result = await evolveMemory('chain-v2', 'Version 3 text');

    expect(memoryMocks.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Version 3 text',
        topicTags: expect.arrayContaining([
          expect.stringMatching(/^chain:/),
          expect.stringMatching(/^chain_version:/),
          expect.stringMatching(/^supersedes:/),
        ]),
      })
    );
  });
});

describe('memory chains - createMemoryChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when memory is not found', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce(undefined);

    await expect(createMemoryChain('missing-id')).rejects.toThrow('Memory not found: missing-id');
  });

  it('creates chain metadata tags on the initial memory', async () => {
    const memory: MemoryNote = {
      id: 'mem-1',
      scope: 'project',
      projectId: 'p1',
      type: 'fact',
      text: 'Initial fact',
      topicTags: ['topic:test'],
      importance: 0.7,
      createdAt: Date.now(),
    };

    memoryMocks.getMemory.mockResolvedValueOnce(memory);
    memoryMocks.updateMemory.mockResolvedValueOnce({ ...memory, topicTags: [...memory.topicTags, 'chain:xyz', 'chain_version:1'] });

    const chainId = await createMemoryChain('mem-1', 'Test topic');

    expect(chainId).toMatch(/^chain_/);
    expect(memoryMocks.updateMemory).toHaveBeenCalledWith('mem-1', {
      topicTags: expect.arrayContaining([
        'topic:test',
        expect.stringMatching(/^chain:/),
        'chain_version:1',
      ]),
    });
  });
});

describe('memory chains - getMemoryChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when memory not found', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce(undefined);

    const result = await getMemoryChain('missing');
    expect(result).toEqual([]);
  });

  it('returns empty array when memory has no chain tag', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce({
      id: 'no-chain',
      topicTags: ['other'],
    } as MemoryNote);

    const result = await getMemoryChain('no-chain');
    expect(result).toEqual([]);
  });

  it('retrieves chain by chainId directly and sorts by version', async () => {
    const chainMemories = [
      { id: 'm2', text: 'V2', topicTags: ['chain:c1', 'chain_version:2', 'supersedes:m1'], createdAt: 2000 },
      { id: 'm1', text: 'V1', topicTags: ['chain:c1', 'chain_version:1'], createdAt: 1000 },
    ];

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce(chainMemories),
    });

    const result = await getMemoryChain('chain_c1');

    expect(result).toHaveLength(2);
    expect(result[0].version).toBe(1);
    expect(result[0].changeType).toBe('initial');
    expect(result[1].version).toBe(2);
    expect(result[1].changeType).toBe('supersede');
  });

  it('retrieves chain by memoryId lookup', async () => {
    const memory: MemoryNote = {
      id: 'mem-in-chain',
      topicTags: ['chain:lookup-chain', 'chain_version:1'],
    } as MemoryNote;

    memoryMocks.getMemory.mockResolvedValueOnce(memory);

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce([memory]),
    });

    const result = await getMemoryChain('mem-in-chain');

    expect(result).toHaveLength(1);
    expect(result[0].memoryId).toBe('mem-in-chain');
  });
});

describe('memory chains - getLatestInChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when chain is empty', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce(undefined);
    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce([]),
    });

    const result = await getLatestInChain('missing');
    expect(result).toBeNull();
  });

  it('returns the highest-version memory in a chain', async () => {
    const chainMemories = [
      { id: 'm1', text: 'V1', topicTags: ['chain:c1', 'chain_version:1'], createdAt: 1000 },
      { id: 'm2', text: 'V2', topicTags: ['chain:c1', 'chain_version:2'], createdAt: 2000 },
    ];
    const latestMemory: MemoryNote = { ...chainMemories[1] } as MemoryNote;

    memoryMocks.getMemory
      .mockResolvedValueOnce({ id: 'm1', topicTags: ['chain:c1', 'chain_version:1'] } as MemoryNote)
      .mockResolvedValueOnce(latestMemory);

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce(chainMemories),
    });

    const result = await getLatestInChain('m1');

    expect(result).toEqual(latestMemory);
  });
});

describe('memory chains - isSuperseded / getSuccessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isSuperseded returns true when superseded_by tag present', () => {
    const memory: MemoryNote = {
      id: 'm1',
      topicTags: ['superseded_by:m2'],
    } as MemoryNote;

    expect(isSuperseded(memory)).toBe(true);
  });

  it('isSuperseded returns false when no superseded_by tag', () => {
    const memory: MemoryNote = {
      id: 'm1',
      topicTags: ['chain:c1'],
    } as MemoryNote;

    expect(isSuperseded(memory)).toBe(false);
  });

  it('getSuccessor returns null when memory not found', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce(undefined);

    const result = await getSuccessor('missing');
    expect(result).toBeNull();
  });

  it('getSuccessor returns null when no superseded_by tag', async () => {
    memoryMocks.getMemory.mockResolvedValueOnce({
      id: 'm1',
      topicTags: ['chain:c1'],
    } as MemoryNote);

    const result = await getSuccessor('m1');
    expect(result).toBeNull();
  });

  it('getSuccessor returns the successor memory', async () => {
    const original: MemoryNote = {
      id: 'm1',
      topicTags: ['superseded_by:m2'],
    } as MemoryNote;
    const successor: MemoryNote = {
      id: 'm2',
      text: 'Successor',
    } as MemoryNote;

    memoryMocks.getMemory.mockImplementation(async (id: string) => {
      if (id === 'm1') return original;
      if (id === 'm2') return successor;
      return undefined;
    });

    const result = await getSuccessor('m1');
    expect(result).toEqual(successor);
  });
});

describe('memory chains - getChainEvolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single-version evolution when memory has no chain', async () => {
    const memory: MemoryNote = {
      id: 'single',
      text: 'Single memory text',
      topicTags: [],
      createdAt: 1000,
    } as MemoryNote;

    // First call: getMemoryChain lookup (no chain tag)
    // Second call: fallback getMemory in getChainEvolution
    memoryMocks.getMemory.mockImplementation(async (id: string) => {
      if (id === 'single') return memory;
      return undefined;
    });

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce([]),
    });

    const result = await getChainEvolution('single');

    expect(result.versions).toBe(1);
    expect(result.topic).toBe('Single memory text');
    expect(result.timeline).toHaveLength(1);
    expect(result.currentText).toBe('Single memory text');
  });

  it('returns multi-version evolution with timeline summaries', async () => {
    const chainMemories = [
      { id: 'm1', text: 'Initial memory with topic about xyz', topicTags: ['chain:c1', 'chain_version:1'], createdAt: 1000 },
      { id: 'm2', text: 'Updated memory', topicTags: ['chain:c1', 'chain_version:2', 'supersedes:m1'], createdAt: 2000 },
    ];

    memoryMocks.getMemory.mockResolvedValueOnce({
      id: 'm1',
      topicTags: ['chain:c1', 'chain_version:1'],
    } as MemoryNote);

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce(chainMemories),
    });

    const result = await getChainEvolution('m1');

    expect(result.versions).toBe(2);
    expect(result.topic).toContain('Initial memory');
    expect(result.timeline[0].summary).toContain('Initial:');
    expect(result.timeline[1].summary).toContain('supersede:');
    expect(result.currentText).toBe('Updated memory');
  });
});

describe('memory chains - getAllChains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all unique chains for a project', async () => {
    const memories = [
      { id: 'm1', text: 'Chain A v1', topicTags: ['chain:chainA', 'chain_version:1'] },
      { id: 'm2', text: 'Chain A v2', topicTags: ['chain:chainA', 'chain_version:2'] },
      { id: 'm3', text: 'Chain B v1', topicTags: ['chain:chainB', 'chain_version:1'] },
      { id: 'm4', text: 'No chain', topicTags: ['other'] },
    ];

    dbMocks.memoriesWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValueOnce(memories),
      }),
    });

    const result = await getAllChains('proj-1');

    expect(result).toHaveLength(2);
    expect(result.find(c => c.chainId === 'chainA')?.versions).toBe(2);
    expect(result.find(c => c.chainId === 'chainB')?.versions).toBe(1);
  });
});

describe('memory chains - formatChainForPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats single-version memory simply', async () => {
    const memory: MemoryNote = { id: 'single', text: 'Single fact', topicTags: [], createdAt: 1000 } as MemoryNote;

    memoryMocks.getMemory.mockImplementation(async (id: string) => {
      if (id === 'single') return memory;
      return undefined;
    });

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce([]),
    });

    const result = await formatChainForPrompt('single');

    expect(result).toBe('[Memory] Single fact');
  });

  it('formats multi-version chain with evolution summary', async () => {
    const chainMemories = [
      { id: 'm1', text: 'First version of fact', topicTags: ['chain:c1', 'chain_version:1'], createdAt: 1000 },
      { id: 'm2', text: 'Second version of fact', topicTags: ['chain:c1', 'chain_version:2', 'supersedes:m1'], createdAt: 2000 },
    ];

    memoryMocks.getMemory.mockResolvedValueOnce({
      id: 'm1',
      topicTags: ['chain:c1', 'chain_version:1'],
    } as MemoryNote);

    dbMocks.memoriesFilter.mockReturnValue({
      toArray: vi.fn().mockResolvedValueOnce(chainMemories),
    });

    const result = await formatChainForPrompt('m1');

    expect(result).toContain('[Evolving Memory - 2 versions]');
    expect(result).toContain('Latest: Second version of fact');
    expect(result).toContain('Evolution:');
    expect(result).toContain('v1');
    expect(result).toContain('v2');
  });
});

describe('memory chains - conflict detection edge cases', () => {
  it('detectLLMLikeConflicts catches explicit contradiction keywords', async () => {
    const conflicts = await detectBedsideNoteConflicts(
      'This contradicts prior information.',
      'Prior information was correct.'
    );

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].strategy).toBe('llm');
    expect(conflicts[0].confidence).toBeCloseTo(0.6, 1);
  });

  it('detectLLMLikeConflicts catches "conflicts with" phrasing', async () => {
    const conflicts = await detectBedsideNoteConflicts(
      'This conflicts with what we knew.',
      'What we knew was different.'
    );

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].strategy).toBe('llm');
  });

  it('heuristic detects negation flip conflicts', async () => {
    const conflicts = await detectBedsideNoteConflicts(
      'Alice is not alive.',
      'Alice is alive.'
    );

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].strategy).toBe('heuristic');
  });

  it('heuristic fallback detects same-subject different-statement conflicts', async () => {
    const conflicts = await detectBedsideNoteConflicts(
      'Bob went to the store.',
      'Bob stayed home.'
    );

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].confidence).toBeLessThan(0.6);
  });
});
