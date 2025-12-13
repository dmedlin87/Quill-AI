import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, type Mock } from 'vitest';
import { NavigationRail } from '@/features/layout/NavigationRail';
import { SidebarTab, MainView } from '@/types';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';
import { OrbStatus } from '@/features/agent';

// Mock dependencies
vi.mock('@/features/layout/store/useLayoutStore');

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

// Mock components
vi.mock('@/features/agent', () => ({
  AIPresenceOrb: ({ onClick, status }: any) => (
    <div data-testid="ai-presence-orb" onClick={onClick}>
      Orb Status: {status}
    </div>
  ),
  OrbStatus: {
    Idle: 'idle',
    Thinking: 'thinking',
    Speaking: 'speaking',
    Listening: 'listening',
  }
}));

vi.mock('@/features/shared/components/AccessibleTooltip', () => ({
  AccessibleTooltip: ({ children, content }: any) => (
    <div data-testid="tooltip" title={typeof content === 'string' ? content : 'Rich Content'}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/components/Icons', () => ({
  ZenIcon: () => <span>ZenIcon</span>,
  AnalysisIcon: () => <span>AnalysisIcon</span>,
  HistoryIcon: () => <span>HistoryIcon</span>,
  MicIcon: () => <span>MicIcon</span>,
  WandIcon: () => <span>WandIcon</span>,
  GraphIcon: () => <span>GraphIcon</span>,
  BookIcon: () => <span>BookIcon</span>,
  MemoryIcon: () => <span>MemoryIcon</span>,
  BoardIcon: () => <span>BoardIcon</span>,
  SunIcon: () => <span>SunIcon</span>,
  MoonIcon: () => <span>MoonIcon</span>,
  SettingsIcon: () => <span>SettingsIcon</span>,
  HomeIcon: () => <span>HomeIcon</span>,
  VersionsIcon: () => <span>VersionsIcon</span>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
  },
}));

describe('NavigationRail', () => {
  const mockToggleZenMode = vi.fn();
  const mockStore = {
    activeTab: SidebarTab.ANALYSIS,
    activeView: MainView.EDITOR,
    theme: 'light',
    currentPersonaIndex: 0,
    openTabWithPanel: vi.fn(),
    toggleView: vi.fn(),
    toggleTheme: vi.fn(),
    resetToProjectDashboard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvancedFeaturesEnabled = false;
    mockExperimentalFeaturesEnabled = false;
    (useLayoutStore as unknown as Mock).mockReturnValue(mockStore);
    (useLayoutStore.getState as unknown as Mock).mockReturnValue(mockStore);
  });

  const defaultProps = {
    isZenMode: false,
    toggleZenMode: mockToggleZenMode,
    orbStatus: 'idle' as OrbStatus,
    analysisReady: true,
  };

  it('renders navigation items', () => {
    render(<NavigationRail {...defaultProps} />);
    expect(screen.getByLabelText('Analysis')).toBeInTheDocument();
    expect(screen.queryByLabelText('History')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Voice')).not.toBeInTheDocument();
  });

  it('handles tab switching', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Analysis'));
    expect(mockStore.openTabWithPanel).toHaveBeenCalledWith(SidebarTab.ANALYSIS);
  });

  it('handles view toggle', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Switch to Story Board'));
    expect(mockStore.toggleView).toHaveBeenCalled();
  });

  it('handles theme toggle', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Switch to Dark Mode'));
    expect(mockStore.toggleTheme).toHaveBeenCalled();
  });

  it('handles zen mode toggle', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Enter Zen Mode'));
    expect(mockToggleZenMode).toHaveBeenCalled();
  });

  it('handles settings click', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(mockStore.openTabWithPanel).toHaveBeenCalledWith(SidebarTab.SETTINGS);
  });

  it('handles orb click', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByTestId('ai-presence-orb'));
    expect(mockStore.openTabWithPanel).toHaveBeenCalledWith(SidebarTab.CHAT);
  });

  it('handles home click', () => {
    render(<NavigationRail {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Return to Library'));
    expect(mockStore.resetToProjectDashboard).toHaveBeenCalled();
  });

  it('renders correctly in zen mode', () => {
    render(<NavigationRail {...defaultProps} isZenMode={true} />);
    const nav = screen.getByLabelText('Main navigation');
    expect(nav).toHaveAttribute('aria-hidden', 'true');
    // Framer motion styles are applied inline, so we check if props were passed
    // In this mock, we just render nav, so we can't check x/opacity easily without better mocks
    // But we can check the exit button state if it changes text
    // The button text changes based on isZenMode prop
    expect(screen.getByLabelText('Exit Zen Mode')).toBeInTheDocument();
  });

  it('displays correct tooltip for home button', () => {
    render(<NavigationRail {...defaultProps} />);
    // Since we mock tooltip to just render a div with title
    expect(screen.getByTitle('Return to Project Library')).toBeInTheDocument();
  });

  it('updates view toggle icon/tooltip based on activeView', () => {
    (useLayoutStore as unknown as Mock).mockReturnValue({
      ...mockStore,
      activeView: MainView.STORYBOARD
    });
    render(<NavigationRail {...defaultProps} />);
    expect(screen.getByLabelText('Switch to Editor')).toBeInTheDocument();
  });

  it('updates theme toggle icon/tooltip based on theme', () => {
    (useLayoutStore as unknown as Mock).mockReturnValue({
      ...mockStore,
      theme: 'dark'
    });
    render(<NavigationRail {...defaultProps} />);
    expect(screen.getByLabelText('Switch to Light Mode')).toBeInTheDocument();
  });
});
