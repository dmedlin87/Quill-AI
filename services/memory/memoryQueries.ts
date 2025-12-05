import { db } from '../db';
import type {
  ListMemoryNotesParams,
  MemoryNote,
} from './types';

/**
 * Get memory notes with optional filters.
 *
 * Supports filtering by scope, projectId, type, and tags.
 * Results are sorted by importance (desc) then createdAt (desc).
 *
 * Optimization: Uses Dexie's Collection.filter() before toArray() to reduce
 * memory usage by filtering items as they are streamed from the DB.
 */
export async function getMemories(
  params: ListMemoryNotesParams = {}
): Promise<MemoryNote[]> {
  const { scope, projectId, type, topicTags, minImportance, limit } = params;

  const table: any = (db as any).memories;

  // Some test environments mock db.memories as a plain array or a minimal stub.
  // Fall back to an in-memory collection shape when toCollection isn't available.
  const createCollection = (data: MemoryNote[]) => ({
    filter: (predicate: (note: MemoryNote) => boolean) =>
      createCollection(data.filter(predicate)),
    toArray: () => Promise.resolve([...data]),
  });

  let collection =
    typeof table?.toCollection === 'function'
      ? table.toCollection()
      : createCollection(
          Array.isArray(table)
            ? table
            : Array.isArray(table?.data)
            ? table.data
            : []
        );

  const hasWhere = typeof table?.where === 'function';
  if (scope === 'project' && projectId) {
    collection = hasWhere
      ? table.where('[scope+projectId]').equals([scope, projectId])
      : collection.filter(note => note.scope === scope && note.projectId === projectId);
  } else if (scope) {
    collection = hasWhere
      ? table.where('scope').equals(scope)
      : collection.filter(note => note.scope === scope);
  } else if (projectId) {
    collection = hasWhere
      ? table.where('projectId').equals(projectId)
      : collection.filter(note => note.projectId === projectId);
  }

  if (type) {
    collection = collection.filter(note => note.type === type);
  }

  if (minImportance !== undefined) {
    collection = collection.filter(note => note.importance >= minImportance);
  }

  if (topicTags && topicTags.length > 0) {
    collection = collection.filter(note =>
      topicTags.every(tag => note.topicTags.includes(tag))
    );
  }

  let results = await collection.toArray();

  results.sort((a, b) => {
    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }
    return b.createdAt - a.createdAt;
  });

  if (limit && limit > 0) {
    results = results.slice(0, limit);
  }

  return results;
}

/**
 * Get memories sorted oldest-first for consolidation operations.
 * This ensures old memories aren't stranded beyond batch limits.
 */
export async function getMemoriesForConsolidation(
  projectId: string,
  options: {
    sortBy?: 'updatedAt' | 'createdAt';
    maxImportance?: number;
    minAge?: number; // milliseconds
    limit?: number;
    offset?: number;
  } = {}
): Promise<MemoryNote[]> {
  const {
    sortBy = 'updatedAt',
    maxImportance,
    minAge,
    limit = 100,
    offset = 0,
  } = options;

  const now = Date.now();

  let results = await db.memories
    .where('[scope+projectId]')
    .equals(['project', projectId])
    .toArray();

  if (maxImportance !== undefined) {
    results = results.filter(m => m.importance <= maxImportance);
  }

  if (minAge !== undefined) {
    results = results.filter(m => {
      const age = now - (m.updatedAt || m.createdAt);
      return age >= minAge;
    });
  }

  results.sort((a, b) => {
    const aTime = sortBy === 'updatedAt' ? (a.updatedAt || a.createdAt) : a.createdAt;
    const bTime = sortBy === 'updatedAt' ? (b.updatedAt || b.createdAt) : b.createdAt;
    return aTime - bTime;
  });

  return results.slice(offset, offset + limit);
}

/**
 * Count total memories for a project (for pagination).
 */
export async function countProjectMemories(projectId: string): Promise<number> {
  return db.memories
    .where('[scope+projectId]')
    .equals(['project', projectId])
    .count();
}

/**
 * Get a single memory note by ID.
 */
export async function getMemory(id: string): Promise<MemoryNote | undefined> {
  return db.memories.get(id);
}

/**
 * Get all memories relevant for agent context building.
 *
 * Returns both:
 * - All author-scoped memories (global preferences)
 * - All project-scoped memories for the given project
 *
 * Sorted by importance (desc) then recency (desc).
 */
export async function getMemoriesForContext(
  projectId: string,
  options: { limit?: number } = {}
): Promise<{ author: MemoryNote[]; project: MemoryNote[] }> {
  const { limit = 50 } = options;

  const [authorNotes, projectNotes] = await Promise.all([
    getMemories({ scope: 'author', limit }),
    getMemories({ scope: 'project', projectId, limit }),
  ]);

  return {
    author: authorNotes,
    project: projectNotes,
  };
}

/**
 * Search memories by tags using multi-entry index.
 *
 * Returns notes that have ANY of the specified tags.
 */
export async function searchMemoriesByTags(
  tags: string[],
  options: { projectId?: string; limit?: number } = {}
): Promise<MemoryNote[]> {
  const { projectId, limit = 20 } = options;

  const matchingNotes = new Map<string, MemoryNote>();

  for (const tag of tags) {
    const notes = await db.memories.where('topicTags').equals(tag).toArray();
    for (const note of notes) {
      if (projectId && note.scope === 'project' && note.projectId !== projectId) {
        continue;
      }
      matchingNotes.set(note.id, note);
    }
  }

  let results = Array.from(matchingNotes.values());
  results.sort((a, b) => {
    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }
    return b.createdAt - a.createdAt;
  });

  if (limit > 0) {
    results = results.slice(0, limit);
  }

  return results;
}
