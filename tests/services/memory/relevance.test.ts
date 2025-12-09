import { describe, it, expect, beforeEach } from 'vitest';
import {
  markLoreEntityDismissed,
  resetLoreEntityTracking,
  filterNovelLoreEntities,
  LoreEntityCandidate
} from '../../../services/memory/relevance';
import { EntityNode } from '../../../types';

describe('Relevance Service', () => {
  beforeEach(() => {
    resetLoreEntityTracking();
  });

  const createEntity = (name: string, count: number): EntityNode => ({
    id: name,
    name,
    type: 'character',
    importance: 1,
    mentionCount: count,
    relationships: [],
    firstMention: 0,
    lastMention: 0,
  });

  it('should filter entities with less than 2 mentions', () => {
    const entities = [
      createEntity('Hero', 5),
      createEntity('Sidekick', 1),
    ];
    const results = filterNovelLoreEntities(entities);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Hero');
  });

  it('should exclude entities already in existing graph', () => {
    const entities = [
      createEntity('Hero', 5),
      createEntity('Villain', 5),
    ];
    const existing = ['Hero'];

    const results = filterNovelLoreEntities(entities, existing);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Villain');
  });

  it('should exclude dismissed entities', () => {
    const entities = [createEntity('Hero', 5)];

    markLoreEntityDismissed('Hero');
    const results = filterNovelLoreEntities(entities);

    expect(results).toHaveLength(0);
  });

  it('should exclude dismissed entities regardless of case', () => {
    const entities = [createEntity('Hero', 5)];

    markLoreEntityDismissed('hero');
    const results = filterNovelLoreEntities(entities);

    expect(results).toHaveLength(0);
  });

  it('should track surfaced entities and exclude them in subsequent calls', () => {
    const entities = [createEntity('Hero', 5)];

    // First call surfaces it
    const results1 = filterNovelLoreEntities(entities);
    expect(results1).toHaveLength(1);

    // Second call should exclude it
    const results2 = filterNovelLoreEntities(entities);
    expect(results2).toHaveLength(0);
  });

  it('should reset tracking', () => {
    const entities = [createEntity('Hero', 5)];

    markLoreEntityDismissed('Hero');
    resetLoreEntityTracking();

    const results = filterNovelLoreEntities(entities);
    expect(results).toHaveLength(1);
  });

  it('should handle normalization of existing graph names', () => {
    const entities = [createEntity('Hero', 5)];
    const existing = ['hero'];

    const results = filterNovelLoreEntities(entities, existing);
    expect(results).toHaveLength(0);
  });
});
