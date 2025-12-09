import React, { forwardRef, useImperativeHandle } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMagicEditor } from '@/features/editor/hooks/useMagicEditor';

type SelectionRange = {
  start: number;
  end: number;
  text: string;
};

const rewriteTextMock = vi.fn();
const getContextualHelpMock = vi.fn();
const fetchGrammarSuggestionsMock = vi.fn();
const trackUsageMock = vi.fn();

vi.mock('@/services/gemini/agent', () => ({
  rewriteText: (...args: any[]) => rewriteTextMock(...args),
  getContextualHelp: (...args: any[]) => getContextualHelpMock(...args),
}));

vi.mock('@/services/gemini/grammar', () => ({
  fetchGrammarSuggestions: (...args: any[]) => fetchGrammarSuggestionsMock(...args),
}));

vi.mock('@/features/shared', () => ({
  useUsage: () => ({ trackUsage: (...args: any[]) => trackUsageMock(...args) }),
}));

const MagicEditorHarness = forwardRef(
  (
    props: {
      selectionRange: SelectionRange | null;
      clearSelection: () => void;
      getCurrentText: () => string;
      commit: (text: string, desc: string, author: 'User' | 'Agent') => void;
      projectSetting?: { timePeriod: string; location: string };
    },
    ref: React.Ref<ReturnType<typeof useMagicEditor>>
  ) => {
    const hook = useMagicEditor(props);
    useImperativeHandle(ref, () => hook, [hook]);
    return null;
  }
);

