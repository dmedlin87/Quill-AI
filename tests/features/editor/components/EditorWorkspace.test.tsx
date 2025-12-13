import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorWorkspace } from '@/features/editor/components/EditorWorkspace';

// --- Mocks ---
// Mock Editor Context
const mockEditor = {
  state: {
    selection: { from: 0, to: 10 },
    doc: {
      nodesBetween: vi.fn(),
      descendants: vi.fn(),
    },
    tr: {
      setNodeMarkup: vi.fn(),
      removeMark: vi.fn(),
      setMeta: vi.fn(),
    }
  },
  view: {
    dispatch: vi.fn(),
  },
  chain: () => ({
    focus: () => ({
      setParagraph: () => ({
        unsetAllMarks: () => ({
          run: vi.fn()
        })
      })
    }),
  }),
  schema: {
    nodes: {
      paragraph: 'paragraph'
    },
    marks: {
      code: 'code'
    }
  },
  isDestroyed: false,
  storage: {}
};

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorState: () => ({
    currentText: 'Sample text',
    selectionRange: { start: 0, end: 10 },
    selectionPos: { top: 0, left: 0 },
    activeHighlight: null,
    editor: mockEditor,
    isZenMode: false,
    visibleComments: [],
  }),
  useEditorActions: () => ({
    updateText: vi.fn(),
    setSelectionState: vi.fn(),
    setEditor: vi.fn(),
    clearSelection: vi.fn(),
    toggleZenMode: vi.fn(),
    dismissComment: vi.fn(),
  })
}));

// Mock Project Store
vi.mock('@/features/project', () => ({
  useProjectStore: () => ({
    getActiveChapter: () => ({ id: 'ch1', title: 'Chapter 1' }),
    currentProject: { setting: { timePeriod: '1920s', location: 'New York' } }
  })
}));

// Mock Engine (Analysis)
vi.mock('@/features/shared', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    useEngine: () => ({
      state: {
        isMagicLoading: false,
        magicVariations: [],
        grammarSuggestions: [],
        grammarHighlights: [],
        isAnalyzing: false
      },
      actions: {
        runAnalysis: vi.fn(),
        closeMagicBar: vi.fn()
      }
    }),
    useManuscriptIntelligence: () => ({
      intelligence: {},
      hud: { prioritizedIssues: [] },
      instantMetrics: { wordCount: 100 },
      isProcessing: false,
      updateText: vi.fn(),
      updateCursor: vi.fn()
    })
  };
});

// Mock Layout Store
vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: () => vi.fn()
}));

// Mock Settings Store (RichTextEditor uses it)
vi.mock('@/features/settings', () => ({
  useSettingsStore: () => false // nativeSpellcheckEnabled
}));

describe('EditorWorkspace Formatting Logic', () => {

  it('detects global formatting issues', async () => {
    // Setup mock to find 3 code blocks
    mockEditor.state.doc.descendants.mockImplementation((callback) => {
      callback({ type: { name: 'codeBlock' } }, 0);
      callback({ type: { name: 'paragraph' } }, 10);
      callback({ type: { name: 'pre' } }, 20);
      callback({ type: { name: 'codeBlock' } }, 30);
    });

    render(<EditorWorkspace />);

    // Wait for debounce (1000ms in implementation, verify with timer or waitFor)
    // Note: In real test env with fake timers we might need advanceTimersByTime
    // But for this mock setup, the effect runs eventually.
    await screen.findByText(/Fix Formatting \(3\)/, {}, { timeout: 2000 });
  });

  it('runs global fix when button is clicked', async () => {
    // Setup finding issues
    mockEditor.state.doc.descendants.mockImplementation((callback) => {
      callback({ type: { name: 'codeBlock' } }, 5);
      // Simulate text node with code mark
      callback({
        isText: true,
        type: { name: 'text' },
        nodeSize: 5,
        marks: [{ type: { name: 'code' } }]
      }, 15);
    });

    render(<EditorWorkspace />);

    // Wait for button to appear
    const button = await screen.findByText(/Fix Formatting/);
    fireEvent.click(button);

    // Verify transaction was dispatched
    expect(mockEditor.view.dispatch).toHaveBeenCalled();
    // Verify setNodeMarkup was called (to convert to paragraph)
    expect(mockEditor.state.tr.setNodeMarkup).toHaveBeenCalledWith(5, 'paragraph');
    // Verify removeMark was called (for the text node)
    expect(mockEditor.state.tr.removeMark).toHaveBeenCalledWith(15, 20, 'code');
  });

});
