import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuillAIEngine } from '@/features/shared/hooks/useDraftSmithEngine';
import { eventBus } from '@/services/appBrain';
import { analyzeDraft } from '@/services/gemini/analysis';
import { isMemoryTool, executeMemoryTool } from '@/services/gemini/memoryToolHandlers';

const trackUsage = vi.fn();

vi.mock('@/features/shared/context/UsageContext', () => ({
  useUsage: () => ({ trackUsage }),
}));

vi.mock('@/services/gemini/analysis', () => ({
  analyzeDraft: vi.fn(),
}));

vi.mock('@/features/editor', () => ({
  useMagicEditor: () => ({
    state: { isMagicBusy: false },
    actions: {
      applyMagic: vi.fn(),
      resetMagic: vi.fn(),
      acceptMagic: vi.fn(),
      rejectMagic: vi.fn(),
    },
  }),
}));

vi.mock('@/services/gemini/memoryToolHandlers', () => ({
  isMemoryTool: vi.fn(),
  executeMemoryTool: vi.fn(),
}));

// Mock emitAnalysisCompleted as it is imported but not mocked in previous version
vi.mock('@/services/appBrain', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    emitAnalysisCompleted: vi.fn(),
    eventBus: {
      subscribe: vi.fn((event, callback) => {
        return () => {};
      }),
      emit: vi.fn(),
    },
  };
});

