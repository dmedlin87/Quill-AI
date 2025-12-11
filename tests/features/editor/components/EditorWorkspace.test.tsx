
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorWorkspace } from '@/features/editor/components/EditorWorkspace';
import { useEditorState, useEditorActions } from '@/features/core/context/EditorContext';
import { useProjectStore } from '@/features/project';
import { useEngine } from '@/features/shared';
import { useManuscriptIntelligence } from '@/features/shared';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';
import { findQuoteRange } from '@/features/shared';

// Mock dependencies
vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorState: vi.fn(),
  useEditorActions: vi.fn(),
}));
vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

// Capture props passed to mocked components for testing
const mockRichTextProps = vi.fn();
const mockCommentCardProps = vi.fn();

// Mock sub-components
vi.mock('@/features/editor/components/RichTextEditor', () => ({
  RichTextEditor: (props: any) => {
    mockRichTextProps(props);
    return (
      <div data-testid="rich-text-editor">
        <textarea
          data-testid="editor-textarea"
          onChange={(e) => props.onUpdate(e.target.value)}
        />
        <button onClick={() => props.onCommentClick({ id: 'c1', type: 'plot' }, { top: 10, left: 10 })}>
            Simulate Comment Click
        </button>
      </div>
    );
  },
}));

vi.mock('@/features/editor/components/MagicBar', () => ({
  MagicBar: () => <div data-testid="magic-bar">MagicBar</div>,
}));

vi.mock('@/features/editor/components/FindReplaceModal', () => ({
  FindReplaceModal: ({ isOpen, onClose }: any) => (
    isOpen ? <div data-testid="find-replace-modal"><button onClick={onClose}>Close</button></div> : null
  ),
}));

vi.mock('@/features/editor/components/VisualDiff', () => ({
  VisualDiff: () => <div data-testid="visual-diff">VisualDiff</div>,
}));

vi.mock('@/features/editor/components/CommentCard', () => ({
  CommentCard: (props: any) => {
    mockCommentCardProps(props);
    return (
      <div data-testid="comment-card">
        <button onClick={() => props.onDismiss('c1')}>Dismiss</button>
        <button onClick={() => props.onFixWithAgent('issue', 'suggestion')}>Fix</button>
        <button onClick={props.onClose}>Close Card</button>
      </div>
    );
  },
}));

vi.mock('@/features/shared', () => ({
  useEngine: vi.fn(),
  useManuscriptIntelligence: vi.fn(),
  findQuoteRange: vi.fn(),
  AccessibleTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
  useViewportCollision: vi.fn(() => ({ top: 0, left: 0 })),
  calculateDiff: vi.fn(() => []),
}));

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(),
}));

