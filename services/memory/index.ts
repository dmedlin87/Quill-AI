// ────────────────────────────────────────────────────────────────────────────────
// Agent Memory Service
// Provides CRUD operations for agent memories and goals.
// ────────────────────────────────────────────────────────────────────────────────

import { db } from '../db';
import { BEDSIDE_NOTE_TAG } from './types';
import type {
  MemoryNote,
  AgentGoal,
  GoalStatus,
  WatchedEntity,
  CreateGoalInput,
} from './types';

export * from './memoryService';
export * from './memoryQueries';
export * from './memoryScoring';

// Re-export types for convenience
export * from './types';
export * from './bedsideNoteMutations';
export * from './bedsideHistorySearch';
export * from './bedsideEmbeddings';

// Lightweight collection helper so Dexie-like mocks (arrays or { data: [] }) work
// in tests without requiring full index support.
function createCollection<T>(data: T[]) {
  return {
    filter: (predicate: (item: T) => boolean) => createCollection(data.filter(predicate)),
    toArray: () => Promise.resolve([...data]),
  };
}

function getGoalsCollection(projectId: string) {
  const table: any = (db as any).goals;

  // Dexie path
  if (typeof table?.where === 'function') {
    return table.where('projectId').equals(projectId);
  }

  // Fallback for plain arrays or simple mocks
  const data = Array.isArray(table)
    ? table
    : Array.isArray(table?.data)
    ? table.data
    : [];

  return createCollection(data.filter((goal: AgentGoal) => goal.projectId === projectId));
}

// ────────────────────────────────────────────────────────────────────────────────
// GOALS
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new agent goal.
 */
export async function addGoal(input: CreateGoalInput): Promise<AgentGoal> {
  const goal: AgentGoal = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    progress: input.progress ?? 0,
    ...input,
  };

  await db.goals.add(goal);
  await syncGoalLifecycleUpdate(goal.projectId, `Goal added: ${goal.title}`);
  return goal;
}

/**
 * Update an existing goal.
 * 
 * @throws Error if goal doesn't exist
 */
export async function updateGoal(
  id: string,
  updates: Partial<Omit<AgentGoal, 'id' | 'createdAt'>>
): Promise<AgentGoal> {
  const existing = await db.goals.get(id);
  if (!existing) {
    throw new Error(`Goal not found: ${id}`);
  }

  const updated: AgentGoal = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  await db.goals.put(updated);
  return updated;
}

/**
 * Get all active goals for a project.
 */
export async function getActiveGoals(projectId: string): Promise<AgentGoal[]> {
  const collection = getGoalsCollection(projectId);

  return collection.filter(goal => goal.status === 'active').toArray();
}

/**
 * Get all goals for a project (any status).
 */
export async function getGoals(
  projectId: string,
  status?: GoalStatus
): Promise<AgentGoal[]> {
  const collection = getGoalsCollection(projectId);

  if (status) {
    return collection.filter(goal => goal.status === status).toArray();
  }

  return collection.toArray();
}

async function syncGoalLifecycleUpdate(
  projectId: string,
  planText: string
): Promise<void> {
  const chains = await import('./chains');
  const [goals] = await Promise.all([
    getGoals(projectId),
    chains.getOrCreateBedsideNote(projectId),
  ]);

  const activeCount = goals.filter(goal => goal.status === 'active').length;
  const totalCount = goals.length;
  const annotatedPlanText =
    totalCount > 0
      ? `${planText} Active goals: ${activeCount}/${totalCount}.`
      : `${planText} No remaining goals.`;

  await chains.evolveBedsideNote(projectId, annotatedPlanText, {
    changeReason: 'goal_lifecycle',
  });
}

/**
 * Get a single goal by ID.
 */
export async function getGoal(id: string): Promise<AgentGoal | undefined> {
  return db.goals.get(id);
}

/**
 * Delete a goal.
 */
export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}

/**
 * Mark a goal as completed.
 */
export async function completeGoal(id: string): Promise<AgentGoal> {
  const updated = await updateGoal(id, { status: 'completed', progress: 100 });
  await syncGoalLifecycleUpdate(
    updated.projectId,
    `Goal completed: ${updated.title} — consider next steps.`
  );
  return updated;
}

/**
 * Abandon a goal.
 */
export async function abandonGoal(id: string): Promise<AgentGoal> {
  const updated = await updateGoal(id, { status: 'abandoned' });
  await syncGoalLifecycleUpdate(
    updated.projectId,
    `Goal abandoned: ${updated.title} — revisit priorities.`
  );
  return updated;
}

// ────────────────────────────────────────────────────────────────────────────────
// WATCHED ENTITIES
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Add an entity to the watchlist.
 */
export async function addWatchedEntity(
  input: Omit<WatchedEntity, 'id' | 'createdAt'>
): Promise<WatchedEntity> {
  const entity: WatchedEntity = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...input,
    monitoringEnabled: input.monitoringEnabled ?? true,
  };

  await db.watchedEntities.add(entity);
  return entity;
}

/**
 * Get all watched entities for a project.
 */
export async function getWatchedEntities(projectId: string): Promise<WatchedEntity[]> {
  const entities = await db.watchedEntities.where('projectId').equals(projectId).toArray();
  return entities.map(entity => ({ ...entity, monitoringEnabled: entity.monitoringEnabled ?? true }));
}

/**
 * Update a watched entity.
 */
export async function updateWatchedEntity(
  id: string,
  updates: Partial<Omit<WatchedEntity, 'id' | 'createdAt'>>
): Promise<WatchedEntity> {
  const existing = await db.watchedEntities.get(id);
  if (!existing) {
    throw new Error(`Watched entity not found: ${id}`);
  }

  const updated: WatchedEntity = {
    ...existing,
    ...updates,
    monitoringEnabled: updates.monitoringEnabled ?? existing.monitoringEnabled ?? true,
  };

  await db.watchedEntities.put(updated);
  return updated;
}

