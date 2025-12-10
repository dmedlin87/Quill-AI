import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorComments } from '@/features/editor/hooks/useEditorComments';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import type { Chapter, InlineComment } from '@/types/schema';

const makeComment = (overrides: Partial<InlineComment>): InlineComment => ({
  id: overrides.id ?? 'id-' + Math.random().toString(36).slice(2),
  type: overrides.type ?? 'plot',
  issue: overrides.issue ?? 'Issue',
  suggestion: overrides.suggestion ?? 'Suggestion',
  severity: overrides.severity ?? 'error',
  quote: overrides.quote ?? 'quote',
  startIndex: overrides.startIndex ?? 0,
  endIndex: overrides.endIndex ?? 10,
  dismissed: overrides.dismissed ?? false,
  createdAt: overrides.createdAt ?? Date.now(),
});

const makeChapter = (comments: InlineComment[]): Chapter => ({
  id: 'ch1',
  title: 'Test Chapter',
  content: 'Test content',
  scenes: [],
  comments,
  branches: [],
  sceneBreakpoints: [],
  order: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('useEditorComments', () => {
  beforeEach(() => {
    // Reset critiqueIntensity to a known default before each test
    useSettingsStore.setState({ critiqueIntensity: 'standard' });
  });

  describe('filtering by critiqueIntensity', () => {
    it('filters visibleComments by critiqueIntensity', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'error', severity: 'error' }),
        makeComment({ id: 'warning', severity: 'warning' }),
        makeComment({ id: 'info', severity: 'info' }),
      ];

      const { result, rerender } = renderHook(() => useEditorComments(undefined));

      // Developmental: only errors
      act(() => {
        useSettingsStore.setState({ critiqueIntensity: 'developmental' });
        result.current.setInlineComments(comments);
      });

      expect(result.current.inlineComments).toHaveLength(3);
      expect(result.current.visibleComments.map((c) => c.severity)).toEqual(['error']);

      // Standard: errors + warnings
      act(() => {
        useSettingsStore.setState({ critiqueIntensity: 'standard' });
      });
      rerender();

      expect(result.current.visibleComments.map((c) => c.severity).sort()).toEqual(
        ['error', 'warning'].sort(),
      );

      // Intensive: all severities
      act(() => {
        useSettingsStore.setState({ critiqueIntensity: 'intensive' });
      });
      rerender();

      expect(result.current.visibleComments.map((c) => c.severity).sort()).toEqual(
        ['error', 'warning', 'info'].sort(),
      );
    });

    it('never includes dismissed comments in visibleComments', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'keep', severity: 'error', dismissed: false }),
        makeComment({ id: 'dismissed', severity: 'error', dismissed: true }),
      ];

      const { result } = renderHook(() => useEditorComments(undefined));

      act(() => {
        result.current.setInlineComments(comments);
      });

      expect(result.current.inlineComments).toHaveLength(2);
      expect(result.current.visibleComments.map((c) => c.id)).toEqual(['keep']);
    });
  });

  describe('dismissComment', () => {
    it('marks a comment as dismissed by ID', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'c1', severity: 'error', dismissed: false }),
        makeComment({ id: 'c2', severity: 'error', dismissed: false }),
      ];

      const { result } = renderHook(() => useEditorComments(undefined));

      act(() => {
        result.current.setInlineComments(comments);
      });

      expect(result.current.visibleComments).toHaveLength(2);

      act(() => {
        result.current.dismissComment('c1');
      });

      expect(result.current.inlineComments.find(c => c.id === 'c1')?.dismissed).toBe(true);
      expect(result.current.visibleComments).toHaveLength(1);
      expect(result.current.visibleComments[0].id).toBe('c2');
    });

    it('does nothing when dismissing non-existent comment', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'c1', severity: 'error' }),
      ];

      const { result } = renderHook(() => useEditorComments(undefined));

      act(() => {
        result.current.setInlineComments(comments);
        result.current.dismissComment('non-existent');
      });

      expect(result.current.inlineComments).toHaveLength(1);
      expect(result.current.inlineComments[0].dismissed).toBe(false);
    });
  });

  describe('clearComments', () => {
    it('removes all comments', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'c1' }),
        makeComment({ id: 'c2' }),
        makeComment({ id: 'c3' }),
      ];

      const { result } = renderHook(() => useEditorComments(undefined));

      act(() => {
        result.current.setInlineComments(comments);
      });

      expect(result.current.inlineComments).toHaveLength(3);

      act(() => {
        result.current.clearComments();
      });

      expect(result.current.inlineComments).toHaveLength(0);
      expect(result.current.visibleComments).toHaveLength(0);
    });
  });

  describe('activeChapter sync', () => {
    it('initializes comments from activeChapter', () => {
      const comments: InlineComment[] = [
        makeComment({ id: 'ch-c1', severity: 'error' }),
        makeComment({ id: 'ch-c2', severity: 'warning' }),
      ];
      const chapter = makeChapter(comments);

      const { result } = renderHook(() => useEditorComments(chapter));

      expect(result.current.inlineComments).toHaveLength(2);
      expect(result.current.inlineComments[0].id).toBe('ch-c1');
    });

    it('updates comments when activeChapter changes', () => {
      const comments1: InlineComment[] = [makeComment({ id: 'old' })];
      const comments2: InlineComment[] = [makeComment({ id: 'new1' }), makeComment({ id: 'new2' })];
      
      const chapter1 = makeChapter(comments1);
      const chapter2 = makeChapter(comments2);

      const { result, rerender } = renderHook(
        ({ chapter }) => useEditorComments(chapter),
        { initialProps: { chapter: chapter1 } }
      );

      expect(result.current.inlineComments).toHaveLength(1);
      expect(result.current.inlineComments[0].id).toBe('old');

      rerender({ chapter: chapter2 });

      expect(result.current.inlineComments).toHaveLength(2);
      expect(result.current.inlineComments[0].id).toBe('new1');
    });

    it('clears comments when activeChapter becomes undefined', () => {
      const comments: InlineComment[] = [makeComment({ id: 'c1' })];
      const chapter = makeChapter(comments);

      const { result, rerender } = renderHook(
        ({ chapter }) => useEditorComments(chapter),
        { initialProps: { chapter: chapter as Chapter | undefined } }
      );

      expect(result.current.inlineComments).toHaveLength(1);

      rerender({ chapter: undefined });

      expect(result.current.inlineComments).toHaveLength(0);
    });

    it('handles chapter with no comments', () => {
      const chapter = makeChapter([]);

      const { result } = renderHook(() => useEditorComments(chapter));

      expect(result.current.inlineComments).toHaveLength(0);
      expect(result.current.visibleComments).toHaveLength(0);
    });
  });
});

