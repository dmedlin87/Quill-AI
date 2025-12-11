
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionControlPanel } from '@/features/editor/components/VersionControlPanel';
import { vi, describe, it, expect } from 'vitest';

describe('VersionControlPanel Accessibility', () => {
  const mockBranches = [
    {
      id: 'branch-1',
      name: 'Darker Ending',
      content: 'This is the darker ending content.',
      createdAt: new Date().toISOString(),
      baseContent: 'Original content',
    },
    {
      id: 'branch-2',
      name: 'Happy Ending',
      content: 'This is the happy ending content.',
      createdAt: new Date().toISOString(),
      baseContent: 'Original content',
    }
  ];

  const defaultProps = {
    branches: mockBranches,
    activeBranchId: null,
    mainContent: 'Original content',
    onCreateBranch: vi.fn(),
    onSwitchBranch: vi.fn(),
    onMergeBranch: vi.fn(),
    onDeleteBranch: vi.fn(),
    onRenameBranch: vi.fn(),
  };

  it('renders branch actions with accessible labels', () => {
    render(<VersionControlPanel {...defaultProps} />);

    // Check for Switch buttons
    const switchButtons = screen.getAllByRole('button', { name: /switch to/i });
    // Expect 3 buttons: 1 for Main + 2 for branches
    expect(switchButtons).toHaveLength(3);
    // The first one in the list (Main) is rendered before the list of branches
    expect(switchButtons[0]).toHaveAttribute('aria-label', 'Switch to Main branch');
    expect(switchButtons[1]).toHaveAttribute('aria-label', 'Switch to branch Darker Ending');

    // Check for Merge buttons
    const mergeButtons = screen.getAllByRole('button', { name: /merge/i });
    expect(mergeButtons).toHaveLength(2);
    expect(mergeButtons[0]).toHaveAttribute('aria-label', 'Merge branch Darker Ending');

    // Check for Rename buttons
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    expect(renameButtons).toHaveLength(2);
    expect(renameButtons[0]).toHaveAttribute('aria-label', 'Rename branch Darker Ending');

    // Check for Delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(2);
    expect(deleteButtons[0]).toHaveAttribute('aria-label', 'Delete branch Darker Ending');
  });

  it('renders diff stats with accessible labels', () => {
    // Modify one branch to ensure diff stats are non-zero.
    // The simple diff logic splits by newline. We need a new line to trigger an "addition".
    const modifiedBranches = [
      {
        ...mockBranches[0],
        content: 'Original content\nNew line added',
      }
    ];

    render(<VersionControlPanel {...defaultProps} branches={modifiedBranches} />);

    // Check for diff stats span aria-labels
    // With one new line added that isn't in 'Original content', we expect 1 addition.
    const additionStats = screen.getByLabelText(/additions/);
    expect(additionStats).toBeInTheDocument();
    expect(additionStats).toHaveTextContent('+1');
  });

  it('renders the create branch input with accessible label', () => {
    render(<VersionControlPanel {...defaultProps} />);

    // Click create to show input
    const createButton = screen.getByRole('button', { name: /create branch/i });
    fireEvent.click(createButton);

    const input = screen.getByLabelText(/new branch name/i);
    expect(input).toBeInTheDocument();
  });
});
