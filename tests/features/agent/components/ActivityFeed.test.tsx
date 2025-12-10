import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ActivityFeed } from '@/features/agent/components/ActivityFeed';
import { HistoryItem } from '@/types';

const mockHistory: HistoryItem[] = [
  {
    id: '1',
    timestamp: new Date('2023-10-26T10:00:00Z').getTime(),
    description: 'Initial draft',
    author: 'User',
  } as HistoryItem,
  {
    id: '2',
    timestamp: new Date('2023-10-26T10:05:00Z').getTime(),
    description: 'Fixed typo',
    author: 'Agent',
  } as HistoryItem,
];

describe('ActivityFeed', () => {
  it('renders correctly with history items', () => {
    const onRestore = vi.fn();
    const onInspect = vi.fn();

    render(
      <ActivityFeed
        history={mockHistory}
        onRestore={onRestore}
        onInspect={onInspect}
      />
    );

    expect(screen.getByText('Edit History')).toBeInTheDocument();
    expect(screen.getByText('Initial draft')).toBeInTheDocument();
    expect(screen.getByText('Fixed typo')).toBeInTheDocument();
    // The component renders text as provided in data, CSS handles uppercase.
    // RTL getByText matches text content.
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('renders empty state when history is empty', () => {
    const onRestore = vi.fn();
    const onInspect = vi.fn();

    render(
      <ActivityFeed
        history={[]}
        onRestore={onRestore}
        onInspect={onInspect}
      />
    );

    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });

  it('calls onRestore when revert button is clicked', () => {
    const onRestore = vi.fn();
    const onInspect = vi.fn();

    render(
      <ActivityFeed
        history={mockHistory}
        onRestore={onRestore}
        onInspect={onInspect}
      />
    );

    const revertButtons = screen.getAllByText('Revert');
    fireEvent.click(revertButtons[0]);

    expect(onRestore).toHaveBeenCalledWith('2');
  });

  it('calls onInspect when diff button is clicked', () => {
    const onRestore = vi.fn();
    const onInspect = vi.fn();

    render(
      <ActivityFeed
        history={mockHistory}
        onRestore={onRestore}
        onInspect={onInspect}
      />
    );

    const diffButtons = screen.getAllByText('Diff');
    fireEvent.click(diffButtons[0]);

    expect(onInspect).toHaveBeenCalledWith(mockHistory[1]);
  });

  it('displays correct styling for Agent vs User', () => {
      const onRestore = vi.fn();
      const onInspect = vi.fn();

      const { container } = render(
        <ActivityFeed
            history={mockHistory}
            onRestore={onRestore}
            onInspect={onInspect}
        />
      );

      // User item should have bg-gray-400 dot
      const userDot = container.querySelector('.bg-gray-400');
      expect(userDot).toBeInTheDocument();

      // Agent item should have bg-indigo-500 dot
      const agentDot = container.querySelector('.bg-indigo-500');
      expect(agentDot).toBeInTheDocument();

      // Check for text colors
      const userText = screen.getByText('User');
      expect(userText).toHaveClass('text-gray-600');

      const agentText = screen.getByText('Agent');
      expect(agentText).toHaveClass('text-indigo-600');
  });
});
