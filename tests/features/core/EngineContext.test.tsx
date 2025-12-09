import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { EngineProvider, useEngine } from '@/features/core/context/EngineContext';

/**
 * Hoisted mocks for editor context and project store
 */
const mocks = vi.hoisted(() => {
  const editorContext = {
    currentText: 'Test manuscript text',
    commit: vi.fn(),
    selectionRange: { start: 0, end: 4, text: 'Test' },
    clearSelection: vi.fn(),
  };

  const projectStore = {
    currentProject: { id: 'proj-1', title: 'Test Project' },
    activeChapterId: 'ch-1',
    updateChapterAnalysis: vi.fn(),
    updateProjectLore: vi.fn(),
  };

  const engineState = {
    isAnalyzing: false,
    analysisError: null,
    analysisWarning: null,
    magicVariations: ['variation 1', 'variation 2'],
    activeMagicMode: null,
    magicHelpResult: undefined,
    magicHelpType: null,
    isMagicLoading: false,
    magicError: null,
    pendingDiff: null,
    grammarSuggestions: [],
    grammarHighlights: [],
  };

  const engineActions = {
    runAnalysis: vi.fn(),
    runSelectionAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    handleRewrite: vi.fn(),
    handleHelp: vi.fn(),
    applyVariation: vi.fn(),
    closeMagicBar: vi.fn(),
    handleGrammarCheck: vi.fn(),
    applyGrammarSuggestion: vi.fn(),
    applyAllGrammarSuggestions: vi.fn(),
    dismissGrammarSuggestion: vi.fn(),
    handleAgentAction: vi.fn().mockResolvedValue('action result'),
    acceptDiff: vi.fn(),
    rejectDiff: vi.fn(),
  };

  const quillEngine = {
    state: engineState,
    actions: engineActions,
  };

  return { editorContext, projectStore, quillEngine, engineState, engineActions };
});

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditor: () => mocks.editorContext,
}));

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn((selector) => {
    const state = mocks.projectStore;
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

vi.mock('@/features/shared/hooks/useDraftSmithEngine', () => ({
  useQuillAIEngine: vi.fn(() => mocks.quillEngine),
}));

vi.mock('@/features/shared/hooks/useManuscriptIndexer', () => ({
  useManuscriptIndexer: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <EngineProvider>{children}</EngineProvider>
);

describe('EngineContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state
    mocks.engineState.isAnalyzing = false;
    mocks.engineState.analysisError = null;
    mocks.engineState.isMagicLoading = false;
    mocks.engineState.pendingDiff = null;
  });

  describe('useEngine hook', () => {
    it('exposes engine state from provider', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.isAnalyzing).toBe(false);
      expect(result.current.state.magicVariations).toEqual(['variation 1', 'variation 2']);
      expect(result.current.state.isMagicLoading).toBe(false);
    });

    it('exposes engine actions from provider', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(typeof result.current.actions.runAnalysis).toBe('function');
      expect(typeof result.current.actions.handleRewrite).toBe('function');
      expect(typeof result.current.actions.handleGrammarCheck).toBe('function');
    });

    it('exposes contradictions array', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.contradictions).toEqual([]);
    });

    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useEngine());
      }).toThrow('useEngine must be used within an EngineProvider');
    });
  });

  describe('engine actions delegation', () => {
    it('delegates runAnalysis to engine', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.runAnalysis();
      });

      expect(mocks.engineActions.runAnalysis).toHaveBeenCalled();
    });

    it('delegates runSelectionAnalysis to engine', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.runSelectionAnalysis();
      });

      expect(mocks.engineActions.runSelectionAnalysis).toHaveBeenCalled();
    });

    it('delegates cancelAnalysis to engine', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.cancelAnalysis();
      });

      expect(mocks.engineActions.cancelAnalysis).toHaveBeenCalled();
    });

    it('delegates handleRewrite with mode and tone', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.handleRewrite('expand', 'formal');
      });

      expect(mocks.engineActions.handleRewrite).toHaveBeenCalledWith('expand', 'formal');
    });

    it('delegates handleHelp with type', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.handleHelp('Explain');
      });

      expect(mocks.engineActions.handleHelp).toHaveBeenCalledWith('Explain');
    });

    it('delegates applyVariation with text', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.applyVariation('new variation text');
      });

      expect(mocks.engineActions.applyVariation).toHaveBeenCalledWith('new variation text');
    });

    it('delegates closeMagicBar', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.closeMagicBar();
      });

      expect(mocks.engineActions.closeMagicBar).toHaveBeenCalled();
    });

    it('delegates grammar check actions', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.handleGrammarCheck();
      });

      expect(mocks.engineActions.handleGrammarCheck).toHaveBeenCalled();

      act(() => {
        result.current.actions.applyGrammarSuggestion('sug-1');
      });

      expect(mocks.engineActions.applyGrammarSuggestion).toHaveBeenCalledWith('sug-1');

      act(() => {
        result.current.actions.applyAllGrammarSuggestions();
      });

      expect(mocks.engineActions.applyAllGrammarSuggestions).toHaveBeenCalled();

      act(() => {
        result.current.actions.dismissGrammarSuggestion('sug-2');
      });

      expect(mocks.engineActions.dismissGrammarSuggestion).toHaveBeenCalledWith('sug-2');
    });

    it('delegates handleAgentAction with action and params', async () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      let response: string | undefined;
      await act(async () => {
        response = await result.current.actions.handleAgentAction('navigate', { target: 'ch-2' });
      });

      expect(mocks.engineActions.handleAgentAction).toHaveBeenCalledWith('navigate', { target: 'ch-2' });
      expect(response).toBe('action result');
    });

    it('delegates diff actions', () => {
      const { result } = renderHook(() => useEngine(), { wrapper });

      act(() => {
        result.current.actions.acceptDiff();
      });

      expect(mocks.engineActions.acceptDiff).toHaveBeenCalled();

      act(() => {
        result.current.actions.rejectDiff();
      });

      expect(mocks.engineActions.rejectDiff).toHaveBeenCalled();
    });
  });

  describe('state reflection', () => {
    it('reflects analyzing state', () => {
      mocks.engineState.isAnalyzing = true;

      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.isAnalyzing).toBe(true);
    });

    it('reflects analysis error', () => {
      mocks.engineState.analysisError = 'API rate limited';

      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.analysisError).toBe('API rate limited');
    });

    it('reflects magic loading state', () => {
      mocks.engineState.isMagicLoading = true;
      mocks.engineState.activeMagicMode = 'expand';

      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.isMagicLoading).toBe(true);
      expect(result.current.state.activeMagicMode).toBe('expand');
    });

    it('reflects pending diff', () => {
      mocks.engineState.pendingDiff = {
        original: 'old text',
        modified: 'new text',
        description: 'Expansion',
      } as any;

      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.pendingDiff).toEqual({
        original: 'old text',
        modified: 'new text',
        description: 'Expansion',
      });
    });

    it('reflects grammar suggestions and highlights', () => {
      mocks.engineState.grammarSuggestions = [{ id: 'g1', text: 'Fix typo' }] as any;
      mocks.engineState.grammarHighlights = [{ start: 0, end: 5 }] as any;

      const { result } = renderHook(() => useEngine(), { wrapper });

      expect(result.current.state.grammarSuggestions).toHaveLength(1);
      expect(result.current.state.grammarHighlights).toHaveLength(1);
    });
  });
});
