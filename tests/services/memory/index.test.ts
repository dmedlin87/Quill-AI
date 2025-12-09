import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addGoal,
  updateGoal,
  getActiveGoals,
  getGoals,
  getGoal,
  deleteGoal,
  completeGoal,
  abandonGoal,
  addWatchedEntity,
  getWatchedEntities,
  updateWatchedEntity,
  removeWatchedEntity,
  isEntityWatched,
  formatMemoriesForPrompt,
  formatGoalsForPrompt,
} from '@/services/memory';
import { db } from '@/services/db';
import type { MemoryNote, AgentGoal } from '@/services/memory/types';

vi.mock('@/services/db', () => ({
  db: {
    goals: {
      add: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
    watchedEntities: {
      add: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
      })),
    },
  },
}));

vi.mock('@/services/memory/chains', () => ({
  getOrCreateBedsideNote: vi.fn(() => Promise.resolve(null)),
  evolveBedsideNote: vi.fn(() => Promise.resolve()),
}));

describe('services/memory/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatMemoriesForPrompt', () => {
    const baseNote: MemoryNote = {
      id: 'note-1',
      scope: 'project',
      projectId: 'proj-1',
      type: 'fact',
      text: 'Test note',
      topicTags: [],
      importance: 1,
      createdAt: Date.now(),
    };

    it('returns empty string for empty memories', () => {
      const result = formatMemoriesForPrompt({ author: [], project: [] });
      expect(result).toBe('');
    });

    it('formats author preferences section', () => {
      const authorNote = { ...baseNote, topicTags: ['pacing'] };
      const result = formatMemoriesForPrompt({ author: [authorNote], project: [] });

      expect(result).toContain('## Author Preferences');
      expect(result).toContain('(fact)');
      expect(result).toContain('[pacing]');
      expect(result).toContain('Test note');
    });

    it('formats author notes without tags', () => {
      const authorNote = { ...baseNote, topicTags: [] };
      const result = formatMemoriesForPrompt({ author: [authorNote], project: [] });

      expect(result).toContain('- (fact): Test note');
    });

    it('formats project memory with bedside notes', () => {
      const bedsideNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note'],
        text: 'Project plan note',
      };

      const result = formatMemoriesForPrompt({ author: [], project: [bedsideNote] });

      expect(result).toContain('## Project Memory');
      expect(result).toContain('### Bedside Notes');
      expect(result).toContain('Project plan');
    });

    it('formats chapter-scoped bedside notes', () => {
      const chapterNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'chapter:ch-1'],
        text: 'Chapter specific note',
      };

      const result = formatMemoriesForPrompt(
        { author: [], project: [chapterNote] },
        { activeChapterId: 'ch-1', chapterNames: { 'ch-1': 'Chapter One' } }
      );

      expect(result).toContain('Chapter plan (Chapter One)');
    });

    it('formats arc-scoped bedside notes', () => {
      const arcNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'arc:arc-1'],
        text: 'Arc specific note',
      };

      const result = formatMemoriesForPrompt(
        { author: [], project: [arcNote] },
        { activeArcId: 'arc-1', arcNames: { 'arc-1': 'Rising Action' } }
      );

      expect(result).toContain('Arc plan (Rising Action)');
    });

    it('uses id as fallback when name not found', () => {
      const chapterNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'chapter:ch-1'],
        text: 'Chapter note',
      };

      const result = formatMemoriesForPrompt(
        { author: [], project: [chapterNote] },
        { activeChapterId: 'ch-1' }
      );

      expect(result).toContain('Chapter plan (ch-1)');
    });

    it('formats other project notes separately', () => {
      const regularNote: MemoryNote = {
        ...baseNote,
        text: 'Regular project note',
        topicTags: ['character'],
      };

      const result = formatMemoriesForPrompt({ author: [], project: [regularNote] });

      expect(result).toContain('### Other Project Notes');
      expect(result).toContain('Regular project note');
    });

    it('truncates result when exceeding maxLength', () => {
      const longNote: MemoryNote = {
        ...baseNote,
        text: 'A'.repeat(3000),
      };

      const result = formatMemoriesForPrompt(
        { author: [longNote], project: [] },
        { maxLength: 100 }
      );

      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.endsWith('...')).toBe(true);
    });

    it('handles notes with empty topicTags in scoped notes', () => {
      const bedsideNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note'],
        text: 'General bedside note',
      };

      const result = formatMemoriesForPrompt(
        { author: [], project: [bedsideNote] },
        { activeChapterId: 'ch-1', activeArcId: 'arc-1' }
      );

      expect(result).toContain('Project plan');
    });

    it('handles project note matching arc:story tag', () => {
      const storyArcNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'arc:story'],
        text: 'Story arc note',
      };

      const result = formatMemoriesForPrompt({ author: [], project: [storyArcNote] });

      expect(result).toContain('Project plan');
    });

    it('includes notes with both bedside_note and other tags', () => {
      const mixedNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'chapter:ch-1', 'extra-tag'],
        text: 'Mixed note',
      };

      const result = formatMemoriesForPrompt(
        { author: [], project: [mixedNote] },
        { activeChapterId: 'ch-1' }
      );

      expect(result).toContain('Mixed note');
    });

    it('skips bedside note entry when note is undefined', () => {
      const bedsideNote: MemoryNote = {
        ...baseNote,
        topicTags: ['meta:bedside-note', 'chapter:ch-1'],
        text: 'Chapter note',
      };

      // Active arc is set but no arc note exists
      const result = formatMemoriesForPrompt(
        { author: [], project: [bedsideNote] },
        { activeChapterId: 'ch-1', activeArcId: 'arc-1' }
      );

      // Should still render chapter note but not arc note line
      expect(result).toContain('Chapter plan');
      expect(result).not.toContain('Arc plan');
    });
  });

  describe('formatGoalsForPrompt', () => {
    it('returns empty string for empty goals', () => {
      const result = formatGoalsForPrompt([]);
      expect(result).toBe('');
    });

    it('formats goals with progress and description', () => {
      const goals: AgentGoal[] = [
        {
          id: 'g1',
          projectId: 'p1',
          title: 'Finish chapter',
          description: 'Complete the opening scene',
          status: 'active',
          progress: 50,
          createdAt: Date.now(),
        },
      ];

      const result = formatGoalsForPrompt(goals);

      expect(result).toContain('## Active Goals');
      expect(result).toContain('[50%] Finish chapter: Complete the opening scene');
    });

    it('formats goals without description', () => {
      const goals: AgentGoal[] = [
        {
          id: 'g1',
          projectId: 'p1',
          title: 'Review plot',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ];

      const result = formatGoalsForPrompt(goals);

      expect(result).toContain('[0%] Review plot');
      expect(result).not.toContain(':');
    });

    it('formats multiple goals', () => {
      const goals: AgentGoal[] = [
        {
          id: 'g1',
          projectId: 'p1',
          title: 'Goal one',
          status: 'active',
          progress: 25,
          createdAt: Date.now(),
        },
        {
          id: 'g2',
          projectId: 'p1',
          title: 'Goal two',
          description: 'With description',
          status: 'active',
          progress: 75,
          createdAt: Date.now(),
        },
      ];

      const result = formatGoalsForPrompt(goals);

      expect(result).toContain('[25%] Goal one');
      expect(result).toContain('[75%] Goal two: With description');
    });
  });

  describe('getGoals with status filter', () => {
    it('filters by status when provided', async () => {
      const mockGoals: AgentGoal[] = [
        {
          id: 'g1',
          projectId: 'p1',
          title: 'Active goal',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
        {
          id: 'g2',
          projectId: 'p1',
          title: 'Completed goal',
          status: 'completed',
          progress: 100,
          createdAt: Date.now(),
        },
      ];

      (db.goals.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          filter: vi.fn((predicate: any) => ({
            toArray: vi.fn(() => Promise.resolve(mockGoals.filter(predicate))),
          })),
          toArray: vi.fn(() => Promise.resolve(mockGoals)),
        })),
      });

      const active = await getGoals('p1', 'active');
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('active');
    });

    it('returns all goals when status not provided', async () => {
      const mockGoals: AgentGoal[] = [
        {
          id: 'g1',
          projectId: 'p1',
          title: 'Goal',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ];

      (db.goals.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          filter: vi.fn((predicate: any) => ({
            toArray: vi.fn(() => Promise.resolve(mockGoals.filter(predicate))),
          })),
          toArray: vi.fn(() => Promise.resolve(mockGoals)),
        })),
      });

      const all = await getGoals('p1');
      expect(all).toHaveLength(1);
    });
  });

  describe('watched entities with monitoringEnabled', () => {
    it('defaults monitoringEnabled to true on add', async () => {
      let addedEntity: any;
      (db.watchedEntities.add as any).mockImplementation((entity: any) => {
        addedEntity = entity;
        return Promise.resolve();
      });

      await addWatchedEntity({
        projectId: 'p1',
        name: 'Alice',
        priority: 'high',
        reason: 'Test',
      });

      expect(addedEntity.monitoringEnabled).toBe(true);
    });

    it('respects explicit monitoringEnabled on add', async () => {
      let addedEntity: any;
      (db.watchedEntities.add as any).mockImplementation((entity: any) => {
        addedEntity = entity;
        return Promise.resolve();
      });

      await addWatchedEntity({
        projectId: 'p1',
        name: 'Bob',
        priority: 'high',
        reason: 'Test',
        monitoringEnabled: false,
      });

      expect(addedEntity.monitoringEnabled).toBe(false);
    });

    it('getWatchedEntities defaults undefined monitoringEnabled to true', async () => {
      const entitiesWithoutFlag = [
        { id: 'e1', projectId: 'p1', name: 'Alice', priority: 'high', createdAt: Date.now() },
      ];

      (db.watchedEntities.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(entitiesWithoutFlag)),
        })),
      });

      const entities = await getWatchedEntities('p1');
      expect(entities[0].monitoringEnabled).toBe(true);
    });

    it('updateWatchedEntity preserves monitoringEnabled when not in updates', async () => {
      const existing = {
        id: 'e1',
        projectId: 'p1',
        name: 'Alice',
        priority: 'high' as const,
        reason: 'Test',
        monitoringEnabled: false,
        createdAt: Date.now(),
      };

      (db.watchedEntities.get as any).mockResolvedValue(existing);
      let updatedEntity: any;
      (db.watchedEntities.put as any).mockImplementation((entity: any) => {
        updatedEntity = entity;
        return Promise.resolve();
      });

      await updateWatchedEntity('e1', { name: 'Alice Updated' });

      expect(updatedEntity.monitoringEnabled).toBe(false);
    });

    it('updateWatchedEntity uses updates.monitoringEnabled when provided', async () => {
      const existing = {
        id: 'e1',
        projectId: 'p1',
        name: 'Alice',
        priority: 'high' as const,
        reason: 'Test',
        monitoringEnabled: false,
        createdAt: Date.now(),
      };

      (db.watchedEntities.get as any).mockResolvedValue(existing);
      let updatedEntity: any;
      (db.watchedEntities.put as any).mockImplementation((entity: any) => {
        updatedEntity = entity;
        return Promise.resolve();
      });

      await updateWatchedEntity('e1', { monitoringEnabled: true });

      expect(updatedEntity.monitoringEnabled).toBe(true);
    });

    it('updateWatchedEntity defaults to true when both existing and update are undefined', async () => {
      const existing = {
        id: 'e1',
        projectId: 'p1',
        name: 'Alice',
        priority: 'high' as const,
        reason: 'Test',
        createdAt: Date.now(),
        // monitoringEnabled is undefined
      };

      (db.watchedEntities.get as any).mockResolvedValue(existing);
      let updatedEntity: any;
      (db.watchedEntities.put as any).mockImplementation((entity: any) => {
        updatedEntity = entity;
        return Promise.resolve();
      });

      await updateWatchedEntity('e1', { name: 'Updated' });

      expect(updatedEntity.monitoringEnabled).toBe(true);
    });

    it('updateWatchedEntity throws when entity not found', async () => {
      (db.watchedEntities.get as any).mockResolvedValue(undefined);

      await expect(updateWatchedEntity('nonexistent', {})).rejects.toThrow(
        'Watched entity not found: nonexistent'
      );
    });
  });

  describe('isEntityWatched', () => {
    it('returns true when entity is in watchlist', async () => {
      (db.watchedEntities.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([{ id: 'e1', monitoringEnabled: true }])),
        })),
      });

      const result = await isEntityWatched('p1', 'e1');
      expect(result).toBe(true);
    });

    it('returns false when entity is not in watchlist', async () => {
      (db.watchedEntities.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([{ id: 'e2', monitoringEnabled: true }])),
        })),
      });

      const result = await isEntityWatched('p1', 'e1');
      expect(result).toBe(false);
    });
  });

  describe('goal CRUD operations', () => {
    it('addGoal defaults progress to 0', async () => {
      let addedGoal: any;
      (db.goals.add as any).mockImplementation((goal: any) => {
        addedGoal = goal;
        return Promise.resolve();
      });

      await addGoal({
        projectId: 'p1',
        title: 'New Goal',
        status: 'active',
      });

      expect(addedGoal.progress).toBe(0);
    });

    it('addGoal uses provided progress', async () => {
      let addedGoal: any;
      (db.goals.add as any).mockImplementation((goal: any) => {
        addedGoal = goal;
        return Promise.resolve();
      });

      await addGoal({
        projectId: 'p1',
        title: 'New Goal',
        status: 'active',
        progress: 50,
      });

      expect(addedGoal.progress).toBe(50);
    });

    it('updateGoal throws when goal not found', async () => {
      (db.goals.get as any).mockResolvedValue(undefined);

      await expect(updateGoal('nonexistent', {})).rejects.toThrow('Goal not found: nonexistent');
    });

    it('updateGoal updates and adds updatedAt', async () => {
      const existing: AgentGoal = {
        id: 'g1',
        projectId: 'p1',
        title: 'Goal',
        status: 'active',
        progress: 0,
        createdAt: Date.now(),
      };

      (db.goals.get as any).mockResolvedValue(existing);
      let updatedGoal: any;
      (db.goals.put as any).mockImplementation((goal: any) => {
        updatedGoal = goal;
        return Promise.resolve();
      });

      await updateGoal('g1', { progress: 75 });

      expect(updatedGoal.progress).toBe(75);
      expect(updatedGoal.updatedAt).toBeDefined();
    });

    it('completeGoal sets status and progress to 100', async () => {
      const existing: AgentGoal = {
        id: 'g1',
        projectId: 'p1',
        title: 'Goal',
        status: 'active',
        progress: 50,
        createdAt: Date.now(),
      };

      (db.goals.get as any).mockResolvedValue(existing);
      let updatedGoal: any;
      (db.goals.put as any).mockImplementation((goal: any) => {
        updatedGoal = goal;
        return Promise.resolve();
      });

      (db.goals.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      });

      await completeGoal('g1');

      expect(updatedGoal.status).toBe('completed');
      expect(updatedGoal.progress).toBe(100);
    });

    it('abandonGoal sets status to abandoned', async () => {
      const existing: AgentGoal = {
        id: 'g1',
        projectId: 'p1',
        title: 'Goal',
        status: 'active',
        progress: 50,
        createdAt: Date.now(),
      };

      (db.goals.get as any).mockResolvedValue(existing);
      let updatedGoal: any;
      (db.goals.put as any).mockImplementation((goal: any) => {
        updatedGoal = goal;
        return Promise.resolve();
      });

      (db.goals.where as any).mockReturnValue({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      });

      await abandonGoal('g1');

      expect(updatedGoal.status).toBe('abandoned');
    });
  });
});
