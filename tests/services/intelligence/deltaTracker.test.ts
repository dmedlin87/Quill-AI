import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeHistory,
  createDelta,
  createEmptyDelta,
  detectChanges,
  detectNewPromises,
  detectResolvedPromises,
  getAffectedEntities,
  getInvalidatedSections,
  hasContentChanged,
  hashContent,
  mergeDeltas,
} from '../../../services/intelligence/deltaTracker';
import { ChangeType, EntityGraph, Timeline } from '../../../types/intelligence';

const buildEntityGraph = (offsets: number[]): EntityGraph => ({
  nodes: offsets.map((offset, index) => ({
    id: `entity-${index + 1}`,
    name: `Entity ${index + 1}`,
    type: 'character',
    mentions: [
      {
        id: `mention-${index + 1}`,
        offset,
        length: 5,
        context: 'context',
      },
    ],
  })),
  edges: [],
});

const buildTimeline = (promises: Array<{ id: string; offset: number; resolved?: boolean }>): Timeline => ({
  events: [],
  promises: promises.map(promise => ({
    id: promise.id,
    description: promise.id,
    offset: promise.offset,
    resolved: promise.resolved ?? false,
  })),
});

describe('hashing helpers', () => {
  it('produces deterministic hashes and detects changes', () => {
    const text = 'hello world';
    const hash = hashContent(text);

    expect(hash).toBe(hashContent(text));
    expect(hasContentChanged(hash, text)).toBe(false);
    expect(hasContentChanged(hash, `${text}!`)).toBe(true);
  });
});

describe('detectChanges', () => {
  it('returns no changes when texts match', () => {
    const result = detectChanges('same', 'same');

    expect(result).toEqual({ changes: [], hasChanges: false });
  });

  it('detects pure insertion and deletion', () => {
    const inserted = detectChanges('', 'abc');
    expect(inserted.hasChanges).toBe(true);
    expect(inserted.changes).toEqual([
      expect.objectContaining({ start: 0, end: 3, changeType: 'insert' satisfies ChangeType }),
    ]);

    const deleted = detectChanges('abc', '');
    expect(deleted.hasChanges).toBe(true);
    expect(deleted.changes).toEqual([
      expect.objectContaining({ start: 0, end: 3, changeType: 'delete' satisfies ChangeType }),
    ]);
  });

  it('detects modification with prefix and suffix trimming', () => {
    const result = detectChanges('The quick fox', 'The quick brown fox');

    expect(result.hasChanges).toBe(true);
    expect(result.changes[0]).toMatchObject({
      start: 10,
      changeType: 'insert',
      newText: 'brown ',
    });
  });
});

describe('invalidation helpers', () => {
  it('includes neighboring sections when invalidating', () => {
    const changes = [
      { start: 450, end: 650, changeType: 'modify' as ChangeType, timestamp: 1 },
      { start: 1200, end: 1300, changeType: 'insert' as ChangeType, timestamp: 1 },
    ];

    const invalidated = getInvalidatedSections(changes, 1500);

    expect(invalidated).toEqual(expect.arrayContaining(['section_0', 'section_1', 'section_2']));
  });

  it('finds entities with mentions near the change', () => {
    const entities = buildEntityGraph([25, 1200]);
    const changes = [
      { start: 0, end: 10, changeType: 'insert' as ChangeType, timestamp: 1, newText: 'hello' },
      { start: 1150, end: 1160, changeType: 'modify' as ChangeType, timestamp: 1, newText: 'world' },
    ];

    expect(getAffectedEntities(changes, entities)).toEqual(['entity-1', 'entity-2']);
  });
});

describe('promise detection', () => {
  it('detects new plot promises inside inserted text', () => {
    const changes = [
      { start: 0, end: 0, changeType: 'insert' as ChangeType, timestamp: 1, newText: 'Little did Ava know, she would soon discover the truth.' },
    ];

    const promises = detectNewPromises(changes, '');

    expect(promises).toEqual([
      expect.stringContaining('Little did Ava know'),
      expect.stringContaining('would soon discover'),
    ]);
  });

  it('detects resolved promises when resolution text appears after promise offset', () => {
    const changes = [
      { start: 200, end: 210, changeType: 'modify' as ChangeType, timestamp: 1, newText: 'the truth was revealed at last' },
    ];

    const timeline = buildTimeline([
      { id: 'promise-1', offset: 50, resolved: false },
      { id: 'promise-2', offset: 500, resolved: false },
    ]);

    const resolved = detectResolvedPromises(changes, timeline);
    expect(resolved).toEqual(['promise-1']);
  });
});

