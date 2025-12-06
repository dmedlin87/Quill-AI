import { db } from '../db';
import type {
  CreateMemoryNoteInput,
  MemoryNote,
  UpdateMemoryNoteInput,
} from './types';

function assertProjectScope(
  scope: MemoryNote['scope'],
  projectId: string | undefined
): void {
  if (scope === 'project' && !projectId) {
    throw new Error('projectId is required for project-scoped memories');
  }
}

/**
 * Create a new memory note.
 *
 * @throws Error if scope is 'project' but projectId is missing
 */
export async function createMemory(
  input: CreateMemoryNoteInput
): Promise<MemoryNote> {
  assertProjectScope(input.scope, input.projectId);

  const note: MemoryNote = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...input,
  };

  await db.memories.add(note);
  return note;
}

/**
 * Update an existing memory note.
 *
 * @throws Error if note doesn't exist
 */
export async function updateMemory(
  id: string,
  updates: UpdateMemoryNoteInput
): Promise<MemoryNote> {
  const existing = await db.memories.get(id);
  if (!existing) {
    throw new Error(`Memory note not found: ${id}`);
  }

  // Validate the effective scope/project after applying updates.
  const scope = updates.scope ?? existing.scope;
  const projectId = updates.projectId ?? existing.projectId;
  assertProjectScope(scope, projectId);

  const updated: MemoryNote = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  await db.memories.put(updated);
  return updated;
}

/**
 * Delete a memory note.
 */
export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id);
}
