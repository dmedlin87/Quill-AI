import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsPanel } from '@/features/layout/ToolsPanel';
import { SidebarTab } from '@/types';

// Mock layout store with configurable activeTab
let mockActiveTab = SidebarTab.ANALYSIS;
let mockIsToolsCollapsed = false;
let mockIsToolsPanelExpanded = false;
let mockToolsPanelWidth = 380;
const mockHandleFixRequest = vi.fn();
const mockHandleSelectGraphCharacter = vi.fn();
const mockHandleInterviewCharacter = vi.fn();
const mockClearChatInitialMessage = vi.fn();
const mockExitInterview = vi.fn();
const mockSetToolsPanelWidth = vi.fn((width: number) => {
  mockToolsPanelWidth = width;
});
const mockToggleToolsPanelExpanded = vi.fn(() => {
  mockIsToolsPanelExpanded = !mockIsToolsPanelExpanded;
});

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: vi.fn((selector) => {
    const state = {
      activeTab: mockActiveTab,
      isToolsCollapsed: mockIsToolsCollapsed,
      chatInitialMessage: undefined,
      interviewTarget: null,
      toolsPanelWidth: mockToolsPanelWidth,
      isToolsPanelExpanded: mockIsToolsPanelExpanded,
      clearChatInitialMessage: mockClearChatInitialMessage,
      exitInterview: mockExitInterview,
      handleFixRequest: mockHandleFixRequest,
      handleSelectGraphCharacter: mockHandleSelectGraphCharacter,
      handleInterviewCharacter: mockHandleInterviewCharacter,
      setToolsPanelWidth: mockSetToolsPanelWidth,
      toggleToolsPanelExpanded: mockToggleToolsPanelExpanded,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children, mode }: any) => <>{children}</>,
}));

// Mock child components to isolate ToolsPanel testing
vi.mock('@/features/agent', () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat Interface</div>,
  ActivityFeed: ({ history }: any) => (
    <div data-testid="activity-feed">Activity Feed ({history.length} items)</div>
  ),
}));

vi.mock('@/features/analysis', () => ({
  Dashboard: ({ isLoading, warning }: any) => (
    <div data-testid="analysis-dashboard" data-loading={isLoading} data-warning={warning?.message || warning}>
      Analysis Dashboard
    </div>
  ),
}));

vi.mock('@/features/voice', () => ({
  VoiceMode: () => <div data-testid="voice-mode">Voice Mode</div>,
}));

vi.mock('@/features/lore', () => ({
  KnowledgeGraph: () => <div data-testid="knowledge-graph">Knowledge Graph</div>,
  LoreManager: () => <div data-testid="lore-manager">Lore Manager</div>,
}));

vi.mock('@/features/memory', () => ({
  MemoryManager: () => <div data-testid="memory-manager">Memory Manager</div>,
}));

vi.mock('@/features/settings', () => ({
  DeveloperModeToggle: () => <div data-testid="developer-mode-toggle">Dev Mode</div>,
  ThemeSelector: () => <div data-testid="theme-selector">Theme Selector</div>,
}));

vi.mock('@/features/settings/components/RelevanceTuning', () => ({
  RelevanceTuning: () => <div data-testid="relevance-tuning">Relevance Tuning</div>,
}));

vi.mock('@/features/shared/components/DesignSystemKitchenSink', () => ({
  DesignSystemKitchenSink: () => <div data-testid="design-system-kitchen-sink">Design System</div>,
}));

// Mock settings store
let mockDeveloperModeEnabled = false;
vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = { developerModeEnabled: mockDeveloperModeEnabled };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

