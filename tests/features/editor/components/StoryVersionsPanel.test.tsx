import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StoryVersionsPanel from '@/features/editor/components/StoryVersionsPanel';
import { Branch } from '@/types/schema';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: any) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock UI components to avoid dependency issues
vi.mock('@/features/shared/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, className, title }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-variant={variant}
      className={className}
      title={title}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, autoFocus, onKeyDown }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-autofocus={autoFocus}
      onKeyDown={onKeyDown}
    />
  ),
}));

describe('StoryVersionsPanel', () => {
  const mockBranches: Branch[] = [
    {
      id: 'branch-1',
      name: 'Original Draft',
      content: 'This is the original content.',
      createdAt: Date.now(),
      lastModified: Date.now(),
      authorId: 'user-1',
      chapterId: 'chapter-1',
    },
    {
      id: 'branch-2',
      name: 'Experimental Twist',
      content: 'Twist content.',
      createdAt: Date.now() - 10000,
      lastModified: Date.now() - 5000,
      authorId: 'user-1',
      chapterId: 'chapter-1',
    },
  ];

  const defaultProps = {
    branches: mockBranches,
    activeBranchId: 'branch-1',
    mainContent: 'This is the original content.',
    chapterTitle: 'Chapter 1',
    onCreateBranch: vi.fn(),
    onSwitchBranch: vi.fn(),
    onMergeBranch: vi.fn(),
    onDeleteBranch: vi.fn(),
    onRenameBranch: vi.fn(),
  };

  it('renders correctly with branches', () => {
    render(<StoryVersionsPanel {...defaultProps} />);
    expect(screen.getByText('Story Versions')).toBeInTheDocument();
    expect(screen.getByText('Original Draft')).toBeInTheDocument();
  });

  it('renders "Original" badge/button correctly', () => {
    render(<StoryVersionsPanel {...defaultProps} activeBranchId={null} />);
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('allows creating a new branch', async () => {
    const user = userEvent.setup();
    render(<StoryVersionsPanel {...defaultProps} />);

    // 1. Initial State: Creating mode is off.
    const startButton = screen.getByText('Try a New Direction');
    await user.click(startButton);

    // 2. Creating Mode: Input should be visible now.
    const input = screen.getByPlaceholderText(/e\.g\.,/); // Should match partial placeholder
    await user.type(input, 'New Version');
    
    // 3. Click Create
    const createButton = screen.getByText('Create Version');
    await user.click(createButton);

    expect(defaultProps.onCreateBranch).toHaveBeenCalledWith('New Version');
  });

  it('allows switching branches', async () => {
    const user = userEvent.setup();
    render(<StoryVersionsPanel {...defaultProps} activeBranchId="branch-1" />);

    // Switch to branch-2
    // Look for the "View" button associated with branch-2 (Experimental Twist)
    // Since we mock Button, we can search by text "View". 
    // However, there might be multiple "View" buttons if multiple branches. 
    // We should scope it.
    
    // Find the container for branch-2
    const branch2Name = screen.getByText('Experimental Twist');
    const branch2Container = branch2Name.closest('div.border-2')?.parentElement; // Adjust selector based on DOM
    
    // Simpler approach: Get all View buttons. Since branch-1 is active, it won't have View button (it has "Active" tag?).
    // Actually Logic: 
    // !isActive && ( <Button>View</Button> )
    // branch-2 is NOT active. So it should have a View button.
    
    const viewButtons = screen.getAllByText('View');
    // Assuming branch-2 is the only inactive branch in the list that isn't editing.
    // In mockBranches: branch-1 (active), branch-2 (inactive). So only 1 view button.
    
    await user.click(viewButtons[0]);

    expect(defaultProps.onSwitchBranch).toHaveBeenCalledWith('branch-2');
  });

  it('handles delete action', async () => {
    const user = userEvent.setup();
    render(<StoryVersionsPanel {...defaultProps} activeBranchId="branch-1" />);

    // Find the delete button for branch-2 specifically
    // We can find the branch container first
    const branch2Name = screen.getByText('Experimental Twist');
    // Traverse up to the container
    const branch2Container = branch2Name.closest('div.border-2')?.parentElement;
    
    // Within this container, find the Delete button
    // Since we mocked Button with children, we can search for text
    // We need to use within() to scope the search
    if (!branch2Container) throw new Error('Branch 2 container not found');
    
    // Note: The structure in the test might be slightly different than DOM expectation if mocks behave differently
    // but text search is robust.
    
    // Let's use a more robust way: getAllByText('Delete') and check which one is for branch-2
    // Or just click the second delete button if we know the order is guaranteed (branch-1, branch-2)
    const deleteButtons = screen.getAllByText('Delete');
    // deleteButtons[0] is for branch-1
    // deleteButtons[1] is for branch-2
    await user.click(deleteButtons[1]);

    // Should show confirmation
    expect(screen.getByText('Delete this version?')).toBeInTheDocument();
    
    // Confirm delete
    const confirmButton = screen.getByText('Yes, Delete');
    await user.click(confirmButton);

    expect(defaultProps.onDeleteBranch).toHaveBeenCalledWith('branch-2');
  });
});
