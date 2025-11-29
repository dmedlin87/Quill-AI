import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { VersionControlPanel } from '@/features/editor/components/VersionControlPanel';
import { Branch } from '@/types/schema';

const mockBranches: Branch[] = [
  {
    id: 'branch-1',
    name: 'Darker Ending',
    content: 'The hero falls into darkness.\nAll hope is lost.',
    createdAt: Date.now() - 86400000, // 1 day ago
  },
  {
    id: 'branch-2',
    name: 'Alternate Timeline',
    content: 'The hero arrives earlier.\nThe villain is unprepared.',
    createdAt: Date.now() - 43200000, // 12 hours ago
  },
];

const defaultProps = {
  branches: mockBranches,
  activeBranchId: null,
  mainContent: 'The hero stands victorious.\nPeace is restored.',
  onCreateBranch: vi.fn(),
  onSwitchBranch: vi.fn(),
  onMergeBranch: vi.fn(),
  onDeleteBranch: vi.fn(),
  onRenameBranch: vi.fn(),
};

describe('VersionControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the header and branch count', () => {
      render(<VersionControlPanel {...defaultProps} />);

      expect(screen.getByText('Chapter Branches')).toBeInTheDocument();
      expect(screen.getByText('2 branches')).toBeInTheDocument();
    });

    it('renders singular branch count when only one branch', () => {
      render(<VersionControlPanel {...defaultProps} branches={[mockBranches[0]]} />);

      expect(screen.getByText('1 branch')).toBeInTheDocument();
    });

    it('renders the main branch option', () => {
      render(<VersionControlPanel {...defaultProps} />);

      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByText('Original chapter content')).toBeInTheDocument();
    });

    it('renders all branches with their names', () => {
      render(<VersionControlPanel {...defaultProps} />);

      expect(screen.getByText('Darker Ending')).toBeInTheDocument();
      expect(screen.getByText('Alternate Timeline')).toBeInTheDocument();
    });

    it('shows ACTIVE label on main when no branch is active', () => {
      render(<VersionControlPanel {...defaultProps} activeBranchId={null} />);

      const activeLabels = screen.getAllByText('ACTIVE');
      expect(activeLabels).toHaveLength(1);
    });

    it('shows ACTIVE label on the active branch', () => {
      render(<VersionControlPanel {...defaultProps} activeBranchId="branch-1" />);

      const activeLabels = screen.getAllByText('ACTIVE');
      expect(activeLabels).toHaveLength(1);
      expect(screen.getByText('Darker Ending').closest('div')).toContainElement(activeLabels[0]);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no branches exist', () => {
      render(<VersionControlPanel {...defaultProps} branches={[]} />);

      expect(screen.getByText('No branches yet')).toBeInTheDocument();
      expect(screen.getByText('Create a branch to experiment with alternate versions')).toBeInTheDocument();
    });

    it('shows 0 branches count', () => {
      render(<VersionControlPanel {...defaultProps} branches={[]} />);

      expect(screen.getByText('0 branches')).toBeInTheDocument();
    });
  });

  describe('create branch', () => {
    it('shows input form when Create Branch button is clicked', () => {
      render(<VersionControlPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));

      expect(screen.getByPlaceholderText("Branch name (e.g., 'Darker Ending')")).toBeInTheDocument();
    });

    it('triggers onCreateBranch callback with name and content', () => {
      const onCreateBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onCreateBranch={onCreateBranch} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));
      
      const input = screen.getByPlaceholderText("Branch name (e.g., 'Darker Ending')");
      fireEvent.change(input, { target: { value: 'New Version' } });
      
      fireEvent.click(screen.getByRole('button', { name: 'Create Branch' }));

      expect(onCreateBranch).toHaveBeenCalledWith('New Version', defaultProps.mainContent);
    });

    it('creates branch on Enter key press', () => {
      const onCreateBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onCreateBranch={onCreateBranch} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));
      
      const input = screen.getByPlaceholderText("Branch name (e.g., 'Darker Ending')");
      fireEvent.change(input, { target: { value: 'Enter Test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onCreateBranch).toHaveBeenCalledWith('Enter Test', defaultProps.mainContent);
    });

    it('cancels branch creation on Escape key', () => {
      render(<VersionControlPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));
      
      const input = screen.getByPlaceholderText("Branch name (e.g., 'Darker Ending')");
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByPlaceholderText("Branch name (e.g., 'Darker Ending')")).not.toBeInTheDocument();
    });

    it('disables create button when input is empty', () => {
      render(<VersionControlPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));

      const createBtn = screen.getByRole('button', { name: 'Create Branch' });
      expect(createBtn).toBeDisabled();
    });

    it('does not call onCreateBranch when input is empty', () => {
      const onCreateBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onCreateBranch={onCreateBranch} />);

      fireEvent.click(screen.getByRole('button', { name: /create branch/i }));
      
      const input = screen.getByPlaceholderText("Branch name (e.g., 'Darker Ending')");
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onCreateBranch).not.toHaveBeenCalled();
    });
  });

  describe('switch branch', () => {
    it('triggers onSwitchBranch when clicking Switch button', () => {
      const onSwitchBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onSwitchBranch={onSwitchBranch} />);

      const switchButtons = screen.getAllByText('Switch');
      fireEvent.click(switchButtons[0]);

      expect(onSwitchBranch).toHaveBeenCalledWith('branch-1');
    });

    it('triggers onSwitchBranch(null) when clicking Main branch', () => {
      const onSwitchBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} activeBranchId="branch-1" onSwitchBranch={onSwitchBranch} />);

      fireEvent.click(screen.getByText('Main'));

      expect(onSwitchBranch).toHaveBeenCalledWith(null);
    });

    it('does not show Switch button on active branch', () => {
      render(<VersionControlPanel {...defaultProps} activeBranchId="branch-1" />);

      // Only branch-2 should have a Switch button
      const switchButtons = screen.getAllByText('Switch');
      expect(switchButtons).toHaveLength(1);
    });
  });

  describe('merge branch', () => {
    it('shows merge preview when clicking Merge button', () => {
      render(<VersionControlPanel {...defaultProps} />);

      const mergeButtons = screen.getAllByText('Merge');
      fireEvent.click(mergeButtons[0]);

      expect(screen.getByText("This will replace the main content with this branch's content.")).toBeInTheDocument();
      expect(screen.getByText('Confirm Merge')).toBeInTheDocument();
    });

    it('triggers onMergeBranch when confirming merge', () => {
      const onMergeBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onMergeBranch={onMergeBranch} />);

      const mergeButtons = screen.getAllByText('Merge');
      fireEvent.click(mergeButtons[0]);

      fireEvent.click(screen.getByText('Confirm Merge'));

      expect(onMergeBranch).toHaveBeenCalledWith('branch-1');
    });

    it('hides merge preview when clicking Cancel', () => {
      render(<VersionControlPanel {...defaultProps} />);

      const mergeButtons = screen.getAllByText('Merge');
      fireEvent.click(mergeButtons[0]);

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Confirm Merge')).not.toBeInTheDocument();
    });

    it('toggles merge preview to Hide Preview', () => {
      render(<VersionControlPanel {...defaultProps} />);

      const mergeButtons = screen.getAllByText('Merge');
      fireEvent.click(mergeButtons[0]);

      expect(screen.getByText('Hide Preview')).toBeInTheDocument();
    });
  });

  describe('delete branch', () => {
    it('triggers onDeleteBranch when clicking Delete', () => {
      const onDeleteBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onDeleteBranch={onDeleteBranch} />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(onDeleteBranch).toHaveBeenCalledWith('branch-1');
    });
  });

  describe('rename branch', () => {
    it('shows input field when clicking Rename', () => {
      render(<VersionControlPanel {...defaultProps} />);

      const renameButtons = screen.getAllByText('Rename');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Darker Ending');
      expect(input).toBeInTheDocument();
    });

    it('triggers onRenameBranch on blur', () => {
      const onRenameBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onRenameBranch={onRenameBranch} />);

      const renameButtons = screen.getAllByText('Rename');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Darker Ending');
      fireEvent.change(input, { target: { value: 'Updated Name' } });
      fireEvent.blur(input);

      expect(onRenameBranch).toHaveBeenCalledWith('branch-1', 'Updated Name');
    });

    it('triggers onRenameBranch on Enter key', () => {
      const onRenameBranch = vi.fn();
      render(<VersionControlPanel {...defaultProps} onRenameBranch={onRenameBranch} />);

      const renameButtons = screen.getAllByText('Rename');
      fireEvent.click(renameButtons[0]);

      const input = screen.getByDisplayValue('Darker Ending');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onRenameBranch).toHaveBeenCalledWith('branch-1', 'New Name');
    });
  });
});
