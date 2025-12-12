import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    const tagsInput = screen.getByLabelText('Tags (comma separated)', { selector: 'input' });
    const importanceInput = screen.getByLabelText('Importance (0-1)', { selector: 'input' });

    // Use fireEvent for more reliable controlled input updates
    fireEvent.change(textarea, { target: { value: 'New memory text' } });
    fireEvent.change(tagsInput, { target: { value: 'tag-one, tag-two' } });
    fireEvent.change(importanceInput, { target: { value: '1' } });
    fireEvent.submit(form);

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

  it('deletes a memory and refreshes data', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Project note')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(mocks.deleteMemory).toHaveBeenCalledWith('m-project'));
  });

  it('starts editing an existing memory', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Project note')).toBeInTheDocument());

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    await waitFor(() => {
      const textarea = screen.getByLabelText('Memory Text');
      expect(textarea).toHaveValue('Project note');
    });
  });

  it('submits a goal form', async () => {
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getGoals).toHaveBeenCalled());

    // Find the Goals section and its form inputs
    const goalsSection = screen.getByText('Goals').closest('section');
    const titleInput = goalsSection?.querySelector('input[type="text"]');
    const statusSelect = goalsSection?.querySelector('select');

    if (titleInput) fireEvent.change(titleInput, { target: { value: 'New goal' } });
    if (statusSelect) fireEvent.change(statusSelect, { target: { value: 'active' } });

    const addGoalButton = screen.getByRole('button', { name: 'Add Goal' });
    fireEvent.click(addGoalButton);

    await waitFor(() => expect(mocks.addGoal).toHaveBeenCalled());
    expect(mocks.addGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        title: 'New goal',
        status: 'active',
      }),
    );
  });

  it('starts editing an existing goal', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Goal title')).toBeInTheDocument());

    // Find Edit button in goals section - it's the first button in the goal item
    const goalItem = screen.getByText('Goal title').closest('div[class*="p-3"]');
    const editButton = goalItem?.querySelector('button');
    if (editButton) await user.click(editButton);

    await waitFor(() => {
      // Find the title input in the Goals section form
      const goalsSection = screen.getByText('Goals').closest('section');
      const titleInput = goalsSection?.querySelector('input[type="text"]');
      expect(titleInput).toHaveValue('Goal title');
    });
  });

  it('deletes a goal', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Goal title')).toBeInTheDocument());

    // Find Delete button for goals - it's after the memories section
    const goalsSection = screen.getByText('Goals').closest('section');
    const deleteButton = goalsSection?.querySelector('button[class*="error"]') ||
      Array.from(goalsSection?.querySelectorAll('button') || []).find(
        (btn) => btn.textContent === 'Delete',
      );

    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(mocks.deleteGoal).toHaveBeenCalledWith('g-1'));
  });

  it('submits an entity form', async () => {
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getWatchedEntities).toHaveBeenCalled());

    // Find the Proactive Monitoring section and its form inputs
    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const nameInput = entitySection?.querySelector('input[type="text"]');
    const prioritySelect = entitySection?.querySelector('select');

    if (nameInput) fireEvent.change(nameInput, { target: { value: 'New entity' } });
    if (prioritySelect) fireEvent.change(prioritySelect, { target: { value: 'high' } });

    const watchEntityButton = screen.getByRole('button', { name: 'Watch Entity' });
    fireEvent.click(watchEntityButton);

    await waitFor(() => expect(mocks.addWatchedEntity).toHaveBeenCalled());
    expect(mocks.addWatchedEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        name: 'New entity',
        priority: 'high',
      }),
    );
  });

  it('deletes an entity', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    // Find Delete button in entities section
    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const deleteButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Delete',
    );

    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(mocks.removeWatchedEntity).toHaveBeenCalledWith('e-1'));
  });

  it('shows error when createMemory fails', async () => {
    mocks.createMemory.mockRejectedValueOnce(new Error('Network error'));

    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });

    fireEvent.change(textarea, { target: { value: 'Test memory' } });
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('shows error when memory text is empty', async () => {
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });

    fireEvent.change(textarea, { target: { value: '   ' } }); // Only whitespace
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Memory text is required.')).toBeInTheDocument());
    expect(mocks.createMemory).not.toHaveBeenCalled();
  });

  it('updates an existing memory instead of creating', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Project note')).toBeInTheDocument());

    // Start editing
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    // Modify and submit
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    fireEvent.change(textarea, { target: { value: 'Updated note' } });

    const form = screen.getByRole('form', { name: /memories/i });
    fireEvent.submit(form);

    await waitFor(() => expect(mocks.updateMemory).toHaveBeenCalled());
    expect(mocks.updateMemory).toHaveBeenCalledWith(
      'm-project',
      expect.objectContaining({ text: 'Updated note' }),
    );
  });

  it('cancels memory edit mode', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Project note')).toBeInTheDocument());

    // Start editing
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Verify form is reset
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    expect(textarea).toHaveValue('');
  });

  it('enables entity monitoring when disabled', async () => {
    const disabledEntity: WatchedEntity = {
      ...entity,
      id: 'e-disabled',
      monitoringEnabled: false,
    };
    mocks.getWatchedEntities.mockResolvedValue([disabledEntity]);

    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Monitoring off')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => expect(mocks.updateWatchedEntity).toHaveBeenCalled());
    expect(mocks.updateWatchedEntity).toHaveBeenCalledWith('e-disabled', { monitoringEnabled: true });
  });

  it('normalizes importance value safely', async () => {
    render(<MemoryManager projectId="proj-1" />);

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    const importanceInput = screen.getByLabelText('Importance (0-1)', { selector: 'input' });

    fireEvent.change(textarea, { target: { value: 'Valid text' } });

    // Simulate invalid input causing NaN or weirdness if parsed directly
    fireEvent.change(importanceInput, { target: { value: '' } });
    // The component uses parseFloat(e.target.value). parseFloat('') is NaN.
    // normalizeImportance(NaN) -> 0.5

    fireEvent.submit(form);

    await waitFor(() => expect(mocks.createMemory).toHaveBeenCalled());
    expect(mocks.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        importance: 0.5,
      })
    );
  });

  it('shows error when deleting memory fails', async () => {
    mocks.deleteMemory.mockRejectedValueOnce(new Error('Delete failed'));
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Project note')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // Assuming first one is memory delete
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(screen.getByText('Delete failed')).toBeInTheDocument());
  });

  it('shows error when submitting goal fails', async () => {
    mocks.addGoal.mockRejectedValueOnce(new Error('Goal error'));
    render(<MemoryManager projectId="proj-1" />);

    const goalsSection = screen.getByText('Goals').closest('section');
    const titleInput = goalsSection?.querySelector('input[type="text"]');
    if (titleInput) fireEvent.change(titleInput, { target: { value: 'New goal' } });

    const addGoalButton = screen.getByRole('button', { name: 'Add Goal' });
    fireEvent.click(addGoalButton);

    await waitFor(() => expect(screen.getByText('Goal error')).toBeInTheDocument());
  });

  it('shows error when deleting goal fails', async () => {
    mocks.deleteGoal.mockRejectedValueOnce(new Error('Goal delete error'));
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Goal title')).toBeInTheDocument());

    const goalsSection = screen.getByText('Goals').closest('section');
    const deleteButton = Array.from(goalsSection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Delete',
    );
    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(screen.getByText('Goal delete error')).toBeInTheDocument());
  });

  it('shows error when submitting entity fails', async () => {
    mocks.addWatchedEntity.mockRejectedValueOnce(new Error('Entity error'));
    render(<MemoryManager projectId="proj-1" />);

    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const nameInput = entitySection?.querySelector('input[type="text"]');
    if (nameInput) fireEvent.change(nameInput, { target: { value: 'New entity' } });

    const watchEntityButton = screen.getByRole('button', { name: 'Watch Entity' });
    fireEvent.click(watchEntityButton);

    await waitFor(() => expect(screen.getByText('Entity error')).toBeInTheDocument());
  });

  it('shows error when deleting entity fails', async () => {
    mocks.removeWatchedEntity.mockRejectedValueOnce(new Error('Entity delete error'));
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const deleteButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Delete',
    );
    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(screen.getByText('Entity delete error')).toBeInTheDocument());
  });
  it('handles data refresh errors gracefully', async () => {
    // Mock getMemories to fail
    mocks.getMemories.mockRejectedValue(new Error('Fetch failed'));
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<MemoryManager projectId="proj-1" />);

    await waitFor(() => expect(console.warn).toHaveBeenCalledWith(
      '[MemoryManager] Failed to refresh data',
      expect.any(Error)
    ));
    spy.mockRestore();
  });

  it('updates an existing goal', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Goal title')).toBeInTheDocument());

    // Click edit on goal
    const goalItem = screen.getByText('Goal title').closest('div[class*="p-3"]');
    const editButton = goalItem?.querySelector('button');
    if (editButton) await user.click(editButton);

    // Change title
    const goalsSection = screen.getByText('Goals').closest('section');
    const titleInput = goalsSection?.querySelector('input[type="text"]');
    if (titleInput) fireEvent.change(titleInput, { target: { value: 'Updated Goal Title' } });

    // Submit
    const updateButton = screen.getByRole('button', { name: 'Update Goal' });
    await user.click(updateButton);

    await waitFor(() => expect(mocks.updateGoal).toHaveBeenCalledWith(
      'g-1',
      expect.objectContaining({ title: 'Updated Goal Title' })
    ));
  });

  it('updates an existing watched entity', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    // Click edit
    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const editButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Edit'
    );
    if (editButton) await user.click(editButton);

    // Change name
    const nameInput = entitySection?.querySelector('input[type="text"]');
    if (nameInput) fireEvent.change(nameInput, { target: { value: 'Updated Watcher' } });

    // Submit
    const updateButton = screen.getByRole('button', { name: 'Update Entity' });
    await user.click(updateButton);

    await waitFor(() => expect(mocks.updateWatchedEntity).toHaveBeenCalledWith(
      'e-1',
      expect.objectContaining({ name: 'Updated Watcher' })
    ));
  });

  it('resets entity form when editing entity is deleted', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    // Start editing
    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const editButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Edit'
    );
    if (editButton) await user.click(editButton);

    // Verify form populated
    const nameInput = entitySection?.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Watcher');

    // Delete the entity
    const deleteButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Delete'
    );
    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(mocks.removeWatchedEntity).toHaveBeenCalled());
    
    // Verify form reset
    expect(nameInput.value).toBe('');
    expect(screen.getByRole('button', { name: 'Watch Entity' })).toBeInTheDocument();
  });

  it('renders empty states for all sections', async () => {
    mocks.getMemories.mockResolvedValue([]);
    mocks.getGoals.mockResolvedValue([]);
    mocks.getWatchedEntities.mockResolvedValue([]);

    render(<MemoryManager projectId="proj-1" />);
    
    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    expect(screen.getByText('No project memories yet.')).toBeInTheDocument();
    expect(screen.getByText('No author memories yet.')).toBeInTheDocument();
    expect(screen.getByText('No goals added for this project.')).toBeInTheDocument();
    expect(screen.getByText('No watched entities for this project.')).toBeInTheDocument();
  });

  it('handles memory form field changes', async () => {
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const scopeSelect = screen.getByLabelText('Scope', { selector: 'select' });
    const typeSelect = screen.getByLabelText('Type', { selector: 'select' });

    fireEvent.change(scopeSelect, { target: { value: 'author' } });
    expect(scopeSelect).toHaveValue('author');

    fireEvent.change(typeSelect, { target: { value: 'plan' } });
    expect(typeSelect).toHaveValue('plan');
  });

  it('cancels goal edit mode', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Goal title')).toBeInTheDocument());

    const goalItem = screen.getByText('Goal title').closest('div[class*="p-3"]');
    const editButton = goalItem?.querySelector('button');
    if (editButton) await user.click(editButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    const goalsSection = screen.getByText('Goals').closest('section');
    const titleInput = goalsSection?.querySelector('input[type="text"]');
    expect(titleInput).toHaveValue('');
  });

  it('cancels entity edit mode', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Watcher')).toBeInTheDocument());

    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const editButton = Array.from(entitySection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Edit'
    );
    if (editButton) await user.click(editButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    const nameInput = entitySection?.querySelector('input[type="text"]');
    expect(nameInput).toHaveValue('');
  });

  it('handles all goal form fields', async () => {
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(mocks.getGoals).toHaveBeenCalled());

    const goalsSection = screen.getByText('Goals').closest('section');
    const titleInput = goalsSection?.querySelector('input[type="text"]');
    const descInput = goalsSection?.querySelector('textarea');
    const progressInput = goalsSection?.querySelector('input[type="range"]');

    if (titleInput) fireEvent.change(titleInput, { target: { value: 'Required Title' } });
    if (descInput) fireEvent.change(descInput, { target: { value: 'New Description' } });
    if (progressInput) fireEvent.change(progressInput, { target: { value: '50' } });

    const submitButton = screen.getByRole('button', { name: 'Add Goal' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(mocks.addGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Required Title',
        description: 'New Description',
        progress: 50
      })
    ));
  });

  it('handles all entity form fields', async () => {
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(mocks.getWatchedEntities).toHaveBeenCalled());

    const entitySection = screen.getByText('Proactive Monitoring').closest('section');
    const nameInput = entitySection?.querySelector('input[type="text"]');
    const reasonInput = entitySection?.querySelector('textarea');
    const monitoringCheckbox = entitySection?.querySelector('input[type="checkbox"]');

    if (nameInput) fireEvent.change(nameInput, { target: { value: 'Required Name' } });
    if (reasonInput) fireEvent.change(reasonInput, { target: { value: 'New Reason' } });
    if (monitoringCheckbox) fireEvent.click(monitoringCheckbox); // Toggle off

    const submitButton = screen.getByRole('button', { name: 'Watch Entity' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(mocks.addWatchedEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Required Name',
        reason: 'New Reason',
        monitoringEnabled: false
      })
    ));
  });

  it('edits an author memory', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Author note')).toBeInTheDocument());

    // Find edit button for author memory
    const authorSection = screen.getByText('Author Memories').closest('div');
    const editButton = authorSection?.querySelector('button'); // First button should be edit
    if (editButton) await user.click(editButton);

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    expect(textarea).toHaveValue('Author note');
  });

  it('deletes an author memory', async () => {
    const user = userEvent.setup();
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('Author note')).toBeInTheDocument());

    const authorSection = screen.getByText('Author Memories').closest('div');
    const deleteButton = Array.from(authorSection?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent === 'Delete'
    );
    if (deleteButton) await user.click(deleteButton);

    await waitFor(() => expect(mocks.deleteMemory).toHaveBeenCalledWith('m-author'));
  });

  it('clamps importance values correctly', async () => {
    render(<MemoryManager projectId="proj-1" />);
    await waitFor(() => expect(mocks.getMemories).toHaveBeenCalled());

    const form = screen.getByRole('form', { name: /memories/i });
    const textarea = screen.getByLabelText('Memory Text', { selector: 'textarea' });
    const importanceInput = screen.getByLabelText('Importance (0-1)', { selector: 'input' });

    fireEvent.change(textarea, { target: { value: 'Clamped memory' } });

    // Test > 1
    fireEvent.change(importanceInput, { target: { value: '2.5' } });
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({ importance: 1 })
    ));

    mocks.createMemory.mockClear();

    // Form resets after successful submit; re-enter text for the next submission
    fireEvent.change(textarea, { target: { value: 'Clamped memory' } });

    // Test < 0
    fireEvent.change(importanceInput, { target: { value: '-1.5' } });
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({ importance: 0 })
      ));
  });
});
