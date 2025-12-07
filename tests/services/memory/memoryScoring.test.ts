import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreMemoryRelevance,
  getRelevantMemoriesForContext,
  type MemoryRelevanceOptions,
} from '@/services/memory/memoryScoring';
import type { MemoryNote } from '@/services/memory/types';

// Mock getMemories
vi.mock('@/services/memory/memoryQueries', () => ({
  getMemories: vi.fn(),
}));

import { getMemories } from '@/services/memory/memoryQueries';

const createMockNote = (overrides?: Partial<MemoryNote>): MemoryNote => ({
  id: 'mem-1',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Sarah has blue eyes',
  type: 'fact',
  topicTags: ['character:sarah', 'appearance'],
  importance: 0.7,
  createdAt: Date.now(),
  ...overrides,
});

describe('memoryScoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scoreMemoryRelevance', () => {
    it('returns base importance when no relevance options', () => {
      const note = createMockNote({ importance: 0.8 });
      const score = scoreMemoryRelevance(note, {});

      expect(score).toBe(0.8);
    });

    it('boosts score for matching entity names in tags', () => {
      const note = createMockNote({
        topicTags: ['character:sarah', 'plot'],
        importance: 0.5,
      });

      const score = scoreMemoryRelevance(note, {
        activeEntityNames: ['Sarah'],
      });

      expect(score).toBeGreaterThan(0.5);
    });

    it('boosts score for matching keywords in text', () => {
      const note = createMockNote({
        text: 'The detective found the hidden key',
        importance: 0.5,
      });

      const score = scoreMemoryRelevance(note, {
        selectionKeywords: ['detective', 'key'],
      });

      expect(score).toBeGreaterThan(0.5);
    });

    it('boosts score for active chapter match', () => {
      const note = createMockNote({
        topicTags: ['chapter:intro', 'scene'],
        importance: 0.5,
      });

      const score = scoreMemoryRelevance(note, {
        activeChapterId: 'intro',
      });

      expect(score).toBeGreaterThan(0.5);
    });

    it('combines multiple relevance factors', () => {
      const note = createMockNote({
        text: 'Sarah investigates the mystery',
        topicTags: ['character:sarah', 'chapter:ch1'],
        importance: 0.5,
      });

      const scoreWithOne = scoreMemoryRelevance(note, {
        activeEntityNames: ['Sarah'],
      });

      const scoreWithAll = scoreMemoryRelevance(note, {
        activeEntityNames: ['Sarah'],
        selectionKeywords: ['mystery'],
        activeChapterId: 'ch1',
      });

      expect(scoreWithAll).toBeGreaterThan(scoreWithOne);
    });

    it('handles case-insensitive matching', () => {
      const note = createMockNote({
        topicTags: ['CHARACTER:SARAH'],
        importance: 0.5,
      });

      const score = scoreMemoryRelevance(note, {
        activeEntityNames: ['sarah'],
      });

      expect(score).toBeGreaterThan(0.5);
    });

    it('handles partial entity name matches', () => {
      const note = createMockNote({
        topicTags: ['character:sarah-jane'],
        importance: 0.5,
      });

      const score = scoreMemoryRelevance(note, {
        activeEntityNames: ['sarah'],
      });

      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('getRelevantMemoriesForContext', () => {
    const mockAuthorNotes: MemoryNote[] = [
      createMockNote({ id: 'author-1', scope: 'author', projectId: undefined, text: 'Prefer short sentences' }),
    ];

    const mockProjectNotes: MemoryNote[] = [
      createMockNote({ id: 'proj-1', text: 'Sarah is the protagonist', topicTags: ['character:sarah'], importance: 0.8 }),
      createMockNote({ id: 'proj-2', text: 'Marcus is the villain', topicTags: ['character:marcus'], importance: 0.7 }),
      createMockNote({ id: 'proj-3', text: 'The story is set in Paris', topicTags: ['setting'], importance: 0.6 }),
    ];

    beforeEach(() => {
      vi.mocked(getMemories).mockImplementation(async (params) => {
        if (params?.scope === 'author') return mockAuthorNotes;
        if (params?.scope === 'project') return mockProjectNotes;
        return [];
      });
    });

    it('returns both author and project memories', async () => {
      const result = await getRelevantMemoriesForContext('proj-1');

      expect(result.author).toHaveLength(1);
      expect(result.project.length).toBeGreaterThan(0);
    });

    it('returns unfiltered memories when no relevance criteria', async () => {
      const result = await getRelevantMemoriesForContext('proj-1', {});

      expect(result.project).toEqual(mockProjectNotes.slice(0, 50));
    });

    it('filters and sorts by relevance when criteria provided', async () => {
      const result = await getRelevantMemoriesForContext('proj-1', {
        activeEntityNames: ['Sarah'],
      });

      // Sarah-related memory should be first
      expect(result.project[0].text).toContain('Sarah');
    });

    it('respects limit option', async () => {
      const result = await getRelevantMemoriesForContext('proj-1', {}, { limit: 1 });

      expect(result.project).toHaveLength(1);
    });

    it('falls back to all notes when no relevant matches', async () => {
      const result = await getRelevantMemoriesForContext('proj-1', {
        activeEntityNames: ['NonExistentCharacter'],
        selectionKeywords: ['nonexistent'],
      });

      // Should still return notes (fallback behavior)
      expect(result.project.length).toBeGreaterThan(0);
    });

    it('handles empty project notes', async () => {
      vi.mocked(getMemories).mockImplementation(async (params) => {
        if (params?.scope === 'author') return mockAuthorNotes;
        return [];
      });

      const result = await getRelevantMemoriesForContext('proj-1', {
        activeEntityNames: ['Sarah'],
      });

      expect(result.author).toHaveLength(1);
      expect(result.project).toHaveLength(0);
    });

    it('sorts by relevance, then importance, then recency', async () => {
      const notesWithSameRelevance: MemoryNote[] = [
        createMockNote({ id: 'n1', topicTags: ['character:sarah'], importance: 0.5, createdAt: 1000 }),
        createMockNote({ id: 'n2', topicTags: ['character:sarah'], importance: 0.8, createdAt: 2000 }),
        createMockNote({ id: 'n3', topicTags: ['character:sarah'], importance: 0.8, createdAt: 3000 }),
      ];

      vi.mocked(getMemories).mockImplementation(async (params) => {
        if (params?.scope === 'project') return notesWithSameRelevance;
        return [];
      });

      const result = await getRelevantMemoriesForContext('proj-1', {
        activeEntityNames: ['Sarah'],
      });

      // Higher importance first, then more recent
      expect(result.project[0].id).toBe('n3');
      expect(result.project[1].id).toBe('n2');
    });
  });
});