describe('useMagicEditor', () => {
  const baseSelection: SelectionRange = { start: 0, end: 5, text: 'Draft' };
  let commitMock: ReturnType<typeof vi.fn>;
  let clearSelectionMock: ReturnType<typeof vi.fn>;
  let currentText = 'Draft text';

  beforeEach(() => {
    commitMock = vi.fn();
    clearSelectionMock = vi.fn();
    rewriteTextMock.mockReset();
    getContextualHelpMock.mockReset();
    fetchGrammarSuggestionsMock.mockReset();
    trackUsageMock.mockReset();
    currentText = 'Draft text';
  });

  const renderHarness = (selectionRange: SelectionRange | null = baseSelection) => {
    const ref = React.createRef<ReturnType<typeof useMagicEditor>>();
    render(
      <MagicEditorHarness
        ref={ref}
        selectionRange={selectionRange}
        clearSelection={clearSelectionMock}
        getCurrentText={() => currentText}
        commit={commitMock}
      />
    );
    return ref;
  };

  it('captures rewrite flow and applies variations with validation', async () => {
    rewriteTextMock.mockResolvedValue({ result: ['Improved'], usage: { tokens: 1 } });
    const ref = renderHarness();

    await waitFor(() => expect(ref.current).toBeTruthy());
    await act(async () => {
      await ref.current?.actions.handleRewrite('Rewrite');
    });

    expect(rewriteTextMock).toHaveBeenCalledWith('Draft', 'Rewrite', undefined, undefined, expect.any(AbortSignal));
    expect(trackUsageMock).toHaveBeenCalled();

    await waitFor(() => expect(ref.current?.state.magicVariations).toEqual(['Improved']));

    await act(async () => {
      await ref.current?.actions.applyVariation('Improved Draft');
    });

    expect(commitMock).toHaveBeenCalledWith('Improved Draft text', 'Magic Edit: Variation Applied', 'User');
    expect(clearSelectionMock).toHaveBeenCalled();
    expect(ref.current?.state.magicError).toBeNull();
  });

  it('handles stale selections by clearing when text changes', async () => {
    rewriteTextMock.mockResolvedValue({ result: ['Improved'], usage: { tokens: 1 } });
    const ref = renderHarness();

    await waitFor(() => expect(ref.current).toBeTruthy());
    await act(async () => {
      await ref.current?.actions.handleRewrite('Rewrite');
    });

    currentText = 'Different text entirely';
    await act(async () => {
      await ref.current?.actions.applyVariation('Updated');
    });

    expect(commitMock).not.toHaveBeenCalled();
    expect(clearSelectionMock).toHaveBeenCalledTimes(1);
    expect(ref.current?.state.magicVariations).toEqual([]);
  });

  it('returns an error when applying without a captured selection', async () => {
    const ref = renderHarness(null);

    await waitFor(() => expect(ref.current).toBeTruthy());
    await act(async () => {
      await ref.current?.actions.applyVariation('Anything');
    });

    await waitFor(() => expect(ref.current?.state.magicError).toBe('No selection to apply to'));
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('applies contextual replacements after help requests', async () => {
    getContextualHelpMock.mockResolvedValue({ result: 'Answer', usage: { tokens: 2 } });
    const ref = renderHarness();

    await waitFor(() => expect(ref.current).toBeTruthy());
    await act(async () => {
      await ref.current?.actions.handleHelp('Explain');
    });

    await act(async () => {
      await ref.current?.actions.applyVariation('Replacement');
    });

    expect(getContextualHelpMock).toHaveBeenCalled();
    expect(commitMock).toHaveBeenCalledWith('Replacement text', 'Magic Edit: Context Replacement', 'User');
  });

  describe('grammar check functionality', () => {
    it('fetches and applies grammar suggestions', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'Consider rephrasing',
            replacement: 'Fixed',
            severity: 'error',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      expect(fetchGrammarSuggestionsMock).toHaveBeenCalledWith('Draft', expect.any(AbortSignal));
      expect(trackUsageMock).toHaveBeenCalled();

      await waitFor(() => {
        expect(ref.current?.state.grammarSuggestions).toHaveLength(1);
        expect(ref.current?.state.grammarHighlights).toHaveLength(1);
      });
    });

    it('applies a single grammar suggestion', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'Grammar error',
            replacement: 'Fixed',
            severity: 'error',
            originalText: 'Draft',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      await waitFor(() => expect(ref.current?.state.grammarSuggestions).toHaveLength(1));

      await act(async () => {
        await ref.current?.actions.applyGrammarSuggestion('g1');
      });

      expect(commitMock).toHaveBeenCalledWith('Fixed text', 'Grammar fix applied', 'User');
    });

    it('applies all grammar suggestions at once', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'First error',
            replacement: 'Fixed',
            severity: 'error',
            originalText: 'Draft',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      await waitFor(() => expect(ref.current?.state.grammarSuggestions).toHaveLength(1));

      await act(async () => {
        await ref.current?.actions.applyAllGrammarSuggestions();
      });

      expect(commitMock).toHaveBeenCalledWith('Fixed text', 'Applied grammar fixes', 'User');
      expect(clearSelectionMock).toHaveBeenCalled();
    });

    it('dismisses a grammar suggestion without applying', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'Grammar error',
            replacement: 'Fixed',
            severity: 'error',
            originalText: 'Draft',
          },
          {
            id: 'g2',
            start: 6,
            end: 10,
            message: 'Another error',
            replacement: 'good',
            severity: 'style',
            originalText: 'text',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      await waitFor(() => expect(ref.current?.state.grammarSuggestions).toHaveLength(2));

      await act(async () => {
        await ref.current?.actions.dismissGrammarSuggestion('g1');
      });

      expect(ref.current?.state.grammarSuggestions).toHaveLength(1);
      expect(ref.current?.state.grammarSuggestions[0].id).toBe('g2');
    });

    it('clears suggestions when text changes after grammar check', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'Grammar error',
            replacement: 'Fixed',
            severity: 'error',
            originalText: 'Draft',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      await waitFor(() => expect(ref.current?.state.grammarSuggestions).toHaveLength(1));

      // Applying to stale selection should not commit
      currentText = 'Changed text completely';

      await act(async () => {
        await ref.current?.actions.applyGrammarSuggestion('g1');
      });

      // Commit should not have been called with the new text since selection is stale
      expect(commitMock).not.toHaveBeenCalled();
    });

    it('handles grammar check with no suggestions', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [],
        usage: { tokens: 2 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      expect(ref.current?.state.grammarSuggestions).toHaveLength(0);
      expect(ref.current?.state.grammarHighlights).toHaveLength(0);
    });

    it('handles grammar check error gracefully', async () => {
      fetchGrammarSuggestionsMock.mockRejectedValue(new Error('Grammar service unavailable'));

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      expect(ref.current?.state.magicError).toBe('Grammar service unavailable');
      expect(ref.current?.state.isMagicLoading).toBe(false);
    });

    it('creates grammar highlights with correct styling', async () => {
      fetchGrammarSuggestionsMock.mockResolvedValue({
        suggestions: [
          {
            id: 'g1',
            start: 0,
            end: 5,
            message: 'Style suggestion',
            replacement: 'Fixed',
            severity: 'style',
            originalText: 'Draft',
          },
        ],
        usage: { tokens: 5 },
      });

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      await waitFor(() => expect(ref.current?.state.grammarHighlights).toHaveLength(1));
      expect(ref.current?.state.grammarHighlights[0].severity).toBe('warning');
    });

    it('shows error when no grammar suggestion to apply', async () => {
      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.applyGrammarSuggestion(null);
      });

      expect(ref.current?.state.magicError).toBe('No grammar suggestion to apply');
    });
  });

  describe('abort and cleanup', () => {
    it('aborts pending rewrite on closeMagicBar', async () => {
      let resolveRewrite: (value: any) => void;
      rewriteTextMock.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRewrite = resolve;
          })
      );

      const ref = renderHarness();
      await waitFor(() => expect(ref.current).toBeTruthy());

      act(() => {
        ref.current?.actions.handleRewrite('Rewrite');
      });

      expect(ref.current?.state.isMagicLoading).toBe(true);

      act(() => {
        ref.current?.actions.closeMagicBar();
      });

      // State should be reset
      expect(ref.current?.state.magicVariations).toEqual([]);
      expect(ref.current?.state.activeMagicMode).toBeNull();
    });

    it('does not process empty or whitespace-only selection', async () => {
      const emptySelection: SelectionRange = { start: 0, end: 3, text: '   ' };
      const ref = renderHarness(emptySelection);

      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleRewrite('Rewrite');
      });

      expect(rewriteTextMock).not.toHaveBeenCalled();
    });

    it('does not process grammar check on empty selection', async () => {
      const emptySelection: SelectionRange = { start: 0, end: 3, text: '   ' };
      const ref = renderHarness(emptySelection);

      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.actions.handleGrammarCheck();
      });

      expect(fetchGrammarSuggestionsMock).not.toHaveBeenCalled();
    });
  });

  describe('tone tuner mode', () => {
    it('passes tone parameter to rewrite', async () => {
      rewriteTextMock.mockResolvedValue({ result: ['Formal version'], usage: { tokens: 1 } });
      const ref = renderHarness();

      await waitFor(() => expect(ref.current).toBeTruthy());
      await act(async () => {
        await ref.current?.actions.handleRewrite('Tone Tuner', 'formal');
      });

      expect(rewriteTextMock).toHaveBeenCalledWith(
        'Draft',
        'Tone Tuner',
        'formal',
        undefined,
        expect.any(AbortSignal)
      );
      expect(ref.current?.state.activeMagicMode).toBe('Tone: formal');
    });
  });

  describe('thesaurus help', () => {
    it('handles thesaurus requests', async () => {
      getContextualHelpMock.mockResolvedValue({ result: 'synonym1, synonym2', usage: { tokens: 2 } });
      const ref = renderHarness();

      await waitFor(() => expect(ref.current).toBeTruthy());
      await act(async () => {
        await ref.current?.actions.handleHelp('Thesaurus');
      });

      expect(getContextualHelpMock).toHaveBeenCalledWith('Draft', 'Thesaurus', expect.any(AbortSignal));
      expect(ref.current?.state.magicHelpType).toBe('Thesaurus');
      expect(ref.current?.state.magicHelpResult).toBe('synonym1, synonym2');
    });
  });
});
