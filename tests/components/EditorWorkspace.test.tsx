import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect, type Mock } from 'vitest';
import { EditorWorkspace } from '@/features/editor/components/EditorWorkspace';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <header {...props}>{children}</header>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

vi.mock('@/features/shared', () => ({
  useEditor: vi.fn(),
  useEngine: vi.fn(),
  findQuoteRange: vi.fn(),
}));

const mockRichTextProps = vi.fn();
const mockMagicBarProps = vi.fn();
const mockFindModalProps = vi.fn();

vi.mock('@/features/editor/components/RichTextEditor', () => ({
  RichTextEditor: (props: any) => {
    mockRichTextProps(props);
    return <div data-testid="rich-text-editor" />;
  },
}));

vi.mock('@/features/editor/components/MagicBar', () => ({
  MagicBar: (props: any) => {
    mockMagicBarProps(props);
    return <div data-testid="magic-bar" />;
  },
}));

vi.mock('@/features/editor/components/FindReplaceModal', () => ({
  FindReplaceModal: (props: any) => {
    mockFindModalProps(props);
    return props.isOpen ? <div data-testid="find-replace-modal" /> : null;
  },
}));

vi.mock('@/features/editor/components/VisualDiff', () => ({
  VisualDiff: () => <div data-testid="visual-diff" />,
}));

import { useProjectStore } from '@/features/project';
import { useEditor, useEngine } from '@/features/shared';

const mockUseProjectStore = useProjectStore as unknown as Mock;
const mockUseEditor = useEditor as unknown as Mock;
const mockUseEngine = useEngine as unknown as Mock;

describe('EditorWorkspace', () => {
  const mockRunAnalysis = vi.fn();
  const mockToggleZenMode = vi.fn();

  const setupMocks = (overridesEditor: Record<string, any> = {}, overridesEngine: Record<string, any> = {}) => {
    mockUseProjectStore.mockReturnValue({
      currentProject: { id: 'p1', title: 'Test Project', setting: { timePeriod: 'Modern', location: 'City' } },
      getActiveChapter: () => ({ id: 'ch1', title: 'Chapter 1', lastAnalysis: null }),
    });

    mockUseEditor.mockReturnValue({
      currentText: 'Sample manuscript text',
      updateText: vi.fn(),
      setSelectionState: vi.fn(),
      selectionRange: null,
      selectionPos: null,
      activeHighlight: null,
      setEditor: vi.fn(),
      clearSelection: vi.fn(),
      editor: null,
      isZenMode: false,
      toggleZenMode: mockToggleZenMode,
      ...overridesEditor,
    });

    mockUseEngine.mockReturnValue({
      state: {
        isAnalyzing: false,
        isMagicLoading: false,
        magicVariations: [],
        magicHelpResult: null,
        magicHelpType: null,
        activeMagicMode: null,
        pendingDiff: null,
      },
      actions: {
        runAnalysis: mockRunAnalysis,
        handleRewrite: vi.fn(),
        handleHelp: vi.fn(),
        applyVariation: vi.fn(),
        closeMagicBar: vi.fn(),
        acceptDiff: vi.fn(),
        rejectDiff: vi.fn(),
      },
      ...overridesEngine,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRichTextProps.mockReset();
    mockMagicBarProps.mockReset();
    mockFindModalProps.mockReset();
    setupMocks();
  });

  it('renders RichTextEditor with current text and handlers', () => {
    render(<EditorWorkspace />);

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    expect(mockRichTextProps).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Sample manuscript text',
        onUpdate: expect.any(Function),
        onSelectionChange: expect.any(Function),
      }),
    );
  });

  it('shows MagicBar when there is a text selection and position', () => {
    setupMocks(
      {
        selectionRange: { start: 0, end: 5, text: 'Sample' },
        selectionPos: { top: 100, left: 200 },
      },
    );

    render(<EditorWorkspace />);

    expect(screen.getByTestId('magic-bar')).toBeInTheDocument();
    expect(mockMagicBarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { top: 100, left: 200 },
        onRewrite: expect.any(Function),
        onHelp: expect.any(Function),
      }),
    );
  });

  it('opens FindReplaceModal with Ctrl+F', () => {
    render(<EditorWorkspace />);

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

    expect(screen.getByTestId('find-replace-modal')).toBeInTheDocument();
    expect(mockFindModalProps).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: true }),
    );
  });

  it('toggles Zen Mode with Ctrl+Shift+Z and Escape', () => {
    setupMocks({ isZenMode: false });
    render(<EditorWorkspace />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(mockToggleZenMode).toHaveBeenCalledTimes(1);

    // When already in Zen Mode, Escape should also toggle
    setupMocks({ isZenMode: true });
    render(<EditorWorkspace />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockToggleZenMode).toHaveBeenCalledTimes(2);
  });

  it('shows diff modal when pendingDiff is present', () => {
    setupMocks(
      {},
      {
        state: {
          isAnalyzing: false,
          isMagicLoading: false,
          magicVariations: [],
          magicHelpResult: null,
          magicHelpType: null,
          activeMagicMode: null,
          pendingDiff: { original: 'old', modified: 'new' },
        },
      },
    );

    const mockAccept = vi.fn();
    const mockReject = vi.fn();

    mockUseEngine.mockReturnValue({
      state: {
        isAnalyzing: false,
        isMagicLoading: false,
        magicVariations: [],
        magicHelpResult: null,
        magicHelpType: null,
        activeMagicMode: null,
        pendingDiff: { original: 'old', modified: 'new' },
      },
      actions: {
        runAnalysis: mockRunAnalysis,
        handleRewrite: vi.fn(),
        handleHelp: vi.fn(),
        applyVariation: vi.fn(),
        closeMagicBar: vi.fn(),
        acceptDiff: mockAccept,
        rejectDiff: mockReject,
      },
    });

    render(<EditorWorkspace />);

    expect(screen.getByText('Review Agent Suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('visual-diff')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Accept'));
    expect(mockAccept).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Reject'));
    expect(mockReject).toHaveBeenCalled();
  });
});
