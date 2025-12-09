import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useInlineComments } from '@/features/editor/hooks/useInlineComments';
import { AnalysisResult } from '@/types';

vi.mock('@/features/shared', async () => {
  const actual = await vi.importActual<typeof import('@/features/shared/utils/textLocator')>(
    '@/features/shared/utils/textLocator'
  );
  return {
    findQuoteRange: actual.findQuoteRange,
  };
});

const baseAnalysis: AnalysisResult = {
  summary: '',
  strengths: [],
  weaknesses: [],
  pacing: {
    score: 0,
    analysis: '',
    slowSections: [{ description: 'Slow spot', quote: 'slow part' }],
    fastSections: [],
  },
  settingAnalysis: {
    score: 0,
    analysis: '',
    issues: [{ quote: 'setting detail', issue: 'Setting issue', suggestion: 'Add clarity' }],
  },
  plotIssues: [
    { issue: 'Plot hole', location: '1', suggestion: 'Fix plot', quote: 'plot quote' },
  ],
  characters: [
    {
      name: 'Alice',
      bio: '',
      arc: '',
      arcStages: [],
      relationships: [],
      plotThreads: [],
      inconsistencies: [{ issue: 'Out of character', quote: 'character line' }],
      developmentSuggestion: 'Grow',
    },
  ],
  generalSuggestions: [],
};

