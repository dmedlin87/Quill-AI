/**
 * useInlineComments - Hook for managing inline AI critiques
 * 
 * Converts analysis results to inline comments and manages their lifecycle.
 */

import { useState, useCallback, useMemo } from 'react';
import { AnalysisResult } from '@/types';
import { InlineComment } from '@/types/schema';
import { findQuoteRange } from '@/features/shared';

export interface UseInlineCommentsOptions {
  currentText: string;
  onCommentsChange?: (comments: InlineComment[]) => void;
}

export interface UseInlineCommentsResult {
  comments: InlineComment[];
  activeComment: InlineComment | null;
  
  // Actions
  injectFromAnalysis: (analysis: AnalysisResult) => void;
  addComment: (comment: Omit<InlineComment, 'id' | 'createdAt' | 'dismissed'>) => void;
  dismissComment: (commentId: string) => void;
  clearAllComments: () => void;
  setActiveComment: (comment: InlineComment | null) => void;
  
  // Computed
  visibleComments: InlineComment[];
  commentsByType: Record<string, InlineComment[]>;
}

/**
 * Converts analysis results to inline comments with position data
 */
function analysisToComments(analysis: AnalysisResult, fullText: string): InlineComment[] {
  const comments: InlineComment[] = [];

  // Plot issues
  analysis.plotIssues.forEach(issue => {
    if (issue.quote) {
      const range = findQuoteRange(fullText, issue.quote);
      if (range) {
        comments.push({
          id: crypto.randomUUID(),
          type: 'plot',
          issue: issue.issue,
          suggestion: issue.suggestion,
          severity: 'warning',
          quote: issue.quote,
          startIndex: range.start,
          endIndex: range.end,
          dismissed: false,
          createdAt: Date.now(),
        });
      }
    }
  });

  // Setting issues
  analysis.settingAnalysis?.issues.forEach(issue => {
    const range = findQuoteRange(fullText, issue.quote);
    if (range) {
      comments.push({
        id: crypto.randomUUID(),
        type: 'setting',
        issue: issue.issue,
        suggestion: issue.suggestion,
        severity: 'warning',
        quote: issue.quote,
        startIndex: range.start,
        endIndex: range.end,
        dismissed: false,
        createdAt: Date.now(),
      });
    }
  });

  // Character inconsistencies
  analysis.characters.forEach(character => {
    character.inconsistencies.forEach(inc => {
      if (inc.quote) {
        const range = findQuoteRange(fullText, inc.quote);
        if (range) {
          comments.push({
            id: crypto.randomUUID(),
            type: 'character',
            issue: `${character.name}: ${inc.issue}`,
            suggestion: character.developmentSuggestion || 'Review character consistency',
            severity: 'warning',
            quote: inc.quote,
            startIndex: range.start,
            endIndex: range.end,
            dismissed: false,
            createdAt: Date.now(),
          });
        }
      }
    });
  });

  // Pacing slow sections
  if (Array.isArray(analysis.pacing.slowSections)) {
    analysis.pacing.slowSections.forEach(section => {
      if (typeof section === 'object' && section.quote) {
        const range = findQuoteRange(fullText, section.quote);
        if (range) {
          comments.push({
            id: crypto.randomUUID(),
            type: 'pacing',
            issue: section.description || 'Slow pacing detected',
            suggestion: 'Consider trimming or adding tension',
            severity: 'info',
            quote: section.quote,
            startIndex: range.start,
            endIndex: range.end,
            dismissed: false,
            createdAt: Date.now(),
          });
        }
      }
    });
  }

  // Pacing fast sections
  if (Array.isArray(analysis.pacing.fastSections)) {
    analysis.pacing.fastSections.forEach(section => {
      if (typeof section === 'object' && section.quote) {
        const range = findQuoteRange(fullText, section.quote);
        if (range) {
          comments.push({
            id: crypto.randomUUID(),
            type: 'pacing',
            issue: section.description || 'Fast pacing detected',
            suggestion: 'Consider expanding or slowing down',
            severity: 'info',
            quote: section.quote,
            startIndex: range.start,
            endIndex: range.end,
            dismissed: false,
            createdAt: Date.now(),
          });
        }
      }
    });
  }

  return comments;
}

export function useInlineComments(options: UseInlineCommentsOptions): UseInlineCommentsResult {
  const { currentText, onCommentsChange } = options;
  
  const [comments, setComments] = useState<InlineComment[]>([]);
  const [activeComment, setActiveComment] = useState<InlineComment | null>(null);

  const updateComments = useCallback(
    (updater: (prev: InlineComment[]) => InlineComment[]) => {
      setComments(prev => {
        const next = updater(prev);
        onCommentsChange?.(next);
        return next;
      });
    },
    [onCommentsChange],
  );

  const injectFromAnalysis = useCallback((analysis: AnalysisResult) => {
    const newComments = analysisToComments(analysis, currentText);
    updateComments(() => newComments);
  }, [currentText, updateComments]);

  const addComment = useCallback((comment: Omit<InlineComment, 'id' | 'createdAt' | 'dismissed'>) => {
    const newComment: InlineComment = {
      ...comment,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      dismissed: false,
    };
    updateComments(prev => [...prev, newComment]);
  }, [updateComments]);

  const dismissComment = useCallback((commentId: string) => {
    updateComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, dismissed: true } : c
      )
    );
    if (activeComment?.id === commentId) {
      setActiveComment(null);
    }
  }, [activeComment, updateComments]);

  const clearAllComments = useCallback(() => {
    updateComments(() => []);
    setActiveComment(null);
  }, [updateComments]);

  const visibleComments = useMemo(
    () => comments.filter(c => !c.dismissed),
    [comments]
  );

  const commentsByType = useMemo(() => {
    const grouped: Record<string, InlineComment[]> = {
      plot: [],
      setting: [],
      character: [],
      pacing: [],
      prose: [],
    };
    
    visibleComments.forEach(c => {
      if (grouped[c.type]) {
        grouped[c.type].push(c);
      }
    });
    
    return grouped;
  }, [visibleComments]);

  return {
    comments,
    activeComment,
    injectFromAnalysis,
    addComment,
    dismissComment,
    clearAllComments,
    setActiveComment,
    visibleComments,
    commentsByType,
  };
}

export default useInlineComments;
