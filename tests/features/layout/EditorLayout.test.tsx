import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { EditorLayout } from '@/features/layout/EditorLayout';
import { SidebarTab } from '@/types';

// Mocks
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/features/shared', () => ({
  useEditor: vi.fn(),
  useEngine: vi.fn(),
  findQuoteRange: vi.fn(),
}));

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
  ProjectSidebar: () => <div data-testid="project-sidebar">ProjectSidebar</div>,
}));

vi.mock('@/features/core/context/AppBrainContext', () => ({
  useAppBrainState: vi.fn(),
}));

vi.mock('@/features/analysis', () => ({
  AnalysisPanel: () => <div data-testid="analysis-panel">AnalysisPanel</div>,
}));

vi.mock('@/features/agent', () => ({
  ChatInterface: () => <div data-testid="chat-interface">ChatInterface</div>,
  ActivityFeed: ({ onInspect }: any) => (
    <div data-testid="activity-feed">
      <button onClick={() => onInspect({ previousContent: 'old', newContent: 'new', description: 'desc' })}>
        Inspect
      </button>
    </div>
  ),
}));

vi.mock('@/features/voice', () => ({
  VoiceMode: () => <div data-testid="voice-mode">VoiceMode</div>,
}));

vi.mock('@/features/editor', () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor">RichTextEditor</div>,
  MagicBar: () => <div data-testid="magic-bar">MagicBar</div>,
  FindReplaceModal: ({ isOpen }: any) => isOpen ? <div data-testid="find-replace-modal">FindReplaceModal</div> : null,
  VisualDiff: () => <div data-testid="visual-diff">VisualDiff</div>,
}));

vi.mock('@/features/settings', () => ({
  NativeSpellcheckToggle: () => <div data-testid="native-spellcheck-toggle">Toggle</div>,
}));

import { useEditor, useEngine, findQuoteRange } from '@/features/shared';
import { useProjectStore } from '@/features/project';
import { useAppBrainState } from '@/features/core/context/AppBrainContext';

describe('EditorLayout', () => {
  const defaultProps = {
    activeTab: SidebarTab.ANALYSIS,
    onTabChange: vi.fn(),
    isSidebarCollapsed: false,
    onToggleSidebar: vi.fn(),
    isToolsCollapsed: false,
    onToggleTools: vi.fn(),
    onHomeClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useEditor as any).mockReturnValue({
      currentText: 'Hello world',
      updateText: vi.fn(),
      setSelectionState: vi.fn(),
      selectionRange: null,
      selectionPos: null,
      activeHighlight: null,
      setEditor: vi.fn(),
      clearSelection: vi.fn(),
      editor: { state: { selection: { from: 0 } } },
      history: [],
      restore: vi.fn(),
      handleNavigateToIssue: vi.fn(),
    });

    (useEngine as any).mockReturnValue({
      state: {
        isAnalyzing: false,
        isMagicLoading: false,
        magicVariations: [],
        magicHelpResult: null,
        magicHelpType: null,
        activeMagicMode: null,
        grammarSuggestions: [],
        grammarHighlights: [],
        pendingDiff: null,
        analysisWarning: null,
      },
      actions: {
        runAnalysis: vi.fn(),
        handleRewrite: vi.fn(),
        handleHelp: vi.fn(),
        applyVariation: vi.fn(),
        handleGrammarCheck: vi.fn(),
        applyGrammarSuggestion: vi.fn(),
        applyAllGrammarSuggestions: vi.fn(),
        dismissGrammarSuggestion: vi.fn(),
        closeMagicBar: vi.fn(),
        runSelectionAnalysis: vi.fn(),
        handleAgentAction: vi.fn(),
        rejectDiff: vi.fn(),
        acceptDiff: vi.fn(),
      },
    });

    (useProjectStore as any).mockReturnValue({
      currentProject: { lore: {}, setting: { timePeriod: 'TP', location: 'Loc' } },
      getActiveChapter: () => ({ id: 'ch1', title: 'Chapter 1', lastAnalysis: null }),
      chapters: [],
    });

    (useAppBrainState as any).mockReturnValue({
      intelligence: { full: { voice: {} } },
    });
  });

  it('renders main components', () => {
    render(<EditorLayout {...defaultProps} />);
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    expect(screen.getByTestId('project-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-panel')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('TP • Loc')).toBeInTheDocument();
  });

  it('toggles tabs', () => {
    render(<EditorLayout {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Agent'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith(SidebarTab.CHAT);
  });

  it('opens find/replace on meta+f', () => {
    render(<EditorLayout {...defaultProps} />);
    expect(screen.queryByTestId('find-replace-modal')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(screen.getByTestId('find-replace-modal')).toBeInTheDocument();
  });

  it('shows magic bar when selection exists', () => {
    (useEditor as any).mockReturnValue({
      ...useEditor(),
      selectionRange: { text: 'selected' },
      selectionPos: { top: 10, left: 10 },
    });

    render(<EditorLayout {...defaultProps} />);
    expect(screen.getByTestId('magic-bar')).toBeInTheDocument();
  });

  it('renders visual diff when pendingDiff exists', () => {
    (useEngine as any).mockReturnValue({
      state: { pendingDiff: { original: 'a', modified: 'b' }, grammarHighlights: [] },
      actions: { rejectDiff: vi.fn(), acceptDiff: vi.fn() }
    });

    render(<EditorLayout {...defaultProps} />);
    expect(screen.getByTestId('visual-diff')).toBeInTheDocument();
    expect(screen.getByText('Review Agent Suggestions')).toBeInTheDocument();
  });

  it('switches panels based on activeTab', () => {
    const { rerender } = render(<EditorLayout {...defaultProps} activeTab={SidebarTab.CHAT} />);
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();

    rerender(<EditorLayout {...defaultProps} activeTab={SidebarTab.HISTORY} />);
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();

    rerender(<EditorLayout {...defaultProps} activeTab={SidebarTab.VOICE} />);
    expect(screen.getByTestId('voice-mode')).toBeInTheDocument();
  });

  it('generates analysis highlights', () => {
    (useProjectStore as any).mockReturnValue({
        currentProject: { lore: {}, setting: { timePeriod: 'TP', location: 'Loc' } },
        getActiveChapter: () => ({
            id: 'ch1',
            lastAnalysis: {
                plotIssues: [{ quote: 'issue', issue: 'Bad plot' }],
                pacing: { slowSections: ['slow'] },
                settingAnalysis: { issues: [{ quote: 'setting', issue: 'Bad setting' }] }
            }
        }),
        chapters: []
    });

    (findQuoteRange as any).mockReturnValue({ start: 0, end: 10 });

    render(<EditorLayout {...defaultProps} />);
  });

  it('handles inspect history', () => {
    render(<EditorLayout {...defaultProps} activeTab={SidebarTab.HISTORY} />);
    fireEvent.click(screen.getByText('Inspect'));
  });
});
