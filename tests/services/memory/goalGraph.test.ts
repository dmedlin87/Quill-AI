import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHierarchicalGoal,
  addSubgoal,
  addGoalDependency,
  removeGoalDependency,
  buildGoalGraph,
  getBlockedGoals,
  getActionableGoals,
  getCriticalPath,
  formatGoalHierarchy,
  formatActionableGoals,
  type GoalNode,
  type GoalHierarchy,
} from '@/services/memory/goalGraph';
import type { AgentGoal } from '@/services/memory/types';

// Mock memory index operations
vi.mock('@/services/memory/index', () => ({
  addGoal: vi.fn(),
  getGoals: vi.fn(),
  updateGoal: vi.fn(),
  getGoal: vi.fn(),
}));

import { addGoal, getGoals, updateGoal, getGoal } from '@/services/memory/index';

const createMockGoal = (overrides?: Partial<AgentGoal>): AgentGoal => ({
  id: 'goal-1',
  projectId: 'proj-1',
  title: 'Test Goal',
  description: '',
  status: 'active',
  progress: 0,
  createdAt: Date.now(),
  ...overrides,
});

describe('goalGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHierarchicalGoal', () => {
    it('creates a basic goal without hierarchy', async () => {
      const mockGoal = createMockGoal();
      vi.mocked(addGoal).mockResolvedValue(mockGoal);

      const result = await createHierarchicalGoal({
        projectId: 'proj-1',
        title: 'Simple Goal',
        status: 'active',
      });

      expect(addGoal).toHaveBeenCalled();
      expect(result).toEqual(mockGoal);
    });

    it('creates goal with parent reference', async () => {
      const mockGoal = createMockGoal({ description: '' });
      vi.mocked(addGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await createHierarchicalGoal({
        projectId: 'proj-1',
        title: 'Child Goal',
        status: 'active',
        parentGoalId: 'parent-1',
      });

      expect(updateGoal).toHaveBeenCalledWith(
        mockGoal.id,
        expect.objectContaining({
          description: expect.stringContaining('parent:parent-1'),
        })
      );
    });

    it('creates goal with blockedBy dependencies', async () => {
      const mockGoal = createMockGoal({ description: '' });
      vi.mocked(addGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await createHierarchicalGoal({
        projectId: 'proj-1',
        title: 'Blocked Goal',
        status: 'active',
        blockedBy: ['blocker-1', 'blocker-2'],
      });

      expect(updateGoal).toHaveBeenCalledWith(
        mockGoal.id,
        expect.objectContaining({
          description: expect.stringContaining('blocked_by:blocker-1,blocker-2'),
        })
      );
    });
  });

  describe('addSubgoal', () => {
    it('creates a goal with parent reference', async () => {
      const mockGoal = createMockGoal();
      vi.mocked(addGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await addSubgoal('parent-1', {
        projectId: 'proj-1',
        title: 'Subgoal',
        status: 'active',
      });

      expect(updateGoal).toHaveBeenCalledWith(
        mockGoal.id,
        expect.objectContaining({
          description: expect.stringContaining('parent:parent-1'),
        })
      );
    });
  });

  describe('addGoalDependency', () => {
    it('adds blocker to existing goal', async () => {
      const mockGoal = createMockGoal({ id: 'goal-1', description: '' });
      vi.mocked(getGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await addGoalDependency('goal-1', 'blocker-1');

      expect(updateGoal).toHaveBeenCalledWith(
        'goal-1',
        expect.objectContaining({
          description: expect.stringContaining('blocked_by:blocker-1'),
        })
      );
    });

    it('appends to existing blockers', async () => {
      const mockGoal = createMockGoal({
        id: 'goal-1',
        description: '[meta:blocked_by:existing-blocker]',
      });
      vi.mocked(getGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await addGoalDependency('goal-1', 'new-blocker');

      expect(updateGoal).toHaveBeenCalledWith(
        'goal-1',
        expect.objectContaining({
          description: expect.stringContaining('existing-blocker'),
        })
      );
    });

    it('throws when goal not found', async () => {
      vi.mocked(getGoal).mockResolvedValue(undefined);

      await expect(addGoalDependency('nonexistent', 'blocker')).rejects.toThrow('Goal not found');
    });
  });

  describe('removeGoalDependency', () => {
    it('removes blocker from goal', async () => {
      const mockGoal = createMockGoal({
        id: 'goal-1',
        description: '[meta:blocked_by:blocker-1,blocker-2]',
      });
      vi.mocked(getGoal).mockResolvedValue(mockGoal);
      vi.mocked(updateGoal).mockResolvedValue(undefined);

      await removeGoalDependency('goal-1', 'blocker-1');

      expect(updateGoal).toHaveBeenCalledWith(
        'goal-1',
        expect.objectContaining({
          description: expect.not.stringContaining('blocker-1'),
        })
      );
    });

    it('throws when goal not found', async () => {
      vi.mocked(getGoal).mockResolvedValue(undefined);

      await expect(removeGoalDependency('nonexistent', 'blocker')).rejects.toThrow('Goal not found');
    });
  });

  describe('buildGoalGraph', () => {
    it('returns empty hierarchy when no goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([]);

      const result = await buildGoalGraph('proj-1');

      expect(result.roots).toHaveLength(0);
      expect(result.totalGoals).toBe(0);
      expect(result.overallProgress).toBe(0);
    });

    it('builds flat hierarchy for goals without parents', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'g1', title: 'Goal 1', progress: 50 }),
        createMockGoal({ id: 'g2', title: 'Goal 2', progress: 100, status: 'completed' }),
      ]);

      const result = await buildGoalGraph('proj-1');

      expect(result.roots).toHaveLength(2);
      expect(result.totalGoals).toBe(2);
      expect(result.completedGoals).toBe(1);
    });

    it('builds nested hierarchy for parent-child goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'parent', title: 'Parent Goal' }),
        createMockGoal({ id: 'child', title: 'Child Goal', description: '[meta:parent:parent]' }),
      ]);

      const result = await buildGoalGraph('proj-1');

      expect(result.roots).toHaveLength(1);
      expect(result.roots[0].children).toHaveLength(1);
      expect(result.roots[0].children[0].title).toBe('Child Goal');
    });

    it('identifies blocked goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'blocker', title: 'Blocker', status: 'active' }),
        createMockGoal({ id: 'blocked', title: 'Blocked', description: '[meta:blocked_by:blocker]' }),
      ]);

      const result = await buildGoalGraph('proj-1');

      expect(result.blockedGoals).toBe(1);
      const blockedNode = result.roots.find((r) => r.id === 'blocked');
      expect(blockedNode?.isBlocked).toBe(true);
    });

    it('calculates overall progress', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'g1', progress: 50 }),
        createMockGoal({ id: 'g2', progress: 100 }),
      ]);

      const result = await buildGoalGraph('proj-1');

      expect(result.overallProgress).toBe(75);
    });

    it('calculates parent completion from children', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'parent', title: 'Parent', progress: 0 }),
        createMockGoal({ id: 'child1', title: 'Child 1', progress: 100, description: '[meta:parent:parent]' }),
        createMockGoal({ id: 'child2', title: 'Child 2', progress: 50, description: '[meta:parent:parent]' }),
      ]);

      const result = await buildGoalGraph('proj-1');

      const parent = result.roots[0];
      // Parent: 30% own (0) + 70% children avg ((100+50)/2 = 75) = 52.5 rounded
      expect(parent.completionPercent).toBeGreaterThan(0);
    });
  });

  describe('getBlockedGoals', () => {
    it('returns all blocked goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'blocker', title: 'Blocker', status: 'active' }),
        createMockGoal({ id: 'blocked1', title: 'Blocked 1', description: '[meta:blocked_by:blocker]' }),
        createMockGoal({ id: 'blocked2', title: 'Blocked 2', description: '[meta:blocked_by:blocker]' }),
        createMockGoal({ id: 'free', title: 'Free Goal' }),
      ]);

      const blocked = await getBlockedGoals('proj-1');

      expect(blocked).toHaveLength(2);
      expect(blocked.every((g) => g.isBlocked)).toBe(true);
    });
  });

  describe('getActionableGoals', () => {
    it('returns goals that are not blocked and active', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'blocker', title: 'Blocker', status: 'active' }),
        createMockGoal({ id: 'blocked', title: 'Blocked', status: 'active', description: '[meta:blocked_by:blocker]' }),
        createMockGoal({ id: 'completed', title: 'Completed', status: 'completed' }),
        createMockGoal({ id: 'actionable', title: 'Actionable', status: 'active' }),
      ]);

      const actionable = await getActionableGoals('proj-1');

      expect(actionable.some((g) => g.id === 'actionable')).toBe(true);
      expect(actionable.some((g) => g.id === 'blocker')).toBe(true);
      expect(actionable.some((g) => g.id === 'blocked')).toBe(false);
      expect(actionable.some((g) => g.id === 'completed')).toBe(false);
    });
  });

  describe('getCriticalPath', () => {
    it('returns path of blockers to target goal', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'root', title: 'Root' }),
        createMockGoal({ id: 'mid', title: 'Middle', description: '[meta:blocked_by:root]' }),
        createMockGoal({ id: 'target', title: 'Target', description: '[meta:blocked_by:mid]' }),
      ]);

      const path = await getCriticalPath('proj-1', 'target');

      expect(path).toHaveLength(3);
      expect(path[0].id).toBe('root');
      expect(path[2].id).toBe('target');
    });

    it('returns single goal when no dependencies', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'standalone', title: 'Standalone' }),
      ]);

      const path = await getCriticalPath('proj-1', 'standalone');

      expect(path).toHaveLength(1);
    });
  });

  describe('formatGoalHierarchy', () => {
    it('formats empty hierarchy', () => {
      const hierarchy: GoalHierarchy = {
        roots: [],
        totalGoals: 0,
        completedGoals: 0,
        blockedGoals: 0,
        overallProgress: 0,
      };

      const formatted = formatGoalHierarchy(hierarchy);

      expect(formatted).toContain('No goals defined');
    });

    it('formats hierarchy with goals', () => {
      const hierarchy: GoalHierarchy = {
        roots: [
          {
            id: 'g1',
            projectId: 'proj-1',
            title: 'Goal 1',
            status: 'active',
            progress: 50,
            depth: 0,
            children: [],
            isBlocked: false,
            blockedByNames: [],
            completionPercent: 50,
            path: ['g1'],
            createdAt: Date.now(),
          } as GoalNode,
        ],
        totalGoals: 1,
        completedGoals: 0,
        blockedGoals: 0,
        overallProgress: 50,
      };

      const formatted = formatGoalHierarchy(hierarchy);

      expect(formatted).toContain('## Goals');
      expect(formatted).toContain('Progress: 50%');
      expect(formatted).toContain('Goal 1');
    });

    it('shows blocked goals warning', () => {
      const hierarchy: GoalHierarchy = {
        roots: [
          {
            id: 'g1',
            projectId: 'proj-1',
            title: 'Blocked Goal',
            status: 'active',
            progress: 0,
            depth: 0,
            children: [],
            isBlocked: true,
            blockedByNames: ['Blocker'],
            completionPercent: 0,
            path: ['g1'],
            createdAt: Date.now(),
          } as GoalNode,
        ],
        totalGoals: 1,
        completedGoals: 0,
        blockedGoals: 1,
        overallProgress: 0,
      };

      const formatted = formatGoalHierarchy(hierarchy);

      expect(formatted).toContain('⚠️ 1 blocked goals');
      expect(formatted).toContain('⛔');
      expect(formatted).toContain('blocked by: Blocker');
    });

    it('uses correct status icons', () => {
      const hierarchy: GoalHierarchy = {
        roots: [
          { id: 'g1', title: 'Completed', status: 'completed', isBlocked: false, completionPercent: 100, children: [], blockedByNames: [], depth: 0, path: [], projectId: 'p', progress: 100, createdAt: 0 } as GoalNode,
          { id: 'g2', title: 'Active', status: 'active', isBlocked: false, completionPercent: 50, children: [], blockedByNames: [], depth: 0, path: [], projectId: 'p', progress: 50, createdAt: 0 } as GoalNode,
          { id: 'g3', title: 'Abandoned', status: 'abandoned', isBlocked: false, completionPercent: 0, children: [], blockedByNames: [], depth: 0, path: [], projectId: 'p', progress: 0, createdAt: 0 } as GoalNode,
        ],
        totalGoals: 3,
        completedGoals: 1,
        blockedGoals: 0,
        overallProgress: 50,
      };

      const formatted = formatGoalHierarchy(hierarchy);

      expect(formatted).toContain('✅');
      expect(formatted).toContain('🔄');
      expect(formatted).toContain('⏸️');
    });
  });

  describe('formatActionableGoals', () => {
    it('formats message when no actionable goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'completed', status: 'completed' }),
      ]);

      const formatted = await formatActionableGoals('proj-1');

      expect(formatted).toContain('completed or blocked');
    });

    it('lists actionable goals', async () => {
      vi.mocked(getGoals).mockResolvedValue([
        createMockGoal({ id: 'g1', title: 'Task 1', status: 'active', progress: 25 }),
        createMockGoal({ id: 'g2', title: 'Task 2', status: 'active', progress: 50 }),
      ]);

      const formatted = await formatActionableGoals('proj-1');

      expect(formatted).toContain('Actionable goals');
      expect(formatted).toContain('Task 1');
      expect(formatted).toContain('Task 2');
    });

    it('limits to 5 goals', async () => {
      vi.mocked(getGoals).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          createMockGoal({ id: `g${i}`, title: `Task ${i}`, status: 'active' })
        )
      );

      const formatted = await formatActionableGoals('proj-1');
      const bulletCount = (formatted.match(/•/g) || []).length;

      expect(bulletCount).toBeLessThanOrEqual(5);
    });
  });
});
