import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandPalette } from '@/features/shared/components/CommandPalette';
import { SidebarTab } from '@/types';

let mockAdvancedFeaturesEnabled = false;
let mockExperimentalFeaturesEnabled = false;

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      advancedFeaturesEnabled: mockAdvancedFeaturesEnabled,
      experimentalFeaturesEnabled: mockExperimentalFeaturesEnabled,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock layout store
const mockOpenTabWithPanel = vi.fn();
const mockToggleView = vi.fn();
const mockToggleTheme = vi.fn();
const mockToggleSidebar = vi.fn();
const mockSetToolsCollapsed = vi.fn();
const mockResetToProjectDashboard = vi.fn();
const mockUseLayoutStore = vi.fn();

const createLayoutStoreMock = (overrides = {}) => ({
  openTabWithPanel: mockOpenTabWithPanel,
  toggleView: mockToggleView,
  toggleTheme: mockToggleTheme,
  toggleSidebar: mockToggleSidebar,
  setToolsCollapsed: mockSetToolsCollapsed,
  resetToProjectDashboard: mockResetToProjectDashboard,
  isToolsCollapsed: false,
  ...overrides,
});

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: () => mockUseLayoutStore(),
}));

// Mock editor actions
const mockToggleZenMode = vi.fn();

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorActions: vi.fn(() => ({
    toggleZenMode: mockToggleZenMode,
  })),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: any) => (
      <div onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('CommandPalette', () => {
  const mockOnClose = vi.fn();

  // Mock scrollIntoView (not available in jsdom)
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvancedFeaturesEnabled = false;
    mockExperimentalFeaturesEnabled = false;
    mockUseLayoutStore.mockReturnValue(createLayoutStoreMock());
  });

  describe('Visibility', () => {
    it('renders when isOpen is true', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByPlaceholderText(/type a command or search/i)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<CommandPalette isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByPlaceholderText(/type a command or search/i)).not.toBeInTheDocument();
    });

    it('calls onClose when backdrop is clicked', () => {
      const { container } = render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toBeInTheDocument();
      
      fireEvent.click(backdrop!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search and Filtering', () => {
    it('displays all commands initially', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Open AI Chat')).toBeInTheDocument();
      expect(screen.getByText('Open Analysis Panel')).toBeInTheDocument();
      expect(screen.getByText('Toggle Zen Mode')).toBeInTheDocument();
      expect(screen.getByText('Toggle Dark/Light Mode')).toBeInTheDocument();
    });

    it('hides advanced and experimental navigation commands when disabled', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByText('Open History')).not.toBeInTheDocument();
      expect(screen.queryByText('Open Character Graph')).not.toBeInTheDocument();
      expect(screen.queryByText('Open Lore Bible')).not.toBeInTheDocument();
      expect(screen.queryByText('Open Voice Mode')).not.toBeInTheDocument();
      expect(screen.queryByText('Open Story Versions')).not.toBeInTheDocument();
    });

    it('filters commands by label', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.change(input, { target: { value: 'zen' } });

      expect(screen.getByText('Toggle Zen Mode')).toBeInTheDocument();
      expect(screen.queryByText('Open AI Chat')).not.toBeInTheDocument();
    });

    it('filters commands by description', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.change(input, { target: { value: 'assistant' } });

      expect(screen.getByText('Open AI Chat')).toBeInTheDocument();
      expect(screen.queryByText('Toggle Zen Mode')).not.toBeInTheDocument();
    });

    it('filters commands by category', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.change(input, { target: { value: 'editor' } });

      expect(screen.getByText('Toggle Zen Mode')).toBeInTheDocument();
      expect(screen.getByText('Find & Replace')).toBeInTheDocument();
      expect(screen.queryByText('Open AI Chat')).not.toBeInTheDocument();
    });

    it('shows empty state when no commands match', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.change(input, { target: { value: 'nonexistentcommand123' } });

      expect(screen.getByText('No commands found')).toBeInTheDocument();
    });

    it('is case-insensitive when filtering', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.change(input, { target: { value: 'ZEN MODE' } });

      expect(screen.getByText('Toggle Zen Mode')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('focuses input when opened', async () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command or search/i);
        expect(input).toHaveFocus();
      }, { timeout: 100 });
    });

    it('navigates down with ArrowDown key', () => {
      const { container } = render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      
      // Press ArrowDown
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Item at index 1 should be selected
      const selectedButton = container.querySelector('[data-index="1"]');
      expect(selectedButton).toHaveClass('bg-[var(--interactive-accent)]');
    });

    it('navigates up with ArrowUp key', () => {
      const { container } = render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      
      // Press ArrowDown twice, then ArrowUp
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      // Should be back at index 1
      const selectedButton = container.querySelector('[data-index="1"]');
      expect(selectedButton).toHaveClass('bg-[var(--interactive-accent)]');
    });

    it('does not navigate up beyond first item', () => {
      const { container } = render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      
      // Press ArrowUp when at first item (index 0)
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      // First item (index 0) should still be selected
      const selectedButton = container.querySelector('[data-index="0"]');
      expect(selectedButton).toHaveClass('bg-[var(--interactive-accent)]');
    });

    it('does not navigate down beyond last item', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      const buttons = screen.getAllByRole('button');
      
      // Press ArrowDown many times to exceed number of commands
      for (let i = 0; i < buttons.length + 5; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      }

      // Last item should be selected
      const lastButton = buttons[buttons.length - 1];
      expect(lastButton).toHaveClass('bg-[var(--interactive-accent)]');
    });

    it('executes selected command with Enter key', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      
      // Press Enter on first command (Open AI Chat)
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.CHAT);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes palette with Escape key', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('resets selection when query changes', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByPlaceholderText(/type a command or search/i);
      
      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Change query
      fireEvent.change(input, { target: { value: 'zen' } });

      // First command in filtered list should be selected
      const zenButton = screen.getByText('Toggle Zen Mode').closest('button');
      expect(zenButton).toHaveClass('bg-[var(--interactive-accent)]');
    });
  });

  describe('Mouse Interactions', () => {
    it('executes command when clicked', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const chatButton = screen.getByText('Open AI Chat').closest('button')!;
      fireEvent.click(chatButton);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.CHAT);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('updates selection on mouse enter', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const analysisButton = screen.getByText('Open Analysis Panel').closest('button')!;
      fireEvent.mouseEnter(analysisButton);

      expect(analysisButton).toHaveClass('bg-[var(--interactive-accent)]');
    });
  });

  describe('Command Actions', () => {
    it('executes Open AI Chat command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open AI Chat').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.CHAT);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Analysis Panel command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Analysis Panel').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.ANALYSIS);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open History command', () => {
      mockAdvancedFeaturesEnabled = true;
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open History').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.HISTORY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Memory Manager command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Memory Manager').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.MEMORY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Character Graph command', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Character Graph').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.GRAPH);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Lore Bible command', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Lore Bible').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.LORE);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Voice Mode command', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Voice Mode').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.VOICE);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Story Versions command', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const button = screen.getByText('Open Story Versions').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.BRANCHES);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Open Settings command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Open Settings').closest('button')!;
      fireEvent.click(button);

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.SETTINGS);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Toggle Storyboard View command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Toggle Storyboard View').closest('button')!;
      fireEvent.click(button);

      expect(mockToggleView).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Return to Library command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Return to Library').closest('button')!;
      fireEvent.click(button);

      expect(mockResetToProjectDashboard).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Toggle Zen Mode command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Toggle Zen Mode').closest('button')!;
      fireEvent.click(button);

      expect(mockToggleZenMode).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Toggle Chapter Sidebar command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Toggle Chapter Sidebar').closest('button')!;
      fireEvent.click(button);

      expect(mockToggleSidebar).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Toggle Tools Panel command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Toggle Tools Panel').closest('button')!;
      fireEvent.click(button);

      expect(mockSetToolsCollapsed).toHaveBeenCalledWith(true);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('opens tools panel when already collapsed', () => {
      mockUseLayoutStore.mockReturnValue(createLayoutStoreMock({ isToolsCollapsed: true }));
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const button = screen.getByText('Toggle Tools Panel').closest('button')!;
      fireEvent.click(button);

      expect(mockSetToolsCollapsed).toHaveBeenCalledWith(false);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('executes Toggle Dark/Light Mode command', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Toggle Dark/Light Mode').closest('button')!;
      fireEvent.click(button);

      expect(mockToggleTheme).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes palette when Find & Replace command is selected', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);
      
      const button = screen.getByText('Find & Replace').closest('button')!;
      fireEvent.click(button);

      // This command just closes the palette to let keyboard shortcut handle it
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Category Grouping', () => {
    it('displays category headers', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('groups commands under correct categories', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const navSection = screen.getByText('Navigation').closest('div');
      expect(navSection).toBeInTheDocument();
      
      // Navigation commands should be near the Navigation header
      expect(screen.getByText('Open AI Chat')).toBeInTheDocument();
    });
  });

  describe('Shortcuts Display', () => {
    it('displays keyboard shortcuts when available', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Ctrl+Shift+Z')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+F')).toBeInTheDocument();
    });
  });
});
