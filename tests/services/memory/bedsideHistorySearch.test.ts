import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evolveBedsideNote, searchBedsideHistory, setBedsideEmbeddingGenerator } from '@/services/memory';
import type { MemoryNote } from '@/services/memory/types';

interface MockCollection {
  filter: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
}

interface MockMemoriesTable {
  add: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  toCollection: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  storedData: MemoryNote[];
}

const createCollection = (dataRef: MemoryNote[], appliedFilters: ((note: MemoryNote) => boolean)[]): MockCollection => {
  const collection: MockCollection = {
    filter: vi.fn().mockImplementation((predicate: (note: MemoryNote) => boolean) => {
      appliedFilters.push(predicate);
      const filtered = dataRef.filter(predicate);
      return createCollection(filtered, appliedFilters);
    }),
    toArray: vi.fn().mockImplementation(() => Promise.resolve([...dataRef])),
  };
  return collection;
};

function createMemoriesTableMock(dataRef: MemoryNote[] = []): MockMemoriesTable {
  let appliedFilters: ((note: MemoryNote) => boolean)[] = [];

  const mockTable: MockMemoriesTable = {
    add: vi.fn().mockImplementation((note: MemoryNote) => {
      dataRef.push(note);
      return Promise.resolve(note.id);
    }),
    put: vi.fn().mockImplementation((note: MemoryNote) => {
      const idx = dataRef.findIndex(n => n.id === note.id);
      if (idx >= 0) {
        dataRef[idx] = note;
      } else {
        dataRef.push(note);
      }
      return Promise.resolve(note.id);
    }),
    get: vi.fn().mockImplementation((id: string) => Promise.resolve(dataRef.find(n => n.id === id))),
    delete: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockImplementation((field: string) => {
      appliedFilters = [];
      if (field === '[scope+projectId]') {
        return {
          equals: vi.fn().mockImplementation(([scope, projectId]: [string, string]) =>
            createCollection(
              dataRef.filter(note => note.scope === scope && note.projectId === projectId),
              appliedFilters,
            )
          ),
        };
      }
      return { equals: vi.fn() } as any;
    }),
    toCollection: vi.fn().mockImplementation(() => {
      appliedFilters = [];
      return createCollection(dataRef, appliedFilters);
    }),
    filter: vi.fn().mockImplementation((predicate: (note: MemoryNote) => boolean) => {
      appliedFilters.push(predicate);
      const filtered = dataRef.filter(predicate);
      return createCollection(filtered, appliedFilters);
    }),
    storedData: dataRef,
  };

  return mockTable;
}

let storedData: MemoryNote[] = [];
let memoriesTable: MockMemoriesTable;
let db: { memories: MockMemoriesTable };

vi.mock('@/services/db', () => ({
  get db() {
    return db;
  },
}));

const baseBedsideNote = (overrides: Partial<MemoryNote> = {}): MemoryNote => ({
  id: `note-${Math.random().toString(16).slice(2)}`,
  scope: 'project',
  projectId: 'project-1',
  text: 'Planning baseline',
  type: 'plan',
  topicTags: ['meta:bedside-note'],
  importance: 0.5,
  createdAt: Date.now(),
  ...overrides,
});

describe('bedside history search', () => {
  beforeEach(() => {
    storedData = [];
    memoriesTable = createMemoriesTableMock(storedData);
    db = { memories: memoriesTable };
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => `uuid-${Math.random()}`);
  });

  afterEach(() => {
    setBedsideEmbeddingGenerator(null);
    vi.restoreAllMocks();
  });

  it('stores embedding vectors when evolving the bedside note', async () => {
    setBedsideEmbeddingGenerator(() => [0.25, 0.75]);

    const evolved = await evolveBedsideNote('project-1', 'Evolved bedside content');

    expect(evolved.embedding).toEqual([0.25, 0.75]);
    const persisted = storedData.find(n => n.id === evolved.id);
    expect(persisted?.embedding).toEqual([0.25, 0.75]);
  });

  it('ranks bedside history by semantic similarity', async () => {
    const older = baseBedsideNote({ id: 'old', createdAt: 1_000, embedding: [1, 0] });
    const mid = baseBedsideNote({ id: 'mid', createdAt: 2_000, embedding: [0, 1] });
    const recent = baseBedsideNote({ id: 'recent', createdAt: 3_000, embedding: [0.8, 0.2] });
    storedData.push(older, mid, recent);
    setBedsideEmbeddingGenerator(() => [1, 0]);

    const results = await searchBedsideHistory('project-1', 'Where were we?');

    expect(results.map(r => r.note.id)).toEqual(['old', 'recent', 'mid']);
  });

  it('supports time-travel lookup via asOf timestamp', async () => {
    const older = baseBedsideNote({ id: 'old', createdAt: 1_000, embedding: [1, 0] });
    const newer = baseBedsideNote({ id: 'new', createdAt: 5_000, embedding: [0.9, 0.1] });
    storedData.push(older, newer);
    setBedsideEmbeddingGenerator(() => [1, 0]);

    const results = await searchBedsideHistory('project-1', 'What was planned?', { asOf: 2_000 });

    expect(results).toHaveLength(1);
    expect(results[0].note.id).toBe('old');
  });
});
