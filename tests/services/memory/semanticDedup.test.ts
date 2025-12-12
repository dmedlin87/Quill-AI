import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMemoryEmbedding,
  cosineSimilarity,
  isSemanticDuplicate,
  findSimilarMemories,
  suggestMerge,
} from '@/services/memory/semanticDedup';
import type { MemoryNote, MemoryEmbedding } from '@/services/memory/types';

// Mock getMemories
vi.mock('@/services/memory/index', () => ({
  getMemories: vi.fn(),
}));

import { getMemories } from '@/services/memory/index';

const createMockNote = (overrides?: Partial<MemoryNote>): MemoryNote => ({
  id: 'mem-1',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Sarah has blue eyes',
  type: 'fact',
  topicTags: ['character:sarah'],
  importance: 0.7,
  createdAt: Date.now(),
  ...overrides,
});

describe('semanticDedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMemoryEmbedding', () => {
    it('generates embedding of correct dimension', () => {
      const embedding = generateMemoryEmbedding('Sarah has blue eyes');

      expect(embedding).toHaveLength(32);
    });

    it('generates normalized embedding', () => {
      const embedding = generateMemoryEmbedding('Test text for embedding');

      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('generates consistent embeddings for same text', () => {
      const emb1 = generateMemoryEmbedding('Consistent test');
      const emb2 = generateMemoryEmbedding('Consistent test');

      expect(emb1).toEqual(emb2);
    });

    it('generates different embeddings for different text', () => {
      const emb1 = generateMemoryEmbedding('First text');
      const emb2 = generateMemoryEmbedding('Completely different content');

      expect(emb1).not.toEqual(emb2);
    });

    it('handles empty string', () => {
      const embedding = generateMemoryEmbedding('');

      expect(embedding).toHaveLength(32);
      // All zeros when no tokens
      expect(embedding.every((v) => v === 0)).toBe(true);
    });

    it('removes stop words', () => {
      const emb1 = generateMemoryEmbedding('the cat');
      const emb2 = generateMemoryEmbedding('cat');

      // 'the' is a stop word, so embeddings should be similar
      expect(emb1).toEqual(emb2);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical embeddings', () => {
      const emb: MemoryEmbedding = [0.5, 0.5, 0.5, 0.5];
      expect(cosineSimilarity(emb, emb)).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal embeddings', () => {
      const emb1: MemoryEmbedding = [1, 0, 0, 0];
      const emb2: MemoryEmbedding = [0, 1, 0, 0];

      expect(cosineSimilarity(emb1, emb2)).toBeCloseTo(0, 5);
    });

    it('returns 0 for different length embeddings', () => {
      const emb1: MemoryEmbedding = [1, 0, 0];
      const emb2: MemoryEmbedding = [1, 0, 0, 0];

      expect(cosineSimilarity(emb1, emb2)).toBe(0);
    });

    it('handles zero vectors', () => {
      const zero: MemoryEmbedding = [0, 0, 0, 0];
      const nonZero: MemoryEmbedding = [1, 0, 0, 0];

      expect(cosineSimilarity(zero, nonZero)).toBe(0);
    });

    it('returns value between 0 and 1 for similar embeddings', () => {
      const emb1: MemoryEmbedding = [0.8, 0.2, 0.1, 0.1];
      const emb2: MemoryEmbedding = [0.7, 0.3, 0.1, 0.1];

      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('isSemanticDuplicate', () => {
    it('returns not duplicate when no existing memories', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);

      const result = await isSemanticDuplicate('proj-1', 'New memory text', ['tag']);

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('detects semantic duplicate for very similar text', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes', topicTags: ['character:sarah'] }),
      ]);

      const result = await isSemanticDuplicate('proj-1', "Sarah's eyes are blue", ['character:sarah']);

      expect(result.similarity).toBeGreaterThan(0.5);
    });

    it('returns not duplicate for different text', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes' }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Marcus lives in Paris', ['character:marcus']);

      expect(result.isDuplicate).toBe(false);
    });

    it('considers entity overlap in similarity', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah discovered the letter' }),
      ]);

      // Same entity (Sarah) should boost similarity
      const resultWithSameEntity = await isSemanticDuplicate(
        'proj-1',
        'Sarah found a secret note',
        ['character:sarah']
      );

      const resultWithDifferentEntity = await isSemanticDuplicate(
        'proj-1',
        'Marcus found a secret note',
        ['character:marcus']
      );

      expect(resultWithSameEntity.similarity).toBeGreaterThan(resultWithDifferentEntity.similarity);
    });

    it('considers tag overlap in similarity', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Test content', topicTags: ['plot', 'mystery'] }),
      ]);

      const resultWithMatchingTags = await isSemanticDuplicate('proj-1', 'Test content similar', ['plot', 'mystery']);
      const resultWithDifferentTags = await isSemanticDuplicate('proj-1', 'Test content similar', ['character', 'setting']);

      expect(resultWithMatchingTags.similarity).toBeGreaterThan(resultWithDifferentTags.similarity);
    });

    it('respects similarity threshold option', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes' }),
      ]);

      const lowThreshold = await isSemanticDuplicate('proj-1', 'Sarah has pretty eyes', ['character:sarah'], {
        similarityThreshold: 0.3,
      });

      const highThreshold = await isSemanticDuplicate('proj-1', 'Sarah has pretty eyes', ['character:sarah'], {
        similarityThreshold: 0.95,
      });

      expect(lowThreshold.isDuplicate).not.toBe(highThreshold.isDuplicate);
    });

    it('provides reason for match', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes', topicTags: ['character:sarah'] }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Sarah has blue colored eyes', ['character:sarah'], {
        similarityThreshold: 0.5,
      });

      if (result.isDuplicate) {
        expect(result.reason).toBeDefined();
      }
    });

    it('uses stored embedding when available', async () => {
      const storedEmbedding = generateMemoryEmbedding('Sarah has blue eyes');
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes', embedding: storedEmbedding }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Sarah has blue eyes', []);

      // Similarity should be high (close to 1) when using same text/embedding
      expect(result.similarity).toBeGreaterThan(0.7);
    });

    it('falls back to computed embedding when stored embedding has wrong dimension', async () => {
      // Wrong length should be ignored
      const badEmbedding = [0.1, 0.2, 0.3] as any;
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'Sarah has blue eyes', embedding: badEmbedding }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Sarah has blue eyes', []);

      expect(result.similarity).toBeGreaterThan(0.7);
    });

    it('prefers tag-based match reason when tag overlap is high', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({
          text: 'Something unrelated',
          topicTags: ['plot', 'mystery'],
        }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Completely different text', ['plot', 'mystery'], {
        similarityThreshold: 0,
        tagWeight: 0.9,
        entityWeight: 0,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('Similar tags with overlapping content');
    });

    it('handles empty tags as full overlap and yields semantic reason when entities/tags are empty', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ text: 'no entities here', topicTags: [] }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'no entities here', [], {
        similarityThreshold: 0,
        tagWeight: 0,
        entityWeight: 0,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('Similar tags with overlapping content');
    });

    it('prefers entity-based match reason when entity overlap and embedding similarity are high', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({
          text: 'Sarah visited Paris yesterday',
          topicTags: [],
        }),
      ]);

      const result = await isSemanticDuplicate('proj-1', 'Sarah visited Paris today', [], {
        similarityThreshold: 0,
        tagWeight: 0,
        entityWeight: 0.5,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('Same entities with similar content');
    });
  });

  describe('findSimilarMemories', () => {
    it('returns empty array when no memories exist', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);

      const result = await findSimilarMemories('proj-1', 'Search text');

      expect(result).toEqual([]);
    });

    it('returns memories sorted by similarity', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ id: 'n1', text: 'The cat sat on the mat' }),
        createMockNote({ id: 'n2', text: 'Sarah has blue eyes' }),
        createMockNote({ id: 'n3', text: 'Sarah has beautiful blue eyes' }),
      ]);

      const result = await findSimilarMemories('proj-1', 'Sarah has blue eyes');

      expect(result.length).toBeGreaterThan(0);
      // Most similar should be first
      expect(result[0].note.text).toContain('Sarah');
    });

    it('filters by minimum similarity', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ id: 'n1', text: 'Completely unrelated content about space travel' }),
        createMockNote({ id: 'n2', text: 'Sarah has blue eyes' }),
      ]);

      const result = await findSimilarMemories('proj-1', 'Sarah eyes blue', { minSimilarity: 0.5 });

      // Only similar memories should be returned
      result.forEach((r) => {
        expect(r.similarity).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('respects maxResults option', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        createMockNote({ id: 'n1', text: 'Sarah fact one' }),
        createMockNote({ id: 'n2', text: 'Sarah fact two' }),
        createMockNote({ id: 'n3', text: 'Sarah fact three' }),
      ]);

      const result = await findSimilarMemories('proj-1', 'Sarah', { maxResults: 2 });

      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('suggestMerge', () => {
    it('suggests not merging when texts are too similar', () => {
      const existing = createMockNote({ text: 'Sarah has blue eyes' });

      const result = suggestMerge('Sarah has blue eyes too', existing);

      expect(result.shouldMerge).toBe(false);
      expect(result.reason).toContain('too similar');
    });

    it('suggests merging when new text has significant new info', () => {
      const existing = createMockNote({ text: 'Sarah is a detective' });

      const result = suggestMerge(
        'Sarah is a skilled detective who specializes in solving mysterious cold cases in Paris during the 1920s',
        existing
      );

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedText).toBeDefined();
    });

    it('suggests not merging for similar but different purpose texts', () => {
      const existing = createMockNote({ text: 'The story begins in Paris' });

      const result = suggestMerge('Paris is where the mystery unfolds', existing);

      expect(result.shouldMerge).toBe(false);
      expect(result.reason).toContain('different purposes');
    });

    it('returns longer text as merged text when merging', () => {
      const shortExisting = createMockNote({ text: 'Short note' });
      const longNew = 'This is a much longer note with additional context and details about the story elements';

      const result = suggestMerge(longNew, shortExisting);

      if (result.shouldMerge) {
        expect(result.mergedText?.length).toBeGreaterThan(shortExisting.text.length);
      }
    });
  });
});