describe('delta creation', () => {
  const entities = buildEntityGraph([5]);
  const timeline = buildTimeline([{ id: 'p1', offset: 0 }]);

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty delta when there are no changes', () => {
    const delta = createDelta('text', 'text', entities, timeline);

    expect(delta).toMatchObject({
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: hashContent('text'),
      processedAt: 1234567890,
    });
  });

  it('includes derived metadata when text changes', () => {
    const delta = createDelta('old text', 'Little did Mia know', entities, timeline);

    expect(delta.changedRanges).not.toHaveLength(0);
    expect(delta.invalidatedSections).toContain('section_0');
    expect(delta.affectedEntities).toContain('entity-1');
    expect(delta.newPromises.length).toBeGreaterThan(0);
    expect(delta.resolvedPromises).toEqual([]);
    expect(delta.contentHash).toBe(hashContent('Little did Mia know'));
    expect(delta.processedAt).toBe(1234567890);
  });

  it('creates an empty delta snapshot explicitly', () => {
    const delta = createEmptyDelta('draft');

    expect(delta).toMatchObject({
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: hashContent('draft'),
      processedAt: 1234567890,
    });
  });
});

describe('mergeDeltas', () => {
  const base = {
    changedRanges: [
      { start: 0, end: 1, changeType: 'insert' as ChangeType, timestamp: 1, newText: 'a' },
    ],
    invalidatedSections: ['section_0'],
    affectedEntities: ['entity-1'],
    newPromises: ['promise-1'],
    resolvedPromises: [],
    contentHash: 'hash-a',
    processedAt: 1,
  };

  it('returns an empty delta when no deltas are provided', () => {
    const merged = mergeDeltas([]);
    expect(merged).toMatchObject({
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: '',
    });
  });

  it('returns the single delta when only one is provided', () => {
    const merged = mergeDeltas([base]);
    expect(merged).toBe(base);
  });

  it('merges changes, deduplicating sets and using the latest hash', () => {
    const merged = mergeDeltas([
      base,
      {
        ...base,
        changedRanges: [
          { start: 2, end: 3, changeType: 'modify' as ChangeType, timestamp: 2, oldText: 'b', newText: 'c' },
        ],
        invalidatedSections: ['section_1'],
        affectedEntities: ['entity-2'],
        newPromises: ['promise-2'],
        resolvedPromises: ['promise-3'],
        contentHash: 'hash-b',
        processedAt: 2,
      },
    ]);

    expect(merged.changedRanges).toHaveLength(2);
    expect(merged.invalidatedSections.sort()).toEqual(['section_0', 'section_1']);
    expect(new Set(merged.affectedEntities)).toEqual(new Set(['entity-1', 'entity-2']));
    expect(new Set(merged.newPromises)).toEqual(new Set(['promise-1', 'promise-2']));
    expect(merged.resolvedPromises).toEqual(['promise-3']);
    expect(merged.contentHash).toBe('hash-b');
  });
});

describe('ChangeHistory', () => {
  it('tracks recent changes with a bounded history', () => {
    const history = new ChangeHistory(2);
    history.addChanges([
      { start: 0, end: 1, changeType: 'insert' as ChangeType, timestamp: 1, newText: 'a' },
      { start: 1, end: 2, changeType: 'delete' as ChangeType, timestamp: 2, oldText: 'b' },
      { start: 2, end: 3, changeType: 'modify' as ChangeType, timestamp: 3, oldText: 'c', newText: 'd' },
    ]);

    expect(history.length).toBe(2);
    expect(history.getRecent()).toHaveLength(2);
    expect(history.getChangesSince(1)).toHaveLength(2);

    history.clear();
    expect(history.length).toBe(0);
  });
});