describe('ToolsPanel', () => {
  const defaultProps = {
    isZenMode: false,
    currentText: 'Sample text content',
    editorContext: {
      cursorPosition: 0,
      selection: null,
      totalLength: 100,
    },
    projectId: 'project-1',
    lore: {},
    chapters: [],
    analysis: null,
    history: [{ id: '1', text: 'test' }],
    isAnalyzing: false,
    analysisWarning: undefined,
    onAgentAction: vi.fn().mockResolvedValue('success'),
    onRestore: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTab = SidebarTab.ANALYSIS;
    mockIsToolsCollapsed = false;
    mockIsToolsPanelExpanded = false;
    mockToolsPanelWidth = 380;
    mockDeveloperModeEnabled = false;
  });

  describe('Visibility', () => {
    it.each([
      { collapsed: false, zen: false, expanded: false, shouldRender: true },
      { collapsed: true, zen: false, expanded: false, shouldRender: false },
      { collapsed: false, zen: true, expanded: false, shouldRender: false },
      { collapsed: false, zen: false, expanded: true, shouldRender: true },
    ])('renders based on collapse/zen/expanded state %#', ({ collapsed, zen, expanded, shouldRender }) => {
      mockIsToolsCollapsed = collapsed;
      mockIsToolsPanelExpanded = expanded;

      render(<ToolsPanel {...defaultProps} isZenMode={zen} />);

      if (shouldRender) {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
      } else {
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      }
    });

    it('has correct aria-label based on active tab', () => {
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByRole('complementary')).toHaveAttribute(
        'aria-label',
        'ANALYSIS panel'
      );
    });
  });

  describe('Panel Header', () => {
    it('displays active tab name in header', () => {
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByText('ANALYSIS')).toBeInTheDocument();
    });
  });

  describe('Tab Content: Analysis', () => {
    it('renders Dashboard when activeTab is ANALYSIS', () => {
      mockActiveTab = SidebarTab.ANALYSIS;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('analysis-dashboard')).toBeInTheDocument();
    });

    it('passes isAnalyzing prop to Dashboard', () => {
      mockActiveTab = SidebarTab.ANALYSIS;
      render(<ToolsPanel {...defaultProps} isAnalyzing={true} />);

      expect(screen.getByTestId('analysis-dashboard')).toHaveAttribute('data-loading', 'true');
    });

    it('passes warning prop to Dashboard', () => {
      mockActiveTab = SidebarTab.ANALYSIS;
      render(<ToolsPanel {...defaultProps} analysisWarning={{ message: 'Test warning' }} />);

      expect(screen.getByTestId('analysis-dashboard')).toHaveAttribute('data-warning', 'Test warning');
    });
  });

  describe('Tab Content: Chat', () => {
    it('renders ChatInterface when activeTab is CHAT', () => {
      mockActiveTab = SidebarTab.CHAT;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });
  });

  describe('Tab Content: History', () => {
    it('renders ActivityFeed when activeTab is HISTORY', () => {
      mockActiveTab = SidebarTab.HISTORY;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('passes history items to ActivityFeed', () => {
      mockActiveTab = SidebarTab.HISTORY;
      render(<ToolsPanel {...defaultProps} history={[{ id: '1' }, { id: '2' }]} />);

      expect(screen.getByText('Activity Feed (2 items)')).toBeInTheDocument();
    });
  });

  describe('Tab Content: Voice', () => {
    it('renders VoiceMode when activeTab is VOICE', () => {
      mockActiveTab = SidebarTab.VOICE;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('voice-mode')).toBeInTheDocument();
    });
  });

  describe('Tab Content: Memory', () => {
    it('renders MemoryManager when activeTab is MEMORY', () => {
      mockActiveTab = SidebarTab.MEMORY;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('memory-manager')).toBeInTheDocument();
    });
  });

  describe('Tab Content: Graph', () => {
    it('renders KnowledgeGraph when activeTab is GRAPH', () => {
      mockActiveTab = SidebarTab.GRAPH;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('knowledge-graph')).toBeInTheDocument();
    });
  });

  describe('Tab Content: Lore', () => {
    it('renders LoreManager when activeTab is LORE', () => {
      mockActiveTab = SidebarTab.LORE;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('lore-manager')).toBeInTheDocument();
    });
  });

  describe('Content Switching', () => {
    it('only renders one panel content at a time', () => {
      mockActiveTab = SidebarTab.ANALYSIS;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('analysis-dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-interface')).not.toBeInTheDocument();
      expect(screen.queryByTestId('activity-feed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('voice-mode')).not.toBeInTheDocument();
      expect(screen.queryByTestId('knowledge-graph')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lore-manager')).not.toBeInTheDocument();
    });
  });

  describe('Tab Content: Settings', () => {
    it('renders Settings tab with ThemeSelector', () => {
      mockActiveTab = SidebarTab.SETTINGS;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
    });

    it('does not render DesignSystemKitchenSink when developer mode is off', () => {
      mockActiveTab = SidebarTab.SETTINGS;
      mockDeveloperModeEnabled = false;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.queryByTestId('design-system-kitchen-sink')).not.toBeInTheDocument();
    });

    it('renders DesignSystemKitchenSink when developer mode is enabled', () => {
      mockActiveTab = SidebarTab.SETTINGS;
      mockDeveloperModeEnabled = true;
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('design-system-kitchen-sink')).toBeInTheDocument();
    });
  });

  describe('Panel Header', () => {
    it('renders DeveloperModeToggle', () => {
      render(<ToolsPanel {...defaultProps} />);

      expect(screen.getByTestId('developer-mode-toggle')).toBeInTheDocument();
    });

    it('renders expand/collapse button', () => {
      render(<ToolsPanel {...defaultProps} />);

      const button = screen.getByTitle('Expand to fullscreen');
      expect(button).toBeInTheDocument();
    });

    it('toggles aria labels and layout classes when expanding and collapsing', () => {
      const { rerender } = render(<ToolsPanel {...defaultProps} />);

      const panel = screen.getByRole('complementary');
      const button = screen.getByLabelText('Expand to fullscreen');

      expect(panel.className).toContain('relative');
      expect(panel.className).not.toContain('fixed');

      fireEvent.click(button);
      expect(mockToggleToolsPanelExpanded).toHaveBeenCalled();

      rerender(<ToolsPanel {...defaultProps} />);

      expect(screen.getByLabelText('Exit fullscreen')).toBeInTheDocument();
      expect(screen.getByRole('complementary').className).toContain('fixed');
      expect(screen.getByRole('complementary').className).toContain('inset-0');

      fireEvent.click(screen.getByLabelText('Exit fullscreen'));
      rerender(<ToolsPanel {...defaultProps} />);

      expect(screen.getByLabelText('Expand to fullscreen')).toBeInTheDocument();
      expect(screen.getByRole('complementary').className).toContain('relative');
    });
  });

  describe('Resize Handle', () => {
    it('calls setToolsPanelWidth with drag delta and clears resizing on mouseup', () => {
      mockToolsPanelWidth = 400;
      const { unmount } = render(<ToolsPanel {...defaultProps} />);

      const resizeHandle = screen.getByTitle('Drag to resize');

      fireEvent.mouseDown(resizeHandle, { clientX: 500 });
      expect(screen.getByRole('complementary').className).toContain('select-none');

      fireEvent.mouseMove(document, { clientX: 450 });
      expect(mockSetToolsPanelWidth).toHaveBeenCalledWith(450);

      fireEvent.mouseUp(document);
      expect(screen.getByRole('complementary').className).not.toContain('select-none');

      mockSetToolsPanelWidth.mockClear();
      unmount();
      fireEvent.mouseMove(document, { clientX: 400 });
      expect(mockSetToolsPanelWidth).not.toHaveBeenCalled();
    });
  });
});
