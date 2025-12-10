
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorWorkspace } from '@/features/editor/components/EditorWorkspace';
import { useEditorState, useEditorActions } from '@/features/core/context/EditorContext';
import { useProjectStore } from '@/features/project';
import { useEngine } from '@/features/shared';
import { useManuscriptIntelligence } from '@/features/shared';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';

// Mock dependencies
vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorState: vi.fn(),
  useEditorActions: vi.fn(),
}));
vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));
// Mock sub-components before they are used in imports (and because they might be memoized)
vi.mock('@/features/editor/components/RichTextEditor', () => ({
  RichTextEditor: ({ onUpdate, onSelectionChange }: any) => (
    <div data-testid="rich-text-editor">
      <textarea
        data-testid="editor-textarea"
        onChange={(e) => onUpdate(e.target.value)}
      />
    </div>
  ),
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
  CommentCard: ({ onDismiss, onFixWithAgent }: any) => (
    <div data-testid="comment-card">
      <button onClick={() => onDismiss('c1')}>Dismiss</button>
      <button onClick={() => onFixWithAgent('issue', 'suggestion')}>Fix</button>
    </div>
  ),
}));

vi.mock('@/features/shared', () => ({
  useEngine: vi.fn(),
  useManuscriptIntelligence: vi.fn(),
  findQuoteRange: vi.fn(),
  AccessibleTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
  // Add missing exports that might be used by child components (even if mocked)
  useViewportCollision: vi.fn(() => ({ top: 0, left: 0 })),
  calculateDiff: vi.fn(() => []),
}));

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(),
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
  });

  it('renders correctly', () => {
    render(<EditorWorkspace />);
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('100 words')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('renders active chapter title or fallback', () => {
    (useProjectStore as any).mockImplementation((selector: any) =>
        selector({
            getActiveChapter: () => null,
            currentProject: null
        })
    );
    render(<EditorWorkspace />);
    expect(screen.getByText('No Active Chapter')).toBeInTheDocument();
  });

  it('updates text on editor change', () => {
    render(<EditorWorkspace />);
    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'New text' } });

    expect(mockUpdateText).toHaveBeenCalledWith('New text');
    expect(mockUpdateIntelligenceText).toHaveBeenCalledWith('New text', 0);
  });

  it('shows magic bar when selection exists', () => {
    (useEditorState as any).mockReturnValue({
      currentText: 'Sample text',
      selectionRange: { from: 0, to: 5 },
      selectionPos: { top: 0, left: 0 },
      activeHighlight: null,
      editor: {},
      isZenMode: false,
      visibleComments: [],
    });

    render(<EditorWorkspace />);
    expect(screen.getByTestId('magic-bar')).toBeInTheDocument();
  });

  it('shows pending diff modal when diff exists', () => {
    (useEngine as any).mockReturnValue({
      state: {
        isAnalyzing: false,
        pendingDiff: { original: 'orig', modified: 'mod' },
        grammarHighlights: [],
      },
      actions: {
        rejectDiff: mockRejectDiff,
        acceptDiff: mockAcceptDiff,
      },
    });

    render(<EditorWorkspace />);
    expect(screen.getByTestId('visual-diff')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Accept'));
    expect(mockAcceptDiff).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Reject'));
    expect(mockRejectDiff).toHaveBeenCalled();
  });

  it('toggles find/replace modal on keypress', () => {
    // Need to mock the state such that MemoFindReplaceModal logic works
    // The implementation uses React.memo(FindReplaceModal, customCompare)
    // We already mocked FindReplaceModal, but maybe the Memo part is affecting it.
    // However, the test failure is "Unable to find an element by: [data-testid="find-replace-modal"]"
    // This implies that after keydown, it's not rendering.

    // In EditorWorkspace:
    // const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
    // useEffect listens to window keydown.

    // render(<EditorWorkspace />);
    // fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    // This should trigger setIsFindReplaceOpen(true).

    // It's possible the event listener is not attached correctly in the test environment or the mock component is returning null.
    // The mock is: isOpen ? <div... : null.

    render(<EditorWorkspace />);

    expect(screen.queryByTestId('find-replace-modal')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

    // Wait for state update if necessary, but fireEvent should be synchronous for state updates in React 18 usually?
    // Let's try wrapping in act just in case, or using findBy.

    // Actually, looking at the previous failure output, it dumped a huge DOM.
    // The dump shows <div class="fixed top-20 right-20..."><h3...>Find & Replace</h3>...
    // This looks like the REAL FindReplaceModal is being rendered, not the mock!
    // Why? vi.mock('./FindReplaceModal') is used.

    // Maybe because MemoFindReplaceModal wraps the import?
    // "const MemoFindReplaceModal = React.memo(FindReplaceModal, ...)"
    // If FindReplaceModal is mocked, React.memo(Mock) should still use the Mock.

    // Wait, the failure says "Unable to find an element by: [data-testid="find-replace-modal"]"
    // But the DOM dump clearly shows "Find & Replace" text and structure which matches the real component.
    // This suggests the mock was ignored or bypassed.

    // Ah, relative imports in vi.mock can be tricky if not matching exactly how the component imports it.
    // The component imports: import { FindReplaceModal } from './FindReplaceModal';
    // The test mocks: vi.mock('./FindReplaceModal', ...);

    // If the component is using a barrel file or something else...
    // But it looks direct.

    // Let's try to fix the test by using the actual text if the mock failed, OR ensuring the mock works.
    // If the real component is rendered, we should look for "Find & Replace".

    // But we prefer the mock.
    // Let's check the mock path. It is in the same directory.

    // If the mock is not working, maybe because of how vitest handles same-folder mocks?
    // I will try to use the absolute path in the mock to be safe.

    // For now, I'll update the test to accept either the real component or the mock behavior to pass.
    // But ideally I want the mock.

    // If the real component is rendering, it means my previous assumption was right.
    // I'll try to match the text "Find & Replace" which appears in the dumped DOM.

    // The previous run failure shows <div data-testid="find-replace-modal"> ... </div> in the dumped DOM!
    // This means the mock IS working now.
    // The error "Unable to find an element with the text: Find & Replace" happened because the mock doesn't render that text.
    // It renders <button>Close</button>.

    // So we can revert to using the test id.

    expect(screen.getByTestId('find-replace-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('find-replace-modal')).not.toBeInTheDocument();
  });

  it('toggles zen mode on keypress', () => {
    render(<EditorWorkspace />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(mockToggleZenMode).toHaveBeenCalled();
  });

  it('handles deep analysis button click', () => {
    render(<EditorWorkspace />);
    const button = screen.getByText('Deep Analysis');
    fireEvent.click(button);
    expect(mockRunAnalysis).toHaveBeenCalled();
  });

  it('shows analyzing spinner when isAnalyzing is true', () => {
    (useEngine as any).mockReturnValue({
        state: {
          isAnalyzing: true,
          pendingDiff: null,
          grammarHighlights: [],
        },
        actions: { runAnalysis: mockRunAnalysis },
      });

    render(<EditorWorkspace />);

    // The text 'Deep Analysis' is still present in the button
    expect(screen.getByText('Deep Analysis')).toBeInTheDocument();

    // The button should be disabled
    expect(screen.getByRole('button', { name: /Deep Analysis/i })).toBeDisabled();
  });

  it('shows start writing hint when document is empty', () => {
    (useEditorState as any).mockReturnValue({
        currentText: '',
        selectionRange: null,
        selectionPos: null,
        activeHighlight: null,
        editor: {},
        isZenMode: false,
        visibleComments: [],
    });

    render(<EditorWorkspace />);
    expect(screen.getByText('Start writing to get AI help')).toBeInTheDocument();
  });
});
