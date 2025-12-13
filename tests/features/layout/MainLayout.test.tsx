import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { MainView, SidebarTab } from '@/types';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';

vi.mock('framer-motion', () => ({
  motion: {
    nav: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <nav {...props}>{children}</nav>,
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/project', () => ({
  ProjectSidebar: ({ toggleCollapsed }: { toggleCollapsed: () => void }) => (
    <div data-testid="project-sidebar">
      <button onClick={toggleCollapsed}>collapse</button>
    </div>
  ),
  // StoryBoard is lazy loaded, so we might need to mock the import itself or just this export if it was static.
  // But since it is now lazy loaded via import(), the static mock here might not work if we don't mock the module resolution.
  // However, since we are mocking `@/features/project`, the import inside MainLayout `import { ... } from '@/features/project'` uses this.
  // BUT `MainLayout` uses `import('@/features/project/components/StoryBoard')` for lazy load.
  // We need to mock that specific path.
  StoryBoard: ({ onSwitchToEditor }: { onSwitchToEditor: () => void }) => (
    <div data-testid="storyboard">
      <button onClick={onSwitchToEditor}>switch</button>
    </div>
  ),
  useProjectStore: vi.fn(),
}));

// Mock the lazy loaded component path
vi.mock('@/features/project/components/StoryBoard', () => ({
  StoryBoard: ({ onSwitchToEditor }: { onSwitchToEditor: () => void }) => (
    <div data-testid="storyboard">
      <button onClick={onSwitchToEditor}>switch</button>
    </div>
  ),
}));

vi.mock('@/features/editor', () => ({
  EditorWorkspace: () => <div data-testid="editor-workspace" />,
}));

vi.mock('@/features/layout/NavigationRail', () => ({
  NavigationRail: ({ toggleZenMode }: { toggleZenMode: () => void }) => (
    <div data-testid="navigation-rail">
      <button onClick={toggleZenMode}>nav-zen</button>
    </div>
  ),
}));

vi.mock('@/features/layout/EditorHeader', () => ({
  EditorHeader: () => <div data-testid="editor-header" />,
}));

vi.mock('@/features/layout/ToolsPanelContainer', () => ({
  ToolsPanelContainer: ({ isZenMode }: { isZenMode: boolean }) => (
    <div data-testid="tools-panel" data-zen={isZenMode} />
  ),
}));

vi.mock('@/features/layout/ZenModeOverlay', () => ({
  ZenModeOverlay: ({ toggleZenMode, isZenMode }: { toggleZenMode: () => void; isZenMode: boolean }) => (
    <button data-testid="zen-overlay" data-zen={isZenMode} onClick={toggleZenMode}>
      overlay
    </button>
  ),
}));

vi.mock('@/features/layout/UploadLayout', () => ({
  UploadLayout: () => <div data-testid="upload-layout" />,
}));

vi.mock('@/features/shared/components/LoadingScreen', () => ({
  LoadingScreen: () => <div data-testid="loading-screen">Loading...</div>,
}));

vi.mock('@/features/shared', () => ({
  useEngine: vi.fn(),
}));

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorState: vi.fn(),
  useEditorActions: vi.fn(),
}));

vi.mock('@/features/shared/components/CommandPalette', () => ({
  CommandPalette: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="command-palette"><button onClick={onClose}>close</button></div> : null,
}));

vi.mock('@/features/debug', () => ({
  BrainActivityMonitor: () => <div data-testid="brain-monitor" />,
}));

import { MainLayout } from '@/features/layout/MainLayout';
import { useProjectStore } from '@/features/project';
import { useEngine } from '@/features/shared';
import { useEditorState, useEditorActions } from '@/features/core/context/EditorContext';

const mockUseProjectStore = useProjectStore as unknown as Mock;
const mockUseEngine = useEngine as unknown as Mock;
const mockUseEditorState = useEditorState as unknown as Mock;
const mockUseEditorActions = useEditorActions as unknown as Mock;

const setupProjectStore = (hasProject: boolean) => {
  mockUseProjectStore.mockReturnValue({
    currentProject: hasProject ? { id: 'p1', title: 'Project' } : null,
    getActiveChapter: () => (hasProject ? { id: 'ch1', lastAnalysis: null } : null),
  });
};