// Mock framer-motion for WorkspaceHeader
vi.mock('framer-motion', () => ({
  motion: {
    header: ({ children, className, onMouseEnter, onMouseLeave, ...props }: any) => {
        // Safe destructuring to avoid passing non-DOM props
        const { initial, animate, exit, transition, ...validProps } = props;
        return (
            <header className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...validProps}>
                {children}
            </header>
        );
    }
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('EditorWorkspace', () => {
  const mockUpdateText = vi.fn();
  const mockSetSelectionState = vi.fn();
  const mockSetEditor = vi.fn();
  const mockClearSelection = vi.fn();
  const mockToggleZenMode = vi.fn();
  const mockDismissComment = vi.fn();
  const mockRunAnalysis = vi.fn();
  const mockRejectDiff = vi.fn();
  const mockAcceptDiff = vi.fn();
  const mockHandleFixRequest = vi.fn();
  const mockUpdateIntelligenceText = vi.fn();
  const mockUpdateCursor = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRichTextProps.mockClear();
    mockCommentCardProps.mockClear();

    (useEditorState as any).mockReturnValue({
      currentText: 'Sample text',
      selectionRange: null,
      selectionPos: null,
      activeHighlight: null,
      editor: {},
      isZenMode: false,
      visibleComments: [],
    });

    (useEditorActions as any).mockReturnValue({
      updateText: mockUpdateText,
      setSelectionState: mockSetSelectionState,
      setEditor: mockSetEditor,
      clearSelection: mockClearSelection,
      toggleZenMode: mockToggleZenMode,
      dismissComment: mockDismissComment,
    });

    (useProjectStore as any).mockImplementation((selector: any) =>
        selector({
            getActiveChapter: () => ({ id: 'ch1', title: 'Chapter 1', lastAnalysis: null }),
            currentProject: { setting: { timePeriod: 'Modern', location: 'City' } }
        })
    );

    (useEngine as any).mockReturnValue({
      state: {
        isAnalyzing: false,
        isMagicLoading: false,
        magicVariations: [],
        grammarSuggestions: [],
        grammarHighlights: [],
        pendingDiff: null,
      },
      actions: {
        runAnalysis: mockRunAnalysis,
        rejectDiff: mockRejectDiff,
        acceptDiff: mockAcceptDiff,
      },
    });

    (useManuscriptIntelligence as any).mockReturnValue({
      intelligence: {},
      hud: { prioritizedIssues: [] },
      instantMetrics: { wordCount: 100 },
      isProcessing: false,
      updateText: mockUpdateIntelligenceText,
      updateCursor: mockUpdateCursor,
    });

    (useLayoutStore as any).mockReturnValue(mockHandleFixRequest);

    (findQuoteRange as any).mockReturnValue({ start: 10, end: 20 });
  });

  it('renders correctly', () => {
    render(<EditorWorkspace />);
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();

    // Check header class for non-zen mode
    const header = screen.getByText('Chapter 1').closest('header');
    expect(header).not.toHaveClass('fixed top-0 left-0 right-0 z-50');
  });

  it('uses legacy analysis highlights when intelligence is empty', () => {
     (useManuscriptIntelligence as any).mockReturnValue({
      intelligence: {},
      hud: { prioritizedIssues: [] }, // Empty intelligence
      instantMetrics: { wordCount: 100 },
      isProcessing: false,
      updateText: mockUpdateIntelligenceText,
      updateCursor: mockUpdateCursor,
    });

    (useProjectStore as any).mockImplementation((selector: any) =>
        selector({
            getActiveChapter: () => ({
                id: 'ch1',
                title: 'Chapter 1',
                lastAnalysis: {
                    plotIssues: [{ issue: 'Plot', quote: 'quote' }],
                    pacing: { slowSections: ['slow'] },
                    settingAnalysis: { issues: [{ issue: 'Setting', quote: 'setting' }] }
                }
            }),
            currentProject: { setting: { timePeriod: 'Modern', location: 'City' } }
        })
    );

    // Mock findQuoteRange to return value for first call and null for second
    // This covers "if (range)" branches
    (findQuoteRange as any)
        .mockReturnValueOnce({ start: 10, end: 20 }) // Plot found
        .mockReturnValueOnce(null) // Pacing not found
        .mockReturnValueOnce({ start: 30, end: 40 }); // Setting found

    render(<EditorWorkspace />);

    const props = mockRichTextProps.mock.calls[0][0];
    const highlights = props.analysisHighlights;

    // Plot (found), Pacing (null), Setting (found) => 2 highlights
    expect(highlights.length).toBe(2);
    expect(highlights.some((h: any) => h.title === 'Plot')).toBe(true);
    expect(highlights.some((h: any) => h.title === 'Setting')).toBe(true);
  });

  it('handles empty legacy analysis fields', () => {
     (useManuscriptIntelligence as any).mockReturnValue({
      intelligence: {},
      hud: { prioritizedIssues: [] },
      instantMetrics: { wordCount: 100 },
      isProcessing: false,
      updateText: mockUpdateIntelligenceText,
      updateCursor: mockUpdateCursor,
    });

    (useProjectStore as any).mockImplementation((selector: any) =>
        selector({
            getActiveChapter: () => ({
                id: 'ch1',
                title: 'Chapter 1',
                lastAnalysis: {
                    // Empty fields or undefined to trigger optional chaining branches
                    plotIssues: [],
                    pacing: {}, // No slowSections
                    settingAnalysis: { issues: undefined }
                }
            }),
            currentProject: { setting: { timePeriod: 'Modern', location: 'City' } }
        })
    );

    render(<EditorWorkspace />);

    const props = mockRichTextProps.mock.calls[0][0];
    const highlights = props.analysisHighlights;

    expect(highlights.length).toBe(0);
  });

  it('combines grammar highlights', () => {
    (useEngine as any).mockReturnValue({
      state: {
        isAnalyzing: false,
        pendingDiff: null,
        grammarHighlights: [{ start: 5, end: 10, color: 'blue', title: 'Grammar' }],
      },
      actions: { runAnalysis: mockRunAnalysis },
    });

    render(<EditorWorkspace />);
    const props = mockRichTextProps.mock.calls[0][0];
    const highlights = props.analysisHighlights;
    expect(highlights.some((h: any) => h.title === 'Grammar')).toBe(true);
  });

  it('handles comment card interactions', () => {
    render(<EditorWorkspace />);

    const editor = screen.getByTestId('rich-text-editor');
    fireEvent.click(screen.getByText('Simulate Comment Click'));

    expect(screen.getByTestId('comment-card')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fix'));
    expect(mockHandleFixRequest).toHaveBeenCalled();
    expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Simulate Comment Click'));
    fireEvent.click(screen.getByText('Dismiss'));
    expect(mockDismissComment).toHaveBeenCalledWith('c1');
    expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Simulate Comment Click'));
    fireEvent.click(screen.getByText('Close Card'));
    expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument();
  });

  it('handles shortcut Ctrl+F', () => {
    render(<EditorWorkspace />);

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(screen.getByTestId('find-replace-modal')).toBeInTheDocument();
  });

  it('handles shortcuts Escape in Zen Mode', () => {
    (useEditorState as any).mockReturnValue({
        currentText: 'Sample text',
        selectionRange: null,
        selectionPos: null,
        activeHighlight: null,
        editor: {},
        isZenMode: true,
        visibleComments: [],
    });

    render(<EditorWorkspace />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockToggleZenMode).toHaveBeenCalled();
  });

  it('handles shortcut Ctrl+Shift+Z', () => {
    render(<EditorWorkspace />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(mockToggleZenMode).toHaveBeenCalled();
  });

  it('handles Zen Mode hover zone', () => {
    (useEditorState as any).mockReturnValue({
        currentText: 'Sample text',
        selectionRange: null,
        selectionPos: null,
        activeHighlight: null,
        editor: {},
        isZenMode: true,
        visibleComments: [],
    });

    const { container } = render(<EditorWorkspace />);

    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();

    const hoverZone = container.querySelector('.fixed.top-0.left-0.right-0.h-8.z-40');
    expect(hoverZone).toBeInTheDocument();

    fireEvent.mouseEnter(hoverZone!);
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();

    // Verify class of header in Zen mode
    const header = screen.getByText('Chapter 1').closest('header');
    expect(header).toHaveClass('fixed top-0 left-0 right-0 z-50');

    fireEvent.mouseLeave(header!);
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
  });

  it('renders icons', () => {
    (useEngine as any).mockReturnValue({
        state: {
          isAnalyzing: false,
          pendingDiff: { original: '', modified: '' },
          grammarHighlights: [],
        },
        actions: { rejectDiff: mockRejectDiff },
    });

    const { container } = render(<EditorWorkspace />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
