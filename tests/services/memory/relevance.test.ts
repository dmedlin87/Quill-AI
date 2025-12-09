import { describe, it, expect, beforeEach } from 'vitest';
import {
  markLoreEntityDismissed,
  resetLoreEntityTracking,
  filterNovelLoreEntities,
  type LoreEntityCandidate,
} from '../../../services/memory/relevance';
import { EntityNode } from '@/types/intelligence';

describe('Relevance Service', () => {
  beforeEach(() => {
    resetLoreEntityTracking();
  });

  describe('filterNovelLoreEntities', () => {
    it('should return entities that meet the criteria (mentionCount >= 2)', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Hero', type: 'character', mentionCount: 2, importance: 1, relationships: [], metadata: {}, firstMention: 100 },
        { id: '2', name: 'Villain', type: 'character', mentionCount: 1, importance: 1, relationships: [], metadata: {}, firstMention: 200 },
      ];

      const results = filterNovelLoreEntities(entities);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: 'Hero',
        type: 'character',
        firstMention: 100,
      });
    });

    it('should filter out entities that already exist in the graph', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Hero', type: 'character', mentionCount: 2, importance: 1, relationships: [], metadata: {} },
      ];
      const existingNames = ['Hero'];

      const results = filterNovelLoreEntities(entities, existingNames);

      expect(results).toHaveLength(0);
    });

    it('should filter out entities that have been dismissed', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Sidekick', type: 'character', mentionCount: 3, importance: 1, relationships: [], metadata: {} },
      ];

      markLoreEntityDismissed('Sidekick');
      const results = filterNovelLoreEntities(entities);

      expect(results).toHaveLength(0);
    });

    it('should filter out entities that have already been surfaced in the current session', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'City', type: 'location', mentionCount: 2, importance: 1, relationships: [], metadata: {} },
      ];

      // First call surfaces it
      const results1 = filterNovelLoreEntities(entities);
      expect(results1).toHaveLength(1);

      // Second call should filter it out because it's already surfaced
      const results2 = filterNovelLoreEntities(entities);
      expect(results2).toHaveLength(0);
    });

    it('should normalize names for comparison (case-insensitive)', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Castle', type: 'location', mentionCount: 2, importance: 1, relationships: [], metadata: {} },
      ];
      const existingNames = ['castle'];

      const results = filterNovelLoreEntities(entities, existingNames);

      expect(results).toHaveLength(0);
    });

    it('should handle multiple entities correctly', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Alice', type: 'character', mentionCount: 2, importance: 1, relationships: [], metadata: {} },
        { id: '2', name: 'Bob', type: 'character', mentionCount: 1, importance: 1, relationships: [], metadata: {} },
        { id: '3', name: 'Charlie', type: 'character', mentionCount: 3, importance: 1, relationships: [], metadata: {} },
      ];

      markLoreEntityDismissed('Alice');

      const results = filterNovelLoreEntities(entities);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Charlie');
    });
  });

  describe('resetLoreEntityTracking', () => {
    it('should clear dismissed and surfaced entities', () => {
      const entities: EntityNode[] = [
        { id: '1', name: 'Dragon', type: 'character', mentionCount: 2, importance: 1, relationships: [], metadata: {} },
      ];

      markLoreEntityDismissed('Dragon');
      let results = filterNovelLoreEntities(entities);
      expect(results).toHaveLength(0);

      resetLoreEntityTracking();

      results = filterNovelLoreEntities(entities);
      expect(results).toHaveLength(1);
    });
  });
});