describe('useInlineComments', () => {
  const text = 'plot quote setting detail slow part character line';

  it('injects comments from analysis and groups by type', () => {
    const onCommentsChange = vi.fn();
    const { result } = renderHook(() => useInlineComments({ currentText: text, onCommentsChange }));

    act(() => result.current.injectFromAnalysis(baseAnalysis));

    expect(result.current.comments).toHaveLength(4);
    expect(result.current.visibleComments).toHaveLength(4);
    expect(result.current.commentsByType.plot).toHaveLength(1);
    expect(result.current.commentsByType.setting).toHaveLength(1);
    expect(result.current.commentsByType.character).toHaveLength(1);
    expect(result.current.commentsByType.pacing).toHaveLength(1);
    expect(onCommentsChange).toHaveBeenCalled();
  });

  it('supports manual add, dismiss, and clear operations', () => {
    const { result } = renderHook(() => useInlineComments({ currentText: text }));

    act(() => result.current.injectFromAnalysis(baseAnalysis));

    act(() => result.current.addComment({
      type: 'prose',
      issue: 'Prose tweak',
      suggestion: 'Tighten wording',
      severity: 'info',
      quote: 'plot',
      startIndex: 0,
      endIndex: 4,
    }));

    expect(result.current.comments).toHaveLength(5);
    expect(result.current.commentsByType.prose).toHaveLength(1);

    const firstId = result.current.comments[0].id;
    act(() => result.current.setActiveComment(result.current.comments[0]));
    act(() => result.current.dismissComment(firstId));

    expect(result.current.comments[0].dismissed).toBe(true);
    expect(result.current.visibleComments).toHaveLength(4);
    expect(result.current.activeComment).toBeNull();

    act(() => result.current.clearAllComments());

    expect(result.current.comments).toHaveLength(0);
    expect(result.current.visibleComments).toHaveLength(0);
  });

  describe('branch coverage for analysisToComments', () => {
    it('skips plot issues without quote or without range', () => {
      const onCommentsChange = vi.fn();
      const { result } = renderHook(() => useInlineComments({ currentText: 'short', onCommentsChange }));

      // Plot issue without quote (null/undefined)
      const noQuotePlot: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [{ issue: 'No quote', location: '1', suggestion: 'Fix' }],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(noQuotePlot));
      expect(result.current.comments).toHaveLength(0);

      // Plot issue with quote but no matching range
      const unmatchedQuotePlot: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [{ issue: 'Unmatched', location: '1', suggestion: 'Fix', quote: 'ZZZNOMATCH' }],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(unmatchedQuotePlot));
      expect(result.current.comments).toHaveLength(0);
    });

    it('skips setting issues without matching range', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: 'short' }));

      const noRangeSetting: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: {
          score: 0,
          analysis: '',
          issues: [{ quote: 'NOMATCH', issue: 'Missing', suggestion: 'Add' }],
        },
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(noRangeSetting));
      expect(result.current.comments).toHaveLength(0);
    });

    it('skips character inconsistencies without quote or range', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: 'short' }));

      const noQuoteChar: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [
          {
            name: 'Bob',
            bio: '',
            arc: '',
            arcStages: [],
            relationships: [],
            plotThreads: [],
            inconsistencies: [{ issue: 'Problem' }],
            developmentSuggestion: null,
          },
        ],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(noQuoteChar));
      expect(result.current.comments).toHaveLength(0);

      const unmatchedChar: AnalysisResult = {
        ...noQuoteChar,
        characters: [
          {
            name: 'Bob',
            bio: '',
            arc: '',
            arcStages: [],
            relationships: [],
            plotThreads: [],
            inconsistencies: [{ issue: 'Problem', quote: 'NOMATCH' }],
            developmentSuggestion: null,
          },
        ],
      };

      act(() => result.current.injectFromAnalysis(unmatchedChar));
      expect(result.current.comments).toHaveLength(0);
    });

    it('skips pacing slow sections when not array or object', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: 'short' }));

      // slowSections not array (string)
      const stringSlow: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: 'Not an array' as any, fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(stringSlow));
      expect(result.current.comments).toHaveLength(0);

      // slowSections is array with non-object items
      const primitiveSlow: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: ['just a string'] as any, fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(primitiveSlow));
      expect(result.current.comments).toHaveLength(0);

      // slowSections object without quote
      const noQuoteSlow: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [{ description: 'slow' }], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(noQuoteSlow));
      expect(result.current.comments).toHaveLength(0);

      // slowSections with quote that doesn't match
      const unmatchedSlow: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [{ description: 'slow', quote: 'NOMATCH' }], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(unmatchedSlow));
      expect(result.current.comments).toHaveLength(0);
    });

    it('skips pacing fast sections when not array or object', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: 'short' }));

      // fastSections not array
      const stringFast: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: 'Not an array' as any },
      };

      act(() => result.current.injectFromAnalysis(stringFast));
      expect(result.current.comments).toHaveLength(0);

      // fastSections array with non-object
      const primitiveFast: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: ['string item'] as any },
      };

      act(() => result.current.injectFromAnalysis(primitiveFast));
      expect(result.current.comments).toHaveLength(0);

      // fastSections object without quote
      const noQuoteFast: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [{ description: 'fast' }] },
      };

      act(() => result.current.injectFromAnalysis(noQuoteFast));
      expect(result.current.comments).toHaveLength(0);

      // fastSections with quote that doesn't match
      const unmatchedFast: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [{ description: 'fast', quote: 'NOMATCH' }] },
      };

      act(() => result.current.injectFromAnalysis(unmatchedFast));
      expect(result.current.comments).toHaveLength(0);
    });

    it('uses fallback suggestion for character without developmentSuggestion', () => {
      const text = 'hello world';
      const { result } = renderHook(() => useInlineComments({ currentText: text }));

      const nullDevSuggestion: AnalysisResult = {
        ...baseAnalysis,
        plotIssues: [],
        settingAnalysis: undefined,
        characters: [
          {
            name: 'Alice',
            bio: '',
            arc: '',
            arcStages: [],
            relationships: [],
            plotThreads: [],
            inconsistencies: [{ issue: 'Problem', quote: 'hello' }],
            developmentSuggestion: null,
          },
        ],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(nullDevSuggestion));
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].suggestion).toBe('Review character consistency');
    });

    it('handles dismissing non-active comment', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: text }));

      act(() => result.current.injectFromAnalysis(baseAnalysis));
      const nonActive = result.current.comments[1];

      // Set a different comment as active
      act(() => result.current.setActiveComment(result.current.comments[0]));

      // Dismiss the non-active comment
      act(() => result.current.dismissComment(nonActive.id));

      // Active comment should remain unchanged
      expect(result.current.activeComment?.id).toBe(result.current.comments[0].id);
    });

    it('handles unknown comment type in commentsByType', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: 'testtext' }));

      act(() => result.current.addComment({
        type: 'unknown' as any,
        issue: 'Unknown type',
        suggestion: 'Suggestion',
        severity: 'info',
        quote: 'test',
        startIndex: 0,
        endIndex: 4,
      }));

      // Unknown types won't be grouped
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.commentsByType.plot).toHaveLength(0);
    });

    it('handles undefined settingAnalysis', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: text }));

      const noSettingAnalysis: AnalysisResult = {
        ...baseAnalysis,
        settingAnalysis: undefined,
        plotIssues: [],
        characters: [],
        pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      };

      act(() => result.current.injectFromAnalysis(noSettingAnalysis));
      expect(result.current.comments).toHaveLength(0);
    });

    it('calls onCommentsChange when not provided', () => {
      const { result } = renderHook(() => useInlineComments({ currentText: text }));

      // Should not throw when onCommentsChange is undefined
      act(() => result.current.injectFromAnalysis(baseAnalysis));
      expect(result.current.comments.length).toBeGreaterThan(0);
    });
  });
});