/**
 * Remove an entity from the watchlist.
 */
export async function removeWatchedEntity(id: string): Promise<void> {
  await db.watchedEntities.delete(id);
}

/**
 * Check if an entity is being watched.
 */
export async function isEntityWatched(
  projectId: string,
  entityId: string
): Promise<boolean> {
  const entities = await getWatchedEntities(projectId);
  return entities.some(e => e.id === entityId);
}

// ────────────────────────────────────────────────────────────────────────────────
// CONTEXT FORMATTING
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Format memory notes into a string suitable for agent prompts.
 */
export function formatMemoriesForPrompt(
  memories: { author: MemoryNote[]; project: MemoryNote[] },
  options: {
    maxLength?: number;
    chapterNames?: Record<string, string>;
    arcNames?: Record<string, string>;
    activeChapterId?: string | null;
    activeArcId?: string | null;
  } = {}
): string {
  const { maxLength = 2000, chapterNames = {}, arcNames = {}, activeChapterId, activeArcId } = options;
  const lines: string[] = [];

  const bedsideNotes = memories.project.filter(note => note.topicTags.includes(BEDSIDE_NOTE_TAG));
  const otherProjectNotes = memories.project.filter(note => !note.topicTags.includes(BEDSIDE_NOTE_TAG));

  const chapterNote = bedsideNotes.find(note =>
    note.topicTags.some(tag => tag.startsWith('chapter:') && tag.replace('chapter:', '') === activeChapterId)
  );

  const arcNote = bedsideNotes.find(note =>
    note.topicTags.some(tag => tag.startsWith('arc:') && tag.replace('arc:', '') === activeArcId)
  );

  const projectNote = bedsideNotes.find(note =>
    !note.topicTags.some(tag => tag.startsWith('chapter:') || (tag.startsWith('arc:') && tag !== 'arc:story'))
  ) || bedsideNotes[0];

  const scopedBedsideNotes = [
    { label: 'Project plan', note: projectNote },
    activeArcId ? { label: `Arc plan (${arcNames[activeArcId] || activeArcId})`, note: arcNote } : null,
    activeChapterId
      ? { label: `Chapter plan (${chapterNames[activeChapterId] || activeChapterId})`, note: chapterNote }
      : null,
  ].filter(Boolean) as { label: string; note?: MemoryNote }[];

  // Author preferences
  if (memories.author.length > 0) {
    lines.push('## Author Preferences');
    for (const note of memories.author) {
      const tags = note.topicTags.length > 0 ? ` [${note.topicTags.join(', ')}]` : '';
      lines.push(`- (${note.type})${tags}: ${note.text}`);
    }
    lines.push('');
  }

  // Project notes
  if (memories.project.length > 0) {
    lines.push('## Project Memory');

    if (scopedBedsideNotes.length > 0) {
      lines.push('### Bedside Notes');
      for (const entry of scopedBedsideNotes) {
        if (entry.note) {
          const tags = entry.note.topicTags.length > 0 ? ` [${entry.note.topicTags.join(', ')}]` : '';
          lines.push(`- ${entry.label}${tags}: ${entry.note.text}`);
        }
      }
      lines.push('');
    }

    if (otherProjectNotes.length > 0) {
      lines.push('### Other Project Notes');
      for (const note of otherProjectNotes) {
        const tags = note.topicTags.length > 0 ? ` [${note.topicTags.join(', ')}]` : '';
        lines.push(`- (${note.type})${tags}: ${note.text}`);
      }
    }
  }

  let result = lines.join('\n');

  // Truncate if too long
  if (result.length > maxLength) {
    result = result.slice(0, maxLength - 3) + '...';
  }

  return result;
}

/**
 * Format goals into a string suitable for agent prompts.
 */
export function formatGoalsForPrompt(goals: AgentGoal[]): string {
  if (goals.length === 0) return '';

  const lines = ['## Active Goals'];
  for (const goal of goals) {
    lines.push(`- [${goal.progress}%] ${goal.title}${goal.description ? `: ${goal.description}` : ''}`);
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────────
// PROACTIVE SUGGESTIONS
// ────────────────────────────────────────────────────────────────────────────────

export * from './proactive';

// ────────────────────────────────────────────────────────────────────────────────
// AUTO-OBSERVATION
// ────────────────────────────────────────────────────────────────────────────────

export * from './autoObserver';

// ────────────────────────────────────────────────────────────────────────────────
// CONSOLIDATION & LIFECYCLE
// ────────────────────────────────────────────────────────────────────────────────

export * from './consolidation';

// ────────────────────────────────────────────────────────────────────────────────
// SESSION TRACKING
// ────────────────────────────────────────────────────────────────────────────────

export * from './sessionTracker';
export * from './sessionLifecycle';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 3A: SEMANTIC DEDUPLICATION
// ────────────────────────────────────────────────────────────────────────────────

export * from './semanticDedup';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 3B: MEMORY CHAINS
// ────────────────────────────────────────────────────────────────────────────────

export * from './chains';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 3C: REALTIME TRIGGERS
// ────────────────────────────────────────────────────────────────────────────────

export * from './realtimeTriggers';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 3D: GOAL DEPENDENCY GRAPH
// ────────────────────────────────────────────────────────────────────────────────

export * from './goalGraph';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 4A: FACT EXTRACTION
// ────────────────────────────────────────────────────────────────────────────────

export * from './factExtractor';

// ────────────────────────────────────────────────────────────────────────────────
// ENHANCEMENT 5B: MEMORY CACHE
// ────────────────────────────────────────────────────────────────────────────────

export * from './cache';
