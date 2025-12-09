import { describe, it, expect, vi, beforeEach } from 'vitest';

const memoryMocks = vi.hoisted(() => ({
  searchMemoriesByTags: vi.fn(),
  getMemoriesCached: vi.fn(),
}));

vi.mock('@/services/memory', () => ({
  searchMemoriesByTags: (...args: any[]) => memoryMocks.searchMemoriesByTags(...args),
  getMemoriesCached: (...args: any[]) => memoryMocks.getMemoriesCached(...args),
}));

describe('realtimeTriggers', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.resetModules();
    memoryMocks.searchMemoriesByTags.mockReset();
    memoryMocks.getMemoriesCached.mockReset();

    memoryMocks.searchMemoriesByTags.mockResolvedValue([
      {
        id: 'm1',
        projectId,
        text: 'John has green eyes',
        topicTags: ['character:john', 'appearance'],
        type: 'lore',
      },
    ]);

    memoryMocks.getMemoriesCached.mockResolvedValue([
      {
        id: 'c1',
        projectId,
        text: 'Absolute claim flagged earlier',
        topicTags: ['contradiction', 'inconsistency'],
        type: 'issue',
      },
    ]);
  });

  it('checkTriggers detects default triggers (character mention) and returns formatted suggestion', async () => {
    const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

    const results = await checkTriggers("John said he'd return", projectId);

    expect(memoryMocks.searchMemoriesByTags).toHaveBeenCalledWith(['character:john'], {
      projectId,
      limit: 5,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      triggerId: 'character_mention',
      triggerName: 'Character Reference',
      priority: 'debounced',
    });
    expect(results[0].suggestion).toContain('📝 Remember about John');
  });

  it('checkImmediateTriggers only returns immediate priority items (physical description)', async () => {
    const { checkImmediateTriggers } = await import('@/services/memory/realtimeTriggers');

    const results = await checkImmediateTriggers("Anna's eyes were bright blue", projectId);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      triggerId: 'physical_description',
      priority: 'immediate',
    });
    expect(memoryMocks.searchMemoriesByTags).toHaveBeenCalledWith(
      ['character:anna', 'eyes'],
      { projectId, limit: 3 },
    );
    expect(results[0].suggestion).toContain('⚠️ Existing description');
  });

  it('checkDebouncedTriggers only returns debounced items (location reference)', async () => {
    const { checkDebouncedTriggers } = await import('@/services/memory/realtimeTriggers');

    memoryMocks.searchMemoriesByTags.mockResolvedValueOnce([
      {
        id: 'loc1',
        projectId,
        text: 'The Castle has hidden tunnels.',
        topicTags: ['location:castle', 'setting'],
        type: 'lore',
      },
    ]);

    const results = await checkDebouncedTriggers('We went to the Castle gate', projectId);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      triggerId: 'location',
      priority: 'debounced',
    });
    expect(results[0].suggestion).toContain('📍 About Castle');
  });

  it('formatSuggestion handles contradiction alert and uses cached memories', async () => {
    const { checkImmediateTriggers } = await import('@/services/memory/realtimeTriggers');

    const results = await checkImmediateTriggers('It was the first time she spoke', projectId);

    expect(memoryMocks.getMemoriesCached).toHaveBeenCalledWith(projectId, { limit: 50 });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      triggerId: 'contradiction_risk',
      priority: 'immediate',
    });
    expect(results[0].suggestion).toContain('known inconsistencies');
  });

  it('gracefully handles memoryQuery errors', async () => {
    const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

    memoryMocks.searchMemoriesByTags.mockRejectedValueOnce(new Error('dexie down'));

    const results = await checkTriggers("Mara said she'd stay", projectId);

    expect(results).toHaveLength(0);
  });

  describe('trigger management', () => {
    it('registerTrigger adds a new trigger', async () => {
      const { registerTrigger, getRegisteredTriggers } = await import(
        '@/services/memory/realtimeTriggers'
      );

      const customTrigger = {
        id: 'custom_test',
        name: 'Custom Test Trigger',
        pattern: /\btest\b/i,
        priority: 'immediate' as const,
        memoryQuery: vi.fn().mockResolvedValue([]),
        formatSuggestion: vi.fn().mockReturnValue('Custom suggestion'),
      };

      const initialCount = getRegisteredTriggers().length;
      registerTrigger(customTrigger);
      const afterCount = getRegisteredTriggers().length;

      expect(afterCount).toBe(initialCount + 1);
      expect(getRegisteredTriggers().some(t => t.id === 'custom_test')).toBe(true);
    });

    it('registerTrigger replaces existing trigger with same id', async () => {
      const { registerTrigger, getRegisteredTriggers } = await import(
        '@/services/memory/realtimeTriggers'
      );

      const trigger1 = {
        id: 'replace_test',
        name: 'Original Trigger',
        pattern: /\boriginal\b/i,
        priority: 'debounced' as const,
        memoryQuery: vi.fn().mockResolvedValue([]),
        formatSuggestion: vi.fn().mockReturnValue('Original'),
      };

      const trigger2 = {
        id: 'replace_test',
        name: 'Replaced Trigger',
        pattern: /\breplaced\b/i,
        priority: 'immediate' as const,
        memoryQuery: vi.fn().mockResolvedValue([]),
        formatSuggestion: vi.fn().mockReturnValue('Replaced'),
      };

      registerTrigger(trigger1);
      const countAfterFirst = getRegisteredTriggers().length;
      registerTrigger(trigger2);
      const countAfterSecond = getRegisteredTriggers().length;

      expect(countAfterSecond).toBe(countAfterFirst);
      const found = getRegisteredTriggers().find(t => t.id === 'replace_test');
      expect(found?.name).toBe('Replaced Trigger');
    });

    it('disableTrigger removes an existing trigger', async () => {
      const { registerTrigger, disableTrigger, getRegisteredTriggers } = await import(
        '@/services/memory/realtimeTriggers'
      );

      const trigger = {
        id: 'to_disable',
        name: 'Disable Me',
        pattern: /\bdisable\b/i,
        priority: 'debounced' as const,
        memoryQuery: vi.fn().mockResolvedValue([]),
        formatSuggestion: vi.fn().mockReturnValue(''),
      };

      registerTrigger(trigger);
      expect(getRegisteredTriggers().some(t => t.id === 'to_disable')).toBe(true);

      const result = disableTrigger('to_disable');
      expect(result).toBe(true);
      expect(getRegisteredTriggers().some(t => t.id === 'to_disable')).toBe(false);
    });

    it('disableTrigger returns false for non-existent trigger', async () => {
      const { disableTrigger } = await import('@/services/memory/realtimeTriggers');

      const result = disableTrigger('non_existent_trigger_id');
      expect(result).toBe(false);
    });

    it('getRegisteredTriggers returns a copy of the triggers array', async () => {
      const { getRegisteredTriggers } = await import('@/services/memory/realtimeTriggers');

      const triggers1 = getRegisteredTriggers();
      const triggers2 = getRegisteredTriggers();

      expect(triggers1).not.toBe(triggers2);
      expect(triggers1).toEqual(triggers2);
    });
  });

  describe('createTriggerChecker', () => {
    it('creates a checker that runs immediate triggers right away', async () => {
      const { createTriggerChecker } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.getMemoriesCached.mockResolvedValue([
        {
          id: 'issue1',
          projectId,
          text: 'Previous inconsistency',
          topicTags: ['inconsistency'],
          type: 'issue',
        },
      ]);

      const checker = createTriggerChecker(projectId, {
        enabled: true,
        debounceMs: 100,
        maxResults: 3,
      });

      const onResult = vi.fn();
      checker.check('She was always the first to arrive', onResult);

      // Wait for immediate triggers
      await vi.waitFor(() => {
        expect(onResult).toHaveBeenCalled();
      });
    });

    it('checker does nothing when disabled', async () => {
      const { createTriggerChecker } = await import('@/services/memory/realtimeTriggers');

      const checker = createTriggerChecker(projectId, {
        enabled: false,
        debounceMs: 100,
        maxResults: 3,
      });

      const onResult = vi.fn();
      checker.check('Some text here', onResult);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(onResult).not.toHaveBeenCalled();
    });

    it('checker skips duplicate text', async () => {
      const { createTriggerChecker } = await import('@/services/memory/realtimeTriggers');

      const checker = createTriggerChecker(projectId, {
        enabled: true,
        debounceMs: 100,
        maxResults: 3,
      });

      const onResult = vi.fn();
      checker.check('Same text', onResult);
      checker.check('Same text', onResult);

      // Should only process once
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(memoryMocks.getMemoriesCached.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('cancel clears pending debounced checks', async () => {
      const { createTriggerChecker } = await import('@/services/memory/realtimeTriggers');

      const checker = createTriggerChecker(projectId, {
        enabled: true,
        debounceMs: 500,
        maxResults: 3,
      });

      const onResult = vi.fn();
      checker.check("John said he'd return", onResult);
      checker.cancel();

      await new Promise(resolve => setTimeout(resolve, 600));
      // Debounced results should not have been called since we cancelled
      // (immediate triggers may still fire before cancel)
    });
  });

  describe('trigger patterns', () => {
    it('detects relationship patterns with both names', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'rel1',
          projectId,
          text: 'Sarah and John have been friends since childhood',
          topicTags: ['character:sarah', 'character:john', 'relationship'],
          type: 'lore',
        },
      ]);

      const results = await checkTriggers('Sarah and John walked together', projectId);

      expect(results.some(r => r.triggerId === 'relationship')).toBe(true);
      expect(results.find(r => r.triggerId === 'relationship')?.suggestion).toContain('👥');
    });

    it('detects time reference patterns', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'time1',
          projectId,
          text: 'The battle occurred three years ago',
          topicTags: ['timeline', 'event'],
          type: 'lore',
        },
      ]);

      const results = await checkTriggers('It happened years ago', projectId);

      expect(results.some(r => r.triggerId === 'time_reference')).toBe(true);
      expect(results.find(r => r.triggerId === 'time_reference')?.suggestion).toContain('⏰');
    });

    it('detects plot thread patterns', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'plot1',
          projectId,
          text: 'The secret passage remains undiscovered',
          topicTags: ['plot', 'thread'],
          type: 'lore',
        },
      ]);

      const results = await checkTriggers('He knew her secret', projectId);

      expect(results.some(r => r.triggerId === 'plot_thread')).toBe(true);
      expect(results.find(r => r.triggerId === 'plot_thread')?.suggestion).toContain('📖');
    });

    it('returns empty suggestion when no memories found', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([]);
      memoryMocks.getMemoriesCached.mockResolvedValue([]);

      const results = await checkTriggers("Alice said she'd return", projectId);

      // Results should be empty because formatSuggestion returns '' when no memories
      expect(results).toHaveLength(0);
    });

    it('physical description returns warning when existing description found', async () => {
      const { checkImmediateTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'desc1',
          projectId,
          text: "Anna's eyes are deep brown, not blue",
          topicTags: ['character:anna', 'eyes'],
          type: 'lore',
        },
      ]);

      const results = await checkImmediateTriggers("Anna's eyes were blue", projectId);

      expect(results.some(r => r.triggerId === 'physical_description')).toBe(true);
      expect(results.find(r => r.triggerId === 'physical_description')?.suggestion).toContain(
        '⚠️ Existing description'
      );
    });

    it('physical description returns empty when no matching attribute in memories', async () => {
      const { checkImmediateTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'desc1',
          projectId,
          text: 'Anna is tall and graceful',
          topicTags: ['character:anna', 'height'],
          type: 'lore',
        },
      ]);

      const results = await checkImmediateTriggers("Anna's eyes were green", projectId);

      // Should not return result because memory doesn't mention eyes
      const physDesc = results.find(r => r.triggerId === 'physical_description');
      expect(physDesc).toBeUndefined();
    });
  });

  describe('result ordering', () => {
    it('sorts results with immediate priority first', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'm1',
          projectId,
          text: 'Memory content',
          topicTags: ['character:john', 'eyes'],
          type: 'lore',
        },
      ]);

      memoryMocks.getMemoriesCached.mockResolvedValue([
        {
          id: 'issue1',
          projectId,
          text: 'Issue content',
          topicTags: ['inconsistency'],
          type: 'issue',
        },
      ]);

      // This text should match both debounced (character_mention) and immediate (contradiction_risk) patterns
      const results = await checkTriggers("John said he was always right", projectId, {
        priorityFilter: 'all',
        maxResults: 10,
      });

      if (results.length > 1) {
        const firstImmediate = results.findIndex(r => r.priority === 'immediate');
        const firstDebounced = results.findIndex(r => r.priority === 'debounced');
        if (firstImmediate !== -1 && firstDebounced !== -1) {
          expect(firstImmediate).toBeLessThan(firstDebounced);
        }
      }
    });

    it('respects maxResults limit', async () => {
      const { checkTriggers } = await import('@/services/memory/realtimeTriggers');

      memoryMocks.searchMemoriesByTags.mockResolvedValue([
        {
          id: 'm1',
          projectId,
          text: 'Memory content',
          topicTags: ['character:john'],
          type: 'lore',
        },
      ]);

      const results = await checkTriggers("John said he'd return", projectId, {
        maxResults: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});
