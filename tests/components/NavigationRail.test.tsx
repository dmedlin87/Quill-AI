import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationRail } from '@/features/layout/NavigationRail';
import { SidebarTab, MainView } from '@/types';

// Mock the layout store
const mockOpenTabWithPanel = vi.fn();
const mockToggleView = vi.fn();
const mockToggleTheme = vi.fn();
const mockResetToProjectDashboard = vi.fn();

const mockLayoutStore = {
  activeTab: SidebarTab.ANALYSIS,
  activeView: MainView.EDITOR,
  theme: 'light' as const,
  currentPersonaIndex: 0,
  openTabWithPanel: mockOpenTabWithPanel,
  toggleView: mockToggleView,
  toggleTheme: mockToggleTheme,
  resetToProjectDashboard: mockResetToProjectDashboard,
};

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: Object.assign(
    vi.fn((selector) => {
      return typeof selector === 'function' ? selector(mockLayoutStore) : mockLayoutStore;
    }),
    {
      getState: () => mockLayoutStore,
    }
  ),
}));

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

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock AIPresenceOrb
vi.mock('@/features/agent', () => ({
  AIPresenceOrb: ({ onClick, isActive, status }: any) => (
    <button data-testid="ai-orb" onClick={onClick} data-active={isActive} data-status={status}>
      AI Orb
    </button>
  ),
}));

describe('NavigationRail', () => {
  const defaultProps = {
    isZenMode: false,
    toggleZenMode: vi.fn(),
    orbStatus: 'idle' as const,
    analysisReady: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvancedFeaturesEnabled = false;
    mockExperimentalFeaturesEnabled = false;
    // Reset window.location for home button tests
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  describe('Basic Rendering', () => {
    it('renders navigation rail with aria-label', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    it('renders home button', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByLabelText('Return to Library')).toBeInTheDocument();
    });

    it('renders AI presence orb', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByTestId('ai-orb')).toBeInTheDocument();
    });

    it('hides advanced and experimental navigation items when disabled', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByLabelText('Analysis')).toBeInTheDocument();
      expect(screen.getByLabelText('Memory')).toBeInTheDocument();

      expect(screen.queryByLabelText('History')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Story Versions')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Voice')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Graph')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Lore Bible')).not.toBeInTheDocument();
    });

    it('renders advanced and experimental navigation items when enabled', () => {
      mockAdvancedFeaturesEnabled = true;
      mockExperimentalFeaturesEnabled = true;
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByLabelText('History')).toBeInTheDocument();
      expect(screen.getByLabelText('Story Versions')).toBeInTheDocument();
      expect(screen.getByLabelText('Voice')).toBeInTheDocument();
      expect(screen.getByLabelText('Graph')).toBeInTheDocument();
      expect(screen.getByLabelText('Lore Bible')).toBeInTheDocument();
    });

    it('renders zen mode button', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByLabelText('Enter Zen Mode')).toBeInTheDocument();
    });


  });

  describe('Zen Mode Behavior', () => {
    it('hides navigation when zen mode is active', () => {
      render(<NavigationRail {...defaultProps} isZenMode={true} />);

      const nav = screen.getByRole('navigation', { hidden: true });
      expect(nav).toHaveAttribute('aria-hidden', 'true');
      expect(nav).toHaveStyle({ pointerEvents: 'none' });
    });

    it('shows navigation when zen mode is inactive', () => {
      render(<NavigationRail {...defaultProps} isZenMode={false} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-hidden', 'false');
      expect(nav).toHaveStyle({ pointerEvents: 'auto' });
    });
  });

  describe('Home Button', () => {
    it('calls resetToProjectDashboard when home button is clicked', () => {
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Return to Library'));

      expect(mockResetToProjectDashboard).toHaveBeenCalled();
    });
  });

  describe('View Toggle', () => {
    it('shows story board toggle button', () => {
      render(<NavigationRail {...defaultProps} />);

      expect(screen.getByLabelText('Switch to Story Board')).toBeInTheDocument();
    });

    it('calls toggleView when view toggle is clicked', () => {
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Switch to Story Board'));

      expect(mockToggleView).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI Orb', () => {
    it('passes correct props to AI orb', () => {
      render(<NavigationRail {...defaultProps} orbStatus="thinking" analysisReady={true} />);

      const orb = screen.getByTestId('ai-orb');
      expect(orb).toHaveAttribute('data-status', 'thinking');
    });

    it('opens chat panel when AI orb is clicked', () => {
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByTestId('ai-orb'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.CHAT);
    });
  });

  describe('Navigation Items', () => {
    it('calls openTabWithPanel with ANALYSIS when Analysis is clicked', () => {
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Analysis'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.ANALYSIS);
    });

    it('calls openTabWithPanel with HISTORY when History is clicked', () => {
      mockAdvancedFeaturesEnabled = true;
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('History'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.HISTORY);
    });

    it('calls openTabWithPanel with VOICE when Voice is clicked', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Voice'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.VOICE);
    });

    it('calls openTabWithPanel with MEMORY when Memory is clicked', () => {
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Memory'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.MEMORY);
    });

    it('calls openTabWithPanel with GRAPH when Graph is clicked', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Graph'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.GRAPH);
    });

    it('calls openTabWithPanel with LORE when Lore Bible is clicked', () => {
      mockExperimentalFeaturesEnabled = true;
      render(<NavigationRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Lore Bible'));

      expect(mockOpenTabWithPanel).toHaveBeenCalledWith(SidebarTab.LORE);
    });
  });

  describe('Zen Mode Button', () => {
    it('calls toggleZenMode when zen button is clicked', () => {
      const toggleZenMode = vi.fn();
      render(<NavigationRail {...defaultProps} toggleZenMode={toggleZenMode} />);

      fireEvent.click(screen.getByLabelText('Enter Zen Mode'));

      expect(toggleZenMode).toHaveBeenCalledTimes(1);
    });
  });



  describe('Active Tab Indication', () => {
    it('marks active tab with aria-current', () => {
      // Analysis is active by default in mock
      render(<NavigationRail {...defaultProps} />);

      const analysisButton = screen.getByLabelText('Analysis');
      expect(analysisButton).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark inactive tabs with aria-current', () => {
      render(<NavigationRail {...defaultProps} />);

      const memoryButton = screen.getByLabelText('Memory');
      expect(memoryButton).not.toHaveAttribute('aria-current');
    });
  });
});
