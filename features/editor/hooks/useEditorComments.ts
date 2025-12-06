import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Chapter, InlineComment } from '@/types/schema';
import { useSettingsStore } from '@/features/settings';

interface UseEditorCommentsResult {
  inlineComments: InlineComment[];
  visibleComments: InlineComment[];
  setInlineComments: (comments: InlineComment[]) => void;
  dismissComment: (commentId: string) => void;
  clearComments: () => void;
}

export const useEditorComments = (
  activeChapter: Chapter | undefined,
): UseEditorCommentsResult => {
  const [inlineComments, setInlineCommentsState] = useState<InlineComment[]>(
    () => activeChapter?.comments || [],
  );

  const critiqueIntensity = useSettingsStore((state) => state.critiqueIntensity);

  useEffect(() => {
    if (activeChapter) {
      setInlineCommentsState(activeChapter.comments || []);
    } else {
      setInlineCommentsState([]);
    }
  }, [activeChapter]);

  const setInlineComments = useCallback((comments: InlineComment[]) => {
    setInlineCommentsState(comments);
  }, []);

  const dismissComment = useCallback((commentId: string) => {
    setInlineCommentsState(prev =>
      prev.map(c => (c.id === commentId ? { ...c, dismissed: true } : c)),
    );
  }, []);

  const clearComments = useCallback(() => {
    setInlineCommentsState([]);
  }, []);

  const allowedSeverities = useMemo(() => {
    switch (critiqueIntensity) {
      case 'developmental':
        return new Set<InlineComment['severity']>(['error']);
      case 'standard':
        return new Set<InlineComment['severity']>(['error', 'warning']);
      case 'intensive':
      default:
        return new Set<InlineComment['severity']>(['error', 'warning', 'info']);
    }
  }, [critiqueIntensity]);

  const visibleComments = useMemo(
    () =>
      inlineComments.filter(
        (comment) => !comment.dismissed && allowedSeverities.has(comment.severity),
      ),
    [inlineComments, allowedSeverities],
  );

  return {
    inlineComments,
    visibleComments,
    setInlineComments,
    dismissComment,
    clearComments,
  };
};
