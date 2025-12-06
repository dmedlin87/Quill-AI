/**
 * Session Memory Tracker
 * 
 * Tracks memories created during the current chat session.
 * Solves the "stale context" problem where the system prompt snapshot
 * doesn't reflect memories created after session initialization.
 * 
 * Usage:
 * - Call `trackSessionMemory()` when agent creates a memory via tools
 * - Call `getSessionMemorySummary()` to get a summary for tool responses
 * - Call `clearSessionMemories()` when session resets
 * - Call `shouldRefreshContext()` to check if full context rebuild is warranted
 */

import { MemoryNote } from './types';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface SessionMemoryState {
  /** Memories created during this session */
  created: MemoryNote[];
  /** Memories updated during this session */
  updated: { id: string; changes: string }[];
  /** Memories deleted during this session */
  deleted: string[];
  /** Goals created during this session */
  goalsCreated: string[];
  /** Session start timestamp */
  startedAt: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────────────────

let sessionState: SessionMemoryState = createEmptyState();

function createEmptyState(): SessionMemoryState {
  return {
    created: [],
    updated: [],
    deleted: [],
    goalsCreated: [],
    startedAt: Date.now(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TRACKING
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Track a newly created memory in the current session.
 */
export function trackSessionMemory(memory: MemoryNote): void {
  // Replace existing entry with same id to keep snapshot accurate
  const existingIndex = sessionState.created.findIndex(m => m.id === memory.id);
  if (existingIndex >= 0) {
    sessionState.created[existingIndex] = memory;
    return;
  }
  sessionState.created.push(memory);
}

/**
 * Track a memory update in the current session.
 */
export function trackSessionMemoryUpdate(id: string, description: string): void {
  sessionState.updated.push({ id, changes: description });
}

/**
 * Track a memory deletion in the current session.
 */
export function trackSessionMemoryDelete(id: string): void {
  if (!sessionState.deleted.includes(id)) {
    sessionState.deleted.push(id);
  }
  // Also remove from created if it was created this session
  sessionState.created = sessionState.created.filter(m => m.id !== id);
}

/**
 * Track a goal creation in the current session.
 */
export function trackSessionGoal(goalId: string): void {
  if (!sessionState.goalsCreated.includes(goalId)) {
    sessionState.goalsCreated.push(goalId);
  }
}

/**
 * Clear all session tracking (call when session resets).
 */
export function clearSessionMemories(): void {
  sessionState = createEmptyState();
}

// ──────────────────────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get current session state.
 */
export function getSessionState(): Readonly<SessionMemoryState> {
  return {
    ...sessionState,
    created: [...sessionState.created],
    updated: [...sessionState.updated],
    deleted: [...sessionState.deleted],
    goalsCreated: [...sessionState.goalsCreated],
  };
}

/**
 * Get count of memories created this session.
 */
export function getSessionMemoryCount(): number {
  return sessionState.created.length;
}

/**
 * Check if context refresh is warranted based on session activity.
 * Returns true if significant changes have occurred.
 */
export function shouldRefreshContext(threshold: number = 5): boolean {
  const totalChanges = 
    sessionState.created.length + 
    sessionState.updated.length + 
    sessionState.deleted.length +
    sessionState.goalsCreated.length;
  
  return totalChanges >= threshold;
}

/**
 * Get a summary of session memory activity for tool responses.
 * This helps the agent know what it has saved without needing full context rebuild.
 */
export function getSessionMemorySummary(): string {
  if (sessionState.created.length === 0 && 
      sessionState.updated.length === 0 &&
      sessionState.goalsCreated.length === 0) {
    return '';
  }

  const lines: string[] = [];
  
  if (sessionState.created.length > 0) {
    lines.push(`[Session: ${sessionState.created.length} memories created]`);
    // Show last 3 for brevity
    const recent = sessionState.created.slice(-3);
    for (const mem of recent) {
      const preview = mem.text.slice(0, 60) + (mem.text.length > 60 ? '...' : '');
      lines.push(`  - ${mem.type}: "${preview}" [${mem.topicTags.slice(0, 2).join(', ')}]`);
    }
    if (sessionState.created.length > 3) {
      lines.push(`  - ...and ${sessionState.created.length - 3} more`);
    }
  }

  if (sessionState.goalsCreated.length > 0) {
    lines.push(`[Session: ${sessionState.goalsCreated.length} goals created]`);
  }

  if (sessionState.updated.length > 0) {
    lines.push(`[Session: ${sessionState.updated.length} memories updated]`);
  }

  return lines.join('\n');
}

/**
 * Format a rich tool response that includes session context.
 * Use this to make tool responses more informative.
 */
export function enrichToolResponse(baseResponse: string, includeSessionSummary: boolean = true): string {
  if (!includeSessionSummary) return baseResponse;
  
  const summary = getSessionMemorySummary();
  if (!summary) return baseResponse;
  
  return `${baseResponse}\n\n${summary}`;
}

/**
 * Get memories created this session that match certain criteria.
 * Useful for finding related session memories during tool execution.
 */
export function findSessionMemoriesByTag(tag: string): MemoryNote[] {
  return sessionState.created.filter(m => 
    m.topicTags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
  );
}

/**
 * Check if a similar memory was already created this session.
 * Helps prevent duplicate tool calls from creating redundant memories.
 */
export function hasRecentSimilarMemory(text: string, threshold: number = 0.7): boolean {
  const words = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  for (const memory of sessionState.created) {
    const memWords = new Set(memory.text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const intersection = [...words].filter(w => memWords.has(w)).length;
    const union = new Set([...words, ...memWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    
    if (similarity >= threshold) return true;
  }
  
  return false;
}
