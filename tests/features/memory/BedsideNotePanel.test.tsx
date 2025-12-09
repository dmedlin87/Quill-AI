import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BedsideNotePanel } from '@/features/memory/components/BedsideNotePanel';
import { BedsideNoteHistory } from '@/features/memory/components/BedsideNoteHistory';
import { applyBedsideNoteMutation } from '@/services/memory/bedsideNoteMutations';
import { getMemoryChain, getOrCreateBedsideNote, ChainedMemory } from '@/services/memory/chains';
import { MemoryNote } from '@/services/memory/types';

vi.mock('@/services/memory/bedsideNoteMutations', () => ({
  applyBedsideNoteMutation: vi.fn(),
}));

vi.mock('@/services/memory/chains', () => ({
  getMemoryChain: vi.fn(),
  getOrCreateBedsideNote: vi.fn(),
}));

const baseNote: MemoryNote = {
  id: 'bed-1',
  scope: 'project',
  projectId: 'proj-1',
  text: 'Focus on chapter three pacing.',
  type: 'plan',
  topicTags: ['meta:bedside-note'],
  importance: 0.9,
  createdAt: Date.now(),
  structuredContent: {
    currentFocus: 'Focus on chapter three pacing.',
    warnings: ['Keep POV consistent'],
    activeGoals: [{ title: 'Finish chapter three', status: 'active', progress: 10 }],
    conflicts: [
      { previous: 'Sarah is missing', current: 'Sarah is present', confidence: 0.7, strategy: 'heuristic' },
    ],
  },
};

const baseHistory: ChainedMemory[] = [
  {
    memoryId: 'bed-1',
    version: 1,
    text: 'Initial bedside',
    timestamp: 1733339000000,
    changeType: 'initial',
    changeReason: 'analysis_update',
  },
  {
    memoryId: 'bed-2',
    version: 2,
    text: 'Initial bedside with edits',
    timestamp: 1733339600000,
    changeType: 'update',
    changeReason: 'significant_edit',
  },
];

const mockedApplyMutation = vi.mocked(applyBedsideNoteMutation);
const mockedGetMemoryChain = vi.mocked(getMemoryChain);
const mockedGetOrCreate = vi.mocked(getOrCreateBedsideNote);

