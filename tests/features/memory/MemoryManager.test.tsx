import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryManager } from '@/features/memory/MemoryManager';
import type { AgentGoal, MemoryNote, WatchedEntity } from '@/services/memory/types';

vi.mock('@/features/memory/components/BedsideNotePanel', () => ({
  BedsideNotePanel: () => <div data-testid="bedside-note-panel" />,
}));

const mocks = vi.hoisted(() => ({
  getMemories: vi.fn(),
  getGoals: vi.fn(),
  getWatchedEntities: vi.fn(),
  createMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addWatchedEntity: vi.fn(),
  updateWatchedEntity: vi.fn(),
  removeWatchedEntity: vi.fn(),
}));

vi.mock('@/services/memory', () => ({
  getMemories: mocks.getMemories,
  getGoals: mocks.getGoals,
  getWatchedEntities: mocks.getWatchedEntities,
  createMemory: mocks.createMemory,
  updateMemory: mocks.updateMemory,
  deleteMemory: mocks.deleteMemory,
  addGoal: mocks.addGoal,
  updateGoal: mocks.updateGoal,
  deleteGoal: mocks.deleteGoal,
  addWatchedEntity: mocks.addWatchedEntity,
  updateWatchedEntity: mocks.updateWatchedEntity,
  removeWatchedEntity: mocks.removeWatchedEntity,
}));

const projectMemory: MemoryNote = {
  id: 'm-project',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Project note',
  type: 'fact',
  topicTags: ['alpha'],
  importance: 0.7,
  createdAt: 1,
};

const authorMemory: MemoryNote = {
  id: 'm-author',
  scope: 'author',
  text: 'Author note',
  type: 'preference',
  topicTags: ['style'],
  importance: 0.4,
  createdAt: 2,
};

const goal: AgentGoal = {
  id: 'g-1',
  projectId: 'proj-1',
  title: 'Goal title',
  status: 'active',
  progress: 10,
  createdAt: 1,
};

const entity: WatchedEntity = {
  id: 'e-1',
  name: 'Watcher',
  projectId: 'proj-1',
  priority: 'high',
  monitoringEnabled: true,
  createdAt: 1,
};

const arrangeDefaultMocks = () => {
  mocks.getMemories.mockImplementation(({ scope }: { scope: MemoryNote['scope'] }) =>
    Promise.resolve(scope === 'project' ? [projectMemory] : [authorMemory]),
  );
  mocks.getGoals.mockResolvedValue([goal]);
  mocks.getWatchedEntities.mockResolvedValue([entity]);
  mocks.createMemory.mockResolvedValue(undefined);
  mocks.updateMemory.mockResolvedValue(undefined);
  mocks.deleteMemory.mockResolvedValue(undefined);
  mocks.addGoal.mockResolvedValue(undefined);
  mocks.updateGoal.mockResolvedValue(undefined);
  mocks.deleteGoal.mockResolvedValue(undefined);
  mocks.addWatchedEntity.mockResolvedValue(undefined);
  mocks.updateWatchedEntity.mockResolvedValue(undefined);
  mocks.removeWatchedEntity.mockResolvedValue(undefined);
};

describe('MemoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrangeDefaultMocks();
  });

  it('renders guard message when no project is selected', () => {
    render(<MemoryManager projectId={null} />);

    expect(
      screen.getByText('Select a project to manage agent memories, goals, and proactive monitoring.'),
    ).toBeInTheDocument();
    expect(mocks.getMemories).not.toHaveBeenCalled();
  });

  it('loads project and author data when projectId is provided', async () => {
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalledTimes(2));
    expect(mocks.getMemories).toHaveBeenCalledWith({ scope: 'project', projectId: 'proj-1' });
    expect(mocks.getMemories).toHaveBeenCalledWith({ scope: 'author' });
    expect(await screen.findByText('Project note')).toBeInTheDocument();
    expect(screen.getByText('Author note')).toBeInTheDocument();
  });

  it('submits a new memory with normalized payload', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const scopeForm = screen.getByRole('form', { name: /memories/i });
    await user.type(screen.getByLabelText('Memory Text', { selector: 'textarea' }), 'New memory text');
    await user.type(screen.getByLabelText('Tags (comma separated)', { selector: 'input' }), 'tag-one, tag-two');
    await user.clear(screen.getByLabelText('Importance (0-1)', { selector: 'input' }));
    await user.type(screen.getByLabelText('Importance (0-1)', { selector: 'input' }), '1');
    await user.click(screen.getByRole('button', { name: /Add Memory/i }));

    await waitFor(() => expect(mocks.createMemory).toHaveBeenCalled());
    expect(mocks.createMemory).toHaveBeenCalledWith({
      text: 'New memory text',
      type: 'observation',
      topicTags: ['tag-one', 'tag-two'],
      importance: 1,
      scope: 'project',
      projectId: 'proj-1',
    });
  });

  it('toggles monitoring status for an entity', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(mocks.updateWatchedEntity).toHaveBeenCalled());
    expect(mocks.updateWatchedEntity).toHaveBeenCalledWith('e-1', { monitoringEnabled: false });
  });
});
