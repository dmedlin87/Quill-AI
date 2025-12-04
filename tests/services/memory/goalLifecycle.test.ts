import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AgentGoal } from '@/services/memory/types';

function createGoalsTableMock(initial: AgentGoal[] = []) {
  let storedGoals = [...initial];

  return {
    add: vi.fn().mockImplementation(async (goal: AgentGoal) => {
      storedGoals.push(goal);
      return goal.id;
    }),
    put: vi.fn().mockImplementation(async (goal: AgentGoal) => {
      const index = storedGoals.findIndex(g => g.id === goal.id);
      if (index >= 0) {
        storedGoals[index] = goal;
      } else {
        storedGoals.push(goal);
      }
      return goal.id;
    }),
    get: vi.fn().mockImplementation(async (id: string) => {
      return storedGoals.find(g => g.id === id);
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      storedGoals = storedGoals.filter(g => g.id !== id);
    }),
    where: vi.fn().mockImplementation((field: string) => ({
      equals: vi.fn().mockImplementation((value: any) => {
        let filtered = storedGoals;

        if (field === '[projectId+status]') {
          const [projectId, status] = value;
          filtered = storedGoals.filter(
            goal => goal.projectId === projectId && goal.status === status
          );
        } else if (field === 'projectId') {
          filtered = storedGoals.filter(goal => goal.projectId === value);
        }

        return {
          filter: vi.fn().mockImplementation((predicate: (goal: AgentGoal) => boolean) => ({
            toArray: vi.fn().mockResolvedValue(filtered.filter(predicate)),
          })),
          toArray: vi.fn().mockResolvedValue([...filtered]),
        };
      }),
    })),
  };
}

const chainsMocks = vi.hoisted(() => ({
  getOrCreateBedsideNote: vi.fn(),
  evolveBedsideNote: vi.fn(),
}));

let mockGoalsTable: ReturnType<typeof createGoalsTableMock>;

vi.mock('@/services/db', () => ({
  db: {
    get goals() {
      return mockGoalsTable;
    },
    memories: {
      toCollection: vi.fn(),
      where: vi.fn(),
    },
    watchedEntities: {
      where: vi.fn(),
      equals: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
    },
  },
}));

vi.mock('@/services/memory/chains', () => chainsMocks);

import { addGoal, abandonGoal, completeGoal } from '@/services/memory';

describe('goal lifecycle bedside note updates', () => {
  const projectId = 'project-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGoalsTable = createGoalsTableMock();
    chainsMocks.getOrCreateBedsideNote.mockResolvedValue({ id: 'bed-1' } as any);
    chainsMocks.evolveBedsideNote.mockResolvedValue({} as any);
  });

  it('adds a goal and summarizes the new plan state', async () => {
    mockGoalsTable = createGoalsTableMock([
      {
        id: 'goal-1',
        projectId,
        title: 'Existing active goal',
        description: 'Keep track of progress',
        status: 'active',
        progress: 10,
        createdAt: Date.now() - 1000,
      },
    ]);

    const created = await addGoal({
      projectId,
      title: 'New goal to pursue',
      description: 'A newly added target',
      status: 'active',
    });

    expect(created.title).toBe('New goal to pursue');
    expect(chainsMocks.getOrCreateBedsideNote).toHaveBeenCalledWith(projectId);
    expect(chainsMocks.evolveBedsideNote).toHaveBeenCalledWith(
      projectId,
      expect.stringContaining('Goal added: New goal to pursue'),
      { changeReason: 'goal_lifecycle' }
    );
    const planText = chainsMocks.evolveBedsideNote.mock.calls[0][1] as string;
    expect(planText).toContain('Active goals: 2/2');
  });

  it('completes a goal and nudges next steps', async () => {
    mockGoalsTable = createGoalsTableMock([
      {
        id: 'goal-complete',
        projectId,
        title: 'Finish draft',
        description: 'Complete the manuscript draft',
        status: 'active',
        progress: 60,
        createdAt: Date.now() - 2000,
      },
      {
        id: 'goal-still-active',
        projectId,
        title: 'Revise outline',
        description: 'Keep refining structure',
        status: 'active',
        progress: 30,
        createdAt: Date.now() - 500,
      },
    ]);

    const updated = await completeGoal('goal-complete');

    expect(updated.status).toBe('completed');
    expect(updated.progress).toBe(100);
    expect(chainsMocks.evolveBedsideNote).toHaveBeenCalledWith(
      projectId,
      expect.stringContaining('Goal completed: Finish draft — consider next steps.'),
      { changeReason: 'goal_lifecycle' }
    );
    const planText = chainsMocks.evolveBedsideNote.mock.calls[0][1] as string;
    expect(planText).toContain('Active goals: 1/2');
  });

  it('abandons a goal and highlights priority reset', async () => {
    mockGoalsTable = createGoalsTableMock([
      {
        id: 'goal-abandon',
        projectId,
        title: 'Old objective',
        description: 'No longer relevant',
        status: 'active',
        progress: 25,
        createdAt: Date.now() - 3000,
      },
    ]);

    const updated = await abandonGoal('goal-abandon');

    expect(updated.status).toBe('abandoned');
    expect(chainsMocks.getOrCreateBedsideNote).toHaveBeenCalledWith(projectId);
    expect(chainsMocks.evolveBedsideNote).toHaveBeenCalledWith(
      projectId,
      expect.stringContaining('Goal abandoned: Old objective — revisit priorities.'),
      { changeReason: 'goal_lifecycle' }
    );
    const planText = chainsMocks.evolveBedsideNote.mock.calls[0][1] as string;
    expect(planText).toContain('Active goals: 0/1');
  });
});