describe('BedsideNotePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetOrCreate.mockResolvedValue(baseNote);
    mockedGetMemoryChain.mockResolvedValue(baseHistory);
  });

  it('renders guard message when no projectId', () => {
    render(<BedsideNotePanel projectId={null} goals={[]} />);

    expect(screen.getByText('Select a project to view bedside notes.')).toBeInTheDocument();
    expect(mockedGetOrCreate).not.toHaveBeenCalled();
  });

  it('displays error when loading fails', async () => {
    mockedGetOrCreate.mockRejectedValueOnce(new Error('Network error'));

    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('renders structured sections and allows collapsing', async () => {
    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());
    expect(screen.getByText('Current Focus')).toBeInTheDocument();
    expect(screen.getByText('Warnings & Risks')).toBeInTheDocument();
    expect(screen.getByText('Keep POV consistent')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Warnings & Risks'));
    expect(screen.queryByText('Keep POV consistent')).not.toBeInTheDocument();
  });

  it('supports manual list edits and refreshes history', async () => {
    mockedGetMemoryChain
      .mockResolvedValueOnce(baseHistory)
      .mockResolvedValueOnce([...baseHistory, { ...baseHistory[1], memoryId: 'bed-3', version: 3 }]);

    const updatedNote: MemoryNote = {
      ...baseNote,
      id: 'bed-3',
      structuredContent: { ...baseNote.structuredContent, warnings: ['Keep POV consistent', 'Add new hook'] },
    };

    mockedApplyMutation.mockResolvedValue(updatedNote);

    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);
    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Add to warnings & risks'), { target: { value: 'Add new hook' } });
    fireEvent.click(screen.getAllByText('Add')[0]);

    await waitFor(() => expect(mockedApplyMutation).toHaveBeenCalledWith('proj-1', expect.any(Object)));
    expect(screen.getByText('Add new hook')).toBeInTheDocument();
  });

  it('filters history by change reason and supports pinning', async () => {
    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);
    await waitFor(() => expect(mockedGetMemoryChain).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'analysis_update' } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Pin|Pinned/ })).toHaveLength(1));
    expect(screen.queryByText('significant_edit', { selector: 'span' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Pin')[0]);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('surfaces notifications for conflicts and stalled goals', async () => {
    const stalledGoal = { id: 'goal-1', projectId: 'proj-1', title: 'Stuck goal', status: 'active', progress: 0, createdAt: 1 } as any;
    render(<BedsideNotePanel projectId="proj-1" goals={[stalledGoal]} />);

    await waitFor(() => expect(mockedGetMemoryChain).toHaveBeenCalled());
    expect(screen.getByText('Conflicts detected')).toBeInTheDocument();
    expect(screen.getByText('Stalled goals')).toBeInTheDocument();
  });

  it('renders current focus section header', async () => {
    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());

    // Current Focus section header should be visible
    expect(screen.getByText('Current Focus')).toBeInTheDocument();
  });

  it('removes an item from a list section', async () => {
    const updatedNote: MemoryNote = {
      ...baseNote,
      structuredContent: { ...baseNote.structuredContent, warnings: [] },
    };
    mockedApplyMutation.mockResolvedValue(updatedNote);

    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());
    expect(screen.getByText('Keep POV consistent')).toBeInTheDocument();

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    await waitFor(() => expect(mockedApplyMutation).toHaveBeenCalledWith('proj-1', {
      section: 'warnings',
      action: 'remove',
      content: 'Keep POV consistent',
    }));
  });

  it('renders active goals section header', async () => {
    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());

    // Active Goals section header should be visible
    expect(screen.getByText('Active Goals')).toBeInTheDocument();
  });

  it('shows conflicts notification when conflicts exist', async () => {
    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());

    // Conflicts notification should be visible
    expect(screen.getByText('Conflicts detected')).toBeInTheDocument();
  });

  it('handles fallback when structuredContent is empty but note.text exists', async () => {
    const textOnlyNote: MemoryNote = {
      ...baseNote,
      structuredContent: undefined,
      text: 'Legacy text content',
    };
    mockedGetOrCreate.mockResolvedValue(textOnlyNote);

    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetOrCreate).toHaveBeenCalled());

    // The component should render with the text content
    expect(screen.getByText('Current Focus')).toBeInTheDocument();
  });

  it('shows significant update notification when history includes significant changes', async () => {
    const historyWithSignificant: ChainedMemory[] = [
      { ...baseHistory[0], changeReason: 'significant_plot_change' },
    ];
    mockedGetMemoryChain.mockResolvedValue(historyWithSignificant);

    render(<BedsideNotePanel projectId="proj-1" goals={[]} />);

    await waitFor(() => expect(mockedGetMemoryChain).toHaveBeenCalled());
    expect(screen.getByText('Significant bedside update')).toBeInTheDocument();
  });
});

describe('BedsideNoteHistory snapshot', () => {
  const originalToLocaleString = Date.prototype.toLocaleString;

  beforeEach(() => {
    // Mock toLocaleString for consistent snapshot output across timezones
    Date.prototype.toLocaleString = function () {
      return new Date(this.getTime()).toISOString().replace('T', ', ').slice(0, 20);
    };
  });

  afterEach(() => {
    Date.prototype.toLocaleString = originalToLocaleString;
  });

  it('renders a consistent diff view', () => {
    const { container } = render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId={null}
        onPin={() => undefined}
        renderDiff={() => [{ value: 'Example diff', added: true }] as any}
      />,
    );

    expect(container).toMatchSnapshot();
  });
});
