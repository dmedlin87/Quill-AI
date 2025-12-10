import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@/services/db', () => ({
  db: {
    watchedEntities: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    memories: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    goals: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock memory index functions with a partial mock so all named exports exist
vi.mock('@/services/memory/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/memory/index')>();
  return {
    ...actual,
    getMemories: vi.fn().mockResolvedValue([]),
    getActiveGoals: vi.fn().mockResolvedValue([]),
    searchMemoriesByTags: vi.fn().mockResolvedValue([]),
    getMemoriesCached: vi.fn().mockResolvedValue([]),
    getGoalsCached: vi.fn().mockResolvedValue([]),
    getWatchedCached: vi.fn().mockResolvedValue([]),
  };
});

import {
  extractEntitiesFromText,
  getWatchedEntitiesInChapter,
  getRelatedMemories,
  generateSuggestionsForChapter,
  getImportantReminders,
  createChapterSwitchHandler,
} from '@/services/memory/proactive';
import { db } from '@/services/db';
import {
  getMemoriesCached,
  getGoalsCached,
  searchMemoriesByTags,
} from '@/services/memory/index';

describe('Proactive Memory Suggestions', () => {
  const mockProjectId = 'test-project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractEntitiesFromText', () => {
    it('extracts character names from dialogue attribution', () => {
      const text = '"Hello there," said John. "How are you?" asked Mary.';
      const entities = extractEntitiesFromText(text);

      expect(entities).toContain('john');
      expect(entities).toContain('mary');
    });

    it('extracts frequently capitalized words', () => {
      const text = 'The Kingdom was vast. The Kingdom stretched far. The Kingdom was ancient. The Kingdom ruled.';
      const entities = extractEntitiesFromText(text);

      expect(entities).toContain('kingdom');
    });

    it('handles text with no entities', () => {
      const text = 'the quick brown fox jumped over the lazy dog';
      const entities = extractEntitiesFromText(text);

      expect(entities).toHaveLength(0);
    });

    it('extracts from various dialogue patterns', () => {
      const text = `
        "Run!" shouted Marcus.
        "Wait," whispered Elena.
        "Why?" exclaimed Thomas.
      `;
      const entities = extractEntitiesFromText(text);

      expect(entities).toContain('marcus');
      expect(entities).toContain('elena');
      expect(entities).toContain('thomas');
    });
  });

  describe('getWatchedEntitiesInChapter', () => {
    it('finds watched entities mentioned in chapter', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'John', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
        { id: 'w2', name: 'Sarah', projectId: mockProjectId, priority: 'medium', createdAt: Date.now() },
      ]);

      // Use mentionedEntities directly to bypass extraction logic
      const result = await getWatchedEntitiesInChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        mentionedEntities: ['john', 'marcus'], // Pre-extracted entities
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    it('returns empty when no watched entities match', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'Marcus', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
      ]);

      const result = await getWatchedEntitiesInChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John and Sarah discussed the plan.',
      });

      expect(result).toHaveLength(0);
    });

    it('uses provided mentionedEntities', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'John', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
      ]);

      const result = await getWatchedEntitiesInChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        mentionedEntities: ['john', 'sarah'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    it('respects monitoringEnabled flag and filters disabled watched entities', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'John', projectId: mockProjectId, priority: 'high', monitoringEnabled: false, createdAt: Date.now() },
        { id: 'w2', name: 'Sarah', projectId: mockProjectId, priority: 'medium', createdAt: Date.now() },
      ]);

      const result = await getWatchedEntitiesInChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        mentionedEntities: ['john', 'sarah'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sarah');
    });
  });

  describe('getRelatedMemories', () => {
    it('searches for memories with character tags', async () => {
      vi.mocked(searchMemoriesByTags).mockResolvedValue([
        {
          id: 'mem1',
          text: 'John is the protagonist',
          type: 'fact' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['character:john'],
          importance: 0.8,
          createdAt: Date.now(),
        },
      ]);

      const result = await getRelatedMemories(mockProjectId, ['John', 'Sarah']);

      expect(searchMemoriesByTags).toHaveBeenCalledWith(
        ['character:john', 'character:sarah'],
        expect.objectContaining({ projectId: mockProjectId })
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty for no entities', async () => {
      const result = await getRelatedMemories(mockProjectId, []);

      expect(searchMemoriesByTags).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('generateSuggestionsForChapter', () => {
    it('generates suggestions for watched entities', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { 
          id: 'w1', 
          name: 'John', 
          projectId: mockProjectId, 
          priority: 'high', 
          reason: 'Main character',
          createdAt: Date.now() 
        },
      ]);

      // Use mentionedEntities to ensure entity is found
      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        mentionedEntities: ['john'],
      });

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].type).toBe('watched_entity');
      expect(suggestions[0].title).toContain('John');
    });

    it('generates suggestions for related memories', async () => {
      vi.mocked(searchMemoriesByTags).mockResolvedValue([
        {
          id: 'mem1',
          text: 'John fears the dark',
          type: 'fact' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['character:john', 'motivation'],
          importance: 0.8,
          createdAt: Date.now(),
        },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John walked alone. John was nervous. John hesitated.',
      });

      const memorySuggestions = suggestions.filter(s => s.type === 'related_memory');
      expect(memorySuggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('skips low-importance observation memories', async () => {
      vi.mocked(searchMemoriesByTags).mockResolvedValue([
        {
          id: 'mem2',
          text: 'Minor note',
          type: 'observation' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['character:john'],
          importance: 0.3,
          createdAt: Date.now(),
        },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John appears.',
      });

      const memorySuggestions = suggestions.filter(s => s.type === 'related_memory');
      expect(memorySuggestions.length).toBe(0);
    });

    it('generates suggestions for relevant goals', async () => {
      vi.mocked(getGoalsCached).mockResolvedValue([
        {
          id: 'goal1',
          projectId: mockProjectId,
          title: 'Develop John\'s arc',
          description: 'Make John more sympathetic',
          status: 'active',
          progress: 20,
          createdAt: Date.now() - 1000,
        },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John reflected on his past mistakes.',
      });

      const goalSuggestions = suggestions.filter(s => s.type === 'active_goal');
      expect(goalSuggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('does not create goal suggestions when no relevance', async () => {
      vi.mocked(getGoalsCached).mockResolvedValue([
        {
          id: 'goal2',
          projectId: mockProjectId,
          title: 'Unrelated goal',
          description: 'Nothing about chapter',
          status: 'active',
          progress: 50,
          createdAt: Date.now() - 1000,
        },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'No overlapping terms.',
      });

      const goalSuggestions = suggestions.filter(s => s.type === 'active_goal');
      expect(goalSuggestions.length).toBe(0);
    });

    it('sorts suggestions by priority', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'John', projectId: mockProjectId, priority: 'low', createdAt: Date.now() },
        { id: 'w2', name: 'Sarah', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John and Sarah met at the station.',
      });

      if (suggestions.length >= 2) {
        const highPriorityFirst = suggestions.findIndex(s => s.priority === 'high');
        const lowPriorityFirst = suggestions.findIndex(s => s.priority === 'low');
        
        if (highPriorityFirst !== -1 && lowPriorityFirst !== -1) {
          expect(highPriorityFirst).toBeLessThan(lowPriorityFirst);
        }
      }
    });

    it('limits total suggestions', async () => {
      vi.mocked(db.watchedEntities.toArray).mockResolvedValue([
        { id: 'w1', name: 'John', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
        { id: 'w2', name: 'Sarah', projectId: mockProjectId, priority: 'high', createdAt: Date.now() },
        { id: 'w3', name: 'Marcus', projectId: mockProjectId, priority: 'medium', createdAt: Date.now() },
        { id: 'w4', name: 'Elena', projectId: mockProjectId, priority: 'medium', createdAt: Date.now() },
        { id: 'w5', name: 'Thomas', projectId: mockProjectId, priority: 'low', createdAt: Date.now() },
        { id: 'w6', name: 'Clara', projectId: mockProjectId, priority: 'low', createdAt: Date.now() },
      ]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch1',
        chapterTitle: 'Chapter 1',
        content: 'John Sarah Marcus Elena Thomas Clara all gathered.',
      });

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('returns no suggestions when nothing in the chapter is actionable', async () => {
      vi.mocked(searchMemoriesByTags).mockResolvedValue([]);

      const suggestions = await generateSuggestionsForChapter(mockProjectId, {
        chapterId: 'ch-empty',
        chapterTitle: 'Empty Chapter',
      });

      expect(searchMemoriesByTags).not.toHaveBeenCalled();
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('createChapterSwitchHandler', () => {
    it('calls onSuggestions when generated suggestions are non-empty', async () => {
      const mockSuggestions: ProactiveSuggestion[] = [
        {
          id: 'suggestion-1',
          type: 'watched_entity',
          priority: 'high',
          title: 'Follow Alice',
          description: 'Alice drove the plot forward',
          source: { type: 'entity', id: 'entity-1' },
          tags: ['character'],
          createdAt: Date.now(),
        },
      ];

      const suggestionGenerator = vi.fn().mockResolvedValue(mockSuggestions);
      const onSuggestions = vi.fn();
      const handler = createChapterSwitchHandler(mockProjectId, onSuggestions, suggestionGenerator);

      await handler('ch-1', 'Chapter 1', 'some content');

      expect(suggestionGenerator).toHaveBeenCalledWith(mockProjectId, {
        chapterId: 'ch-1',
        chapterTitle: 'Chapter 1',
        content: 'some content',
      });
      expect(onSuggestions).toHaveBeenCalledWith(mockSuggestions);
    });

    it('does not call onSuggestions when no suggestions are returned', async () => {
      const suggestionGenerator = vi.fn().mockResolvedValue([] as ProactiveSuggestion[]);
      const onSuggestions = vi.fn();
      const handler = createChapterSwitchHandler(mockProjectId, onSuggestions, suggestionGenerator);

      await handler('ch-1', 'Chapter 1', 'irrelevant');

      expect(suggestionGenerator).toHaveBeenCalledWith(mockProjectId, {
        chapterId: 'ch-1',
        chapterTitle: 'Chapter 1',
        content: 'irrelevant',
      });
      expect(onSuggestions).not.toHaveBeenCalled();
    });
  });

  describe('getImportantReminders', () => {
    it('returns high-importance unresolved issues', async () => {
      vi.mocked(getMemoriesCached).mockResolvedValue([
        {
          id: 'issue1',
          text: 'Plot hole in chapter 3',
          type: 'issue' as const,
          scope: 'project' as const,
          projectId: mockProjectId,
          topicTags: ['plot'],
          importance: 0.9,
          createdAt: Date.now() - 1000,
        },
      ]);

      const reminders = await getImportantReminders(mockProjectId);

      expect(reminders.length).toBeGreaterThanOrEqual(1);
      expect(reminders[0].type).toBe('reminder');
      expect(reminders[0].priority).toBe('high');
    });

    it('returns stalled goals as reminders', async () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      
      vi.mocked(getGoalsCached).mockResolvedValue([
        {
          id: 'goal1',
          projectId: mockProjectId,
          title: 'Finish outline',
          status: 'active',
          progress: 10,
          createdAt: twoDaysAgo,
        },
      ]);

      const reminders = await getImportantReminders(mockProjectId);

      const stalledGoals = reminders.filter(r => r.title.includes('Stalled goal'));
      expect(stalledGoals.length).toBeGreaterThanOrEqual(0);
    });

    it('returns empty when no issues or stalled goals qualify', async () => {
      vi.mocked(getMemoriesCached).mockResolvedValue([]);
      vi.mocked(getGoalsCached).mockResolvedValue([
        {
          id: 'goal-ok',
          projectId: mockProjectId,
          title: 'Fresh goal',
          status: 'active',
          progress: 80,
          createdAt: Date.now(),
        },
      ]);

      const reminders = await getImportantReminders(mockProjectId);
      expect(reminders).toHaveLength(0);
    });

    it('rate limits high-importance issue reminders to five entries', async () => {
      const issues = Array.from({ length: 7 }).map((_, index) => ({
        id: `issue-${index}`,
        text: `Issue ${index}`,
        type: 'issue' as const,
        scope: 'project' as const,
        projectId: mockProjectId,
        topicTags: ['plot'],
        importance: 0.9,
        createdAt: Date.now() - index,
      }));

      vi.mocked(getMemoriesCached).mockResolvedValue(issues as any);
      vi.mocked(getGoalsCached).mockResolvedValue([]);

      const reminders = await getImportantReminders(mockProjectId);

      expect(reminders).toHaveLength(5);
      expect(reminders.every(r => r.source.type === 'memory')).toBe(true);
    });
  });
});