describe('useQuillAIEngine', () => {
  const baseProps = {
    getCurrentText: () => 'Hello world',
    currentProject: { id: 'p1' },
    activeChapterId: 'c1',
    updateChapterAnalysis: vi.fn(async () => {}),
    updateProjectLore: vi.fn(async () => {}),
    commit: vi.fn(),
    selectionRange: null,
    clearSelection: vi.fn(),
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    (analyzeDraft as any).mockResolvedValue({
      result: { settingAnalysis: { issues: [] }, characters: [] },
      usage: { promptTokenCount: 1, totalTokenCount: 2 },
      warning: null,
    });
    (isMemoryTool as any).mockReturnValue(false);
  });

  describe('Analysis Logic', () => {
    it('performs full analysis successfully', async () => {
      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      await act(async () => {
        await result.current.actions.runAnalysis();
      });

      expect(analyzeDraft).toHaveBeenCalledWith(
        'Hello world',
        undefined,
        undefined,
        expect.any(AbortSignal)
      );
      expect(baseProps.updateChapterAnalysis).toHaveBeenCalled();
      expect(baseProps.updateProjectLore).toHaveBeenCalled();
      expect(trackUsage).toHaveBeenCalled();
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    it('handles selection analysis', async () => {
      const propsWithSelection = {
        ...baseProps,
        selectionRange: { start: 0, end: 5, text: 'Hello' },
      };
      const { result } = renderHook(() => useQuillAIEngine(propsWithSelection));

      await act(async () => {
        await result.current.actions.runSelectionAnalysis();
      });

      expect(analyzeDraft).toHaveBeenCalledWith(
        'Hello',
        undefined,
        undefined,
        expect.any(AbortSignal)
      );
      // Warning should be set for selection analysis
      expect(result.current.state.analysisWarning).not.toBeNull();
      // The message is different when there is no upstream warning:
      expect(result.current.state.analysisWarning?.message).toContain('Analysis ran on the selected text');
    });

    it('warns when running selection analysis without selection', async () => {
      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      await act(async () => {
        await result.current.actions.runSelectionAnalysis();
      });

      expect(analyzeDraft).not.toHaveBeenCalled();
      expect(result.current.state.analysisWarning?.message).toContain('Select some text');
    });

    it('handles analysis error', async () => {
      (analyzeDraft as any).mockRejectedValueOnce(new Error('API Error'));
      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      await act(async () => {
        await result.current.actions.runAnalysis();
      });

      expect(result.current.state.analysisError).toBe('API Error');
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    it('cancels analysis', async () => {
      // Mock a long running analysis
      (analyzeDraft as any).mockImplementation(async (text, set, idx, signal) => {
        if (signal.aborted) return;
        return new Promise(() => {}); // Never resolves
      });

      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      act(() => {
        result.current.actions.runAnalysis();
      });

      expect(result.current.state.isAnalyzing).toBe(true);

      act(() => {
        result.current.actions.cancelAnalysis();
      });

      expect(result.current.state.isAnalyzing).toBe(false);
    });
  });

  describe('Agent Logic', () => {
    it('proposes manuscript updates and accepts them', async () => {
      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      await act(async () => {
        const message = await result.current.actions.handleAgentAction('update_manuscript', {
          search_text: 'Hello',
          replacement_text: 'Hi',
        });
        expect(message).toContain('Edit proposed');
      });

      expect(result.current.state.pendingDiff?.modified).toBe('Hi world');

      act(() => {
        result.current.actions.acceptDiff();
      });

      expect(baseProps.commit).toHaveBeenCalledWith('Hi world', 'Agent Edit', 'Agent');
    });

    it('rejects proposed updates', async () => {
        const { result } = renderHook(() => useQuillAIEngine(baseProps));

        await act(async () => {
          await result.current.actions.handleAgentAction('update_manuscript', {
            search_text: 'Hello',
            replacement_text: 'Hi',
          });
        });

        expect(result.current.state.pendingDiff).not.toBeNull();

        act(() => {
          result.current.actions.rejectDiff();
        });

        expect(result.current.state.pendingDiff).toBeNull();
        expect(baseProps.commit).not.toHaveBeenCalled();
    });

    it('queues append edits with newline handling', async () => {
      const { result } = renderHook(() =>
        useQuillAIEngine({ ...baseProps, getCurrentText: () => 'Line one' }),
      );

      await act(async () => {
        const message = await result.current.actions.handleAgentAction('append_to_manuscript', {
          text_to_add: 'Line two',
        });
        expect(message).toContain('Edit proposed');
      });

      expect(result.current.state.pendingDiff?.modified).toBe('Line one\nLine two');
    });

    it('supports undo and unknown agent actions', async () => {
      const { result } = renderHook(() => useQuillAIEngine(baseProps));

      await act(async () => {
        const undoMessage = await result.current.actions.handleAgentAction('undo_last_change', {});
        expect(undoMessage).toContain('undo button');

        const unknown = await result.current.actions.handleAgentAction('nonexistent', {});
        expect(unknown).toBe('Unknown action.');
      });
    });

    it('throws error when replacement text not found', async () => {
        const { result } = renderHook(() => useQuillAIEngine(baseProps));

        await expect(result.current.actions.handleAgentAction('update_manuscript', {
            search_text: 'Missing',
            replacement_text: 'Hi',
        })).rejects.toThrow('Could not find the exact text');
    });

    it('throws error when multiple matches found', async () => {
        const { result } = renderHook(() => useQuillAIEngine({
            ...baseProps,
            getCurrentText: () => 'Hello Hello',
        }));

        await expect(result.current.actions.handleAgentAction('update_manuscript', {
            search_text: 'Hello',
            replacement_text: 'Hi',
        })).rejects.toThrow('Found 2 matches');
    });

    it('delegates to memory tools when applicable', async () => {
        (isMemoryTool as any).mockReturnValue(true);
        (executeMemoryTool as any).mockResolvedValue('Memory tool result');

        const { result } = renderHook(() => useQuillAIEngine(baseProps));

        const response = await act(async () => {
            return await result.current.actions.handleAgentAction('search_memory', { query: 'test' });
        });

        expect(executeMemoryTool).toHaveBeenCalledWith(
            'search_memory',
            { query: 'test' },
            { projectId: 'p1' }
        );
        expect(response).toBe('Memory tool result');
    });

    it('returns error for memory tool without project', async () => {
        (isMemoryTool as any).mockReturnValue(true);

        const { result } = renderHook(() => useQuillAIEngine({ ...baseProps, currentProject: null }));

        const response = await act(async () => {
            return await result.current.actions.handleAgentAction('search_memory', { query: 'test' });
        });

        expect(response).toContain('Error: No project loaded');
    });
  });

  describe('Event Bus Subscription', () => {
    it('updates isDreaming state on event', () => {
        // We need to capture the subscription callback
        let callback: any;
        (eventBus.subscribe as any).mockImplementation((event: string, cb: any) => {
            if (event === 'DREAMING_STATE_CHANGED') {
                callback = cb;
            }
            return () => {};
        });

        const { result } = renderHook(() => useQuillAIEngine(baseProps));

        expect(result.current.state.isDreaming).toBe(false);

        act(() => {
            if (callback) {
                callback({ payload: { active: true } });
            }
        });

        expect(result.current.state.isDreaming).toBe(true);
    });
  });
});
