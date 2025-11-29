import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SidebarTab } from '@/types';

// Mock EditorLayout
vi.mock('@/features/layout/EditorLayout', () => ({
  EditorLayout: ({ 
    activeTab, 
    onTabChange, 
    isSidebarCollapsed, 
    onToggleSidebar, 
    isToolsCollapsed, 
    onToggleTools, 
    onHomeClick 
  }: {
    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    isToolsCollapsed: boolean;
    onToggleTools: () => void;
    onHomeClick: () => void;
  }) => (
    <div data-testid="editor-layout">
      <span data-testid="active-tab">{activeTab}</span>
      <span data-testid="sidebar-collapsed">{isSidebarCollapsed.toString()}</span>
      <span data-testid="tools-collapsed">{isToolsCollapsed.toString()}</span>
      <button data-testid="change-tab" onClick={() => onTabChange(SidebarTab.CHAT)}>
        Change Tab
      </button>
      <button data-testid="toggle-sidebar" onClick={onToggleSidebar}>
        Toggle Sidebar
      </button>
      <button data-testid="toggle-tools" onClick={onToggleTools}>
        Toggle Tools
      </button>
      <button data-testid="home-click" onClick={onHomeClick}>
        Home
      </button>
    </div>
  ),
}));

import { Workspace } from '@/features/layout/Workspace';

describe('Workspace', () => {
  const mockOnHomeClick = vi.fn();

  beforeEach(() => {
    mockOnHomeClick.mockClear();
  });

  it('renders EditorLayout with initial state', () => {
    render(<Workspace onHomeClick={mockOnHomeClick} />);
    
    expect(screen.getByTestId('editor-layout')).toBeInTheDocument();
    expect(screen.getByTestId('active-tab')).toHaveTextContent(SidebarTab.ANALYSIS);
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false');
    expect(screen.getByTestId('tools-collapsed')).toHaveTextContent('false');
  });

  it('changes tab and expands tools panel', () => {
    render(<Workspace onHomeClick={mockOnHomeClick} />);
    
    fireEvent.click(screen.getByTestId('change-tab'));
    
    expect(screen.getByTestId('active-tab')).toHaveTextContent(SidebarTab.CHAT);
    // Tools should remain expanded (or expand if collapsed)
    expect(screen.getByTestId('tools-collapsed')).toHaveTextContent('false');
  });

  it('toggles sidebar collapsed state', () => {
    render(<Workspace onHomeClick={mockOnHomeClick} />);
    
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false');
    fireEvent.click(screen.getByTestId('toggle-sidebar'));
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('true');
    fireEvent.click(screen.getByTestId('toggle-sidebar'));
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false');
  });

  it('toggles tools collapsed state', () => {
    render(<Workspace onHomeClick={mockOnHomeClick} />);
    
    expect(screen.getByTestId('tools-collapsed')).toHaveTextContent('false');
    fireEvent.click(screen.getByTestId('toggle-tools'));
    expect(screen.getByTestId('tools-collapsed')).toHaveTextContent('true');
  });

  it('calls onHomeClick when home button is clicked', () => {
    render(<Workspace onHomeClick={mockOnHomeClick} />);
    
    fireEvent.click(screen.getByTestId('home-click'));
    
    expect(mockOnHomeClick).toHaveBeenCalledTimes(1);
  });
});
