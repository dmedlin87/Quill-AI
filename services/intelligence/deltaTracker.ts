/**
 * Delta Tracker
 * 
 * Diff-aware change tracking and invalidation:
 * - Track text changes over time
 * - Determine which analysis needs re-running
 * - Identify affected entities and promises
 * - Content hashing for quick comparison
 */

import {
  ManuscriptDelta,
  TextChange,
  ChangeType,
  EntityGraph,
  Timeline,
} from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// HASHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple hash function for content comparison
 * Uses djb2 algorithm for speed
 */
export const hashContent = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash = hash & 0xffffffff; // Convert to 32-bit integer
  }
  return hash.toString(16);
};

/**
 * Check if content has changed based on hash
 */
export const hasContentChanged = (
  oldHash: string,
  newText: string
): boolean => {
  return oldHash !== hashContent(newText);
};

// ─────────────────────────────────────────────────────────────────────────────
// DIFF DETECTION
// ─────────────────────────────────────────────────────────────────────────────

interface DiffResult {
  changes: TextChange[];
  hasChanges: boolean;
}

/**
 * Simple diff algorithm to detect changes between two texts
 * Uses a sliding window approach for efficiency
 */
export const detectChanges = (
  oldText: string,
  newText: string
): DiffResult => {
  const changes: TextChange[] = [];
  const timestamp = Date.now();
  
  // Quick check for no changes
  if (oldText === newText) {
    return { changes: [], hasChanges: false };
  }
  
  // Quick check for completely new text
  if (!oldText) {
    changes.push({
      start: 0,
      end: newText.length,
      changeType: 'insert',
      newText: newText,
      timestamp,
    });
    return { changes, hasChanges: true };
  }
  
  // Quick check for deleted text
  if (!newText) {
    changes.push({
      start: 0,
      end: oldText.length,
      changeType: 'delete',
      oldText: oldText,
      timestamp,
    });
    return { changes, hasChanges: true };
  }
  
  // Find common prefix
  let prefixLength = 0;
  const minLength = Math.min(oldText.length, newText.length);
  while (prefixLength < minLength && oldText[prefixLength] === newText[prefixLength]) {
    prefixLength++;
  }
  
  // Find common suffix (not overlapping with prefix)
  let oldSuffixStart = oldText.length;
  let newSuffixStart = newText.length;
  while (
    oldSuffixStart > prefixLength &&
    newSuffixStart > prefixLength &&
    oldText[oldSuffixStart - 1] === newText[newSuffixStart - 1]
  ) {
    oldSuffixStart--;
    newSuffixStart--;
  }
  
  // Extract the changed portions
  const oldChanged = oldText.slice(prefixLength, oldSuffixStart);
  const newChanged = newText.slice(prefixLength, newSuffixStart);
  
  if (oldChanged.length === 0 && newChanged.length > 0) {
    // Pure insertion
    changes.push({
      start: prefixLength,
      end: prefixLength,
      changeType: 'insert',
      newText: newChanged,
      timestamp,
    });
  } else if (oldChanged.length > 0 && newChanged.length === 0) {
    // Pure deletion
    changes.push({
      start: prefixLength,
      end: prefixLength + oldChanged.length,
      changeType: 'delete',
      oldText: oldChanged,
      timestamp,
    });
  } else if (oldChanged.length > 0 && newChanged.length > 0) {
    // Modification
    changes.push({
      start: prefixLength,
      end: prefixLength + oldChanged.length,
      changeType: 'modify',
      oldText: oldChanged,
      newText: newChanged,
      timestamp,
    });
  }
  
  return { changes, hasChanges: changes.length > 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
// INVALIDATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SIZE = 500; // Match heatmap section size

/**
 * Determine which sections need re-analysis based on changes
 */
export const getInvalidatedSections = (
  changes: TextChange[],
  textLength: number
): string[] => {
  const sections = new Set<string>();
  
  for (const change of changes) {
    // Calculate affected section range
    const startSection = Math.floor(change.start / SECTION_SIZE);
    const endSection = Math.floor(change.end / SECTION_SIZE);
    
    // Include adjacent sections as buffer
    for (let i = Math.max(0, startSection - 1); i <= endSection + 1; i++) {
      if (i * SECTION_SIZE < textLength) {
        sections.add(`section_${i}`);
      }
    }
  }
  
  return Array.from(sections);
};

/**
 * Find entities affected by text changes
 */
export const getAffectedEntities = (
  changes: TextChange[],
  entities: EntityGraph
): string[] => {
  const affected = new Set<string>();
  
  for (const change of changes) {
    // Find entities with mentions in the changed range
    for (const entity of entities.nodes) {
      for (const mention of entity.mentions) {
        // Check if mention is within or near the change
        const buffer = 100; // Characters of buffer
        if (
          mention.offset >= change.start - buffer &&
          mention.offset <= change.end + buffer
        ) {
          affected.add(entity.id);
          break;
        }
      }
    }
  }
  
  return Array.from(affected);
};

/**
 * Detect new plot promises introduced by changes
 */
export const detectNewPromises = (
  changes: TextChange[],
  newText: string
): string[] => {
  const newPromises: string[] = [];
  
  // Patterns that indicate new plot promises
  const promisePatterns = [
    /\b(little did \w+ know)/gi,
    /\b(would soon discover)/gi,
    /\b(if only \w+ knew)/gi,
    /\b(\w+ vowed to)/gi,
    /\b(the mystery of)/gi,
    /\b(\w+ must find)/gi,
  ];
  
  for (const change of changes) {
    if (change.changeType === 'insert' || change.changeType === 'modify') {
      const changedText = change.newText || '';

      for (const pattern of promisePatterns) {
        pattern.lastIndex = 0;
        const matches = changedText.match(pattern);
        if (matches) {
          for (const match of matches) {
            newPromises.push(match);
          }
        }
      }
    }
  }
  
  return newPromises;
};

/**
 * Detect resolved promises based on changes
 */
export const detectResolvedPromises = (
  changes: TextChange[],
  timeline: Timeline
): string[] => {
  const resolved: string[] = [];
  
  // Resolution patterns
  const resolutionPatterns = [
    /\b(finally|at last)/gi,
    /\b(the truth was revealed)/gi,
    /\b(now \w+ understood)/gi,
    /\b(mission accomplished)/gi,
    /\b(the mystery was solved)/gi,
  ];
  
  for (const change of changes) {
    if (change.changeType === 'insert' || change.changeType === 'modify') {
      const changedText = change.newText || '';
      
      for (const pattern of resolutionPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(changedText)) {
          // Check if any open promise might be resolved
          for (const promise of timeline.promises.filter(p => !p.resolved)) {
            // Simple heuristic: if resolution is after promise, mark as potentially resolved
            if (change.start > promise.offset) {
              resolved.push(promise.id);
            }
          }
        }
      }
    }
  }
  
  return [...new Set(resolved)];
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a delta object tracking changes between old and new text
 */
export const createDelta = (
  oldText: string,
  newText: string,
  entities: EntityGraph,
  timeline: Timeline
): ManuscriptDelta => {
  const { changes, hasChanges } = detectChanges(oldText, newText);
  
  if (!hasChanges) {
    return {
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: hashContent(newText),
      processedAt: Date.now(),
    };
  }
  
  return {
    changedRanges: changes,
    invalidatedSections: getInvalidatedSections(changes, newText.length),
    affectedEntities: getAffectedEntities(changes, entities),
    newPromises: detectNewPromises(changes, newText),
    resolvedPromises: detectResolvedPromises(changes, timeline),
    contentHash: hashContent(newText),
    processedAt: Date.now(),
  };
};

/**
 * Create an empty delta for initial processing
 */
export const createEmptyDelta = (text: string): ManuscriptDelta => {
  return {
    changedRanges: [],
    invalidatedSections: [],
    affectedEntities: [],
    newPromises: [],
    resolvedPromises: [],
    contentHash: hashContent(text),
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DELTA ACCUMULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge multiple deltas into one (for batching changes)
 */
export const mergeDeltas = (deltas: ManuscriptDelta[]): ManuscriptDelta => {
  if (deltas.length === 0) {
    return {
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: '',
      processedAt: Date.now(),
    };
  }
  
  if (deltas.length === 1) {
    return deltas[0];
  }
  
  // Take the latest content hash
  const latestDelta = deltas[deltas.length - 1];
  
  // Merge all arrays
  const allChanges: TextChange[] = [];
  const allSections = new Set<string>();
  const allEntities = new Set<string>();
  const allNewPromises = new Set<string>();
  const allResolved = new Set<string>();
  
  for (const delta of deltas) {
    allChanges.push(...delta.changedRanges);
    delta.invalidatedSections.forEach(s => allSections.add(s));
    delta.affectedEntities.forEach(e => allEntities.add(e));
    delta.newPromises.forEach(p => allNewPromises.add(p));
    delta.resolvedPromises.forEach(r => allResolved.add(r));
  }
  
  return {
    changedRanges: allChanges,
    invalidatedSections: Array.from(allSections),
    affectedEntities: Array.from(allEntities),
    newPromises: Array.from(allNewPromises),
    resolvedPromises: Array.from(allResolved),
    contentHash: latestDelta.contentHash,
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY_SIZE = 50;

/**
 * Manages a rolling history of changes
 */
export class ChangeHistory {
  private changes: TextChange[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = MAX_HISTORY_SIZE) {
    this.maxSize = maxSize;
  }
  
  addChange(change: TextChange): void {
    this.changes.push(change);
    if (this.changes.length > this.maxSize) {
      this.changes.shift();
    }
  }
  
  addChanges(newChanges: TextChange[]): void {
    for (const change of newChanges) {
      this.addChange(change);
    }
  }
  
  getRecent(count: number = 10): TextChange[] {
    return this.changes.slice(-count);
  }
  
  getChangesSince(timestamp: number): TextChange[] {
    return this.changes.filter(c => c.timestamp > timestamp);
  }
  
  clear(): void {
    this.changes = [];
  }
  
  get length(): number {
    return this.changes.length;
  }
}