describe('features/layout/MainLayout', () => {
  const toggleZenMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useLayoutStore.setState((state) => ({
      ...state,
      activeTab: SidebarTab.ANALYSIS,
      activeView: MainView.EDITOR,
      isSidebarCollapsed: false,
      isToolsCollapsed: false,
      theme: 'light',
    }));
    setupProjectStore(true);
    mockUseEngine.mockReturnValue({ state: { isAnalyzing: false, isMagicLoading: false } });
    mockUseEditorState.mockReturnValue({ isZenMode: false });
    mockUseEditorActions.mockReturnValue({ toggleZenMode });
  });

  it('does not clobber the visual theme attribute with the mode', () => {
    const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute');

    useLayoutStore.setState((state) => ({
      ...state,
      theme: 'light',
      visualTheme: 'parchment',
    }));

    render(<MainLayout />);

    expect(setAttributeSpy).not.toHaveBeenCalledWith('data-theme', 'light');
    expect(setAttributeSpy).not.toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('shows upload layout when no project is available', () => {
    setupProjectStore(false);
    render(<MainLayout />);

    expect(screen.getByTestId('upload-layout')).toBeInTheDocument();
  });

  it('renders sidebar unless collapsed or zen mode is active', () => {
    const view = render(<MainLayout />);
    expect(screen.getByTestId('project-sidebar')).toBeInTheDocument();

    act(() => {
      useLayoutStore.setState({ isSidebarCollapsed: true } as Partial<ReturnType<typeof useLayoutStore.getState>>);
    });
    view.rerender(<MainLayout />);
    expect(screen.queryByTestId('project-sidebar')).not.toBeInTheDocument();

    mockUseEditorState.mockReturnValue({ isZenMode: true });
    view.rerender(<MainLayout />);
    expect(screen.queryByTestId('project-sidebar')).not.toBeInTheDocument();
  });

  it('switches between storyboard and editor views', async () => {
    useLayoutStore.setState({ activeView: MainView.STORYBOARD } as Partial<ReturnType<typeof useLayoutStore.getState>>);
    render(<MainLayout />);

    // Since StoryBoard is lazy loaded, we might see the fallback first.
    // However, with the mock immediately available, it might render synchronously or in next tick.
    // Let's waitFor it.
    await waitFor(() => {
      expect(screen.getByTestId('storyboard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('switch'));
    expect(screen.getByTestId('editor-workspace')).toBeInTheDocument();
  });

  it('passes zen mode toggles through navigation and overlay', () => {
    render(<MainLayout />);

    fireEvent.click(screen.getByText('nav-zen'));
    fireEvent.click(screen.getByTestId('zen-overlay'));

    expect(toggleZenMode).toHaveBeenCalledTimes(2);
  });

  it('opens command palette with Ctrl+K', () => {
    render(<MainLayout />);

    // Command palette should be closed initially
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();

    // Trigger Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    // Command palette should now be visible
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  it('toggles command palette on subsequent Ctrl+K presses', () => {
    render(<MainLayout />);

    // Open
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();

    // Close
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('derives thinking orb status when analyzing', () => {
    mockUseEngine.mockReturnValue({ state: { isAnalyzing: true, isMagicLoading: false } });
    render(<MainLayout />);

    const navRail = screen.getByTestId('navigation-rail');
    expect(navRail).toBeInTheDocument();
  });

  it('derives writing orb status when magic loading', () => {
    mockUseEngine.mockReturnValue({ state: { isAnalyzing: false, isMagicLoading: true } });
    render(<MainLayout />);

    const navRail = screen.getByTestId('navigation-rail');
    expect(navRail).toBeInTheDocument();
  });

  it('derives dreaming orb status when dreaming', () => {
    mockUseEngine.mockReturnValue({ state: { isAnalyzing: false, isMagicLoading: false, isDreaming: true } });
    render(<MainLayout />);

    const navRail = screen.getByTestId('navigation-rail');
    expect(navRail).toBeInTheDocument();
  });

  it('renders editor workspace in editor view', () => {
    render(<MainLayout />);

    expect(screen.getByTestId('editor-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('editor-header')).toBeInTheDocument();
  });

  it('renders tools panel container', () => {
    render(<MainLayout />);

    expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
  });
});
