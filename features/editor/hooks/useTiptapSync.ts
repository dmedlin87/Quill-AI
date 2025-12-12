import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { InlineComment } from '@/types/schema';
import { Editor } from '@tiptap/react';

const ANALYSIS_PLUGIN_KEY = new PluginKey('analysis-decorations');
const COMMENT_PLUGIN_KEY = new PluginKey('comment-decorations');

export interface HighlightItem {
  start: number;
  end: number;
  color: string;
  title?: string;
  severity?: 'error' | 'warning' | 'info' | 'success';
}

interface UseTiptapSyncOptions {
  analysisHighlights: HighlightItem[];
  inlineComments: InlineComment[];
  onCommentClick?: (comment: InlineComment, position: { top: number; left: number }) => void;
}

/**
 * Maps color strings to CSS decoration classes.
 * Falls back to 'warning' for unknown colors.
 */
function getDecorationClass(color: string, severity?: string): string {
  if (severity) {
    return `decoration-base decoration-${severity}`;
  }
  
  // Map common colors to classes
  const colorLower = color.toLowerCase();
  if (colorLower.includes('red') || colorLower.includes('ef4444')) {
    return 'decoration-base decoration-error';
  }
  if (colorLower.includes('amber') || colorLower.includes('f59e0b') || colorLower.includes('orange')) {
    return 'decoration-base decoration-warning';
  }
  if (colorLower.includes('indigo') || colorLower.includes('6366f1') || colorLower.includes('blue')) {
    return 'decoration-base decoration-info';
  }
  if (colorLower.includes('green') || colorLower.includes('22c55e')) {
    return 'decoration-base decoration-success';
  }
  if (colorLower.includes('gold') || colorLower.includes('c9a227')) {
    return 'decoration-base decoration-analysis';
  }
  
  // Default to warning for analysis highlights
  return 'decoration-base decoration-analysis';
}

/**
 * Maps comment severity to CSS class
 */
function getCommentDecorationClass(severity: 'error' | 'warning' | 'info'): string {
  return `inline-comment-highlight decoration-base decoration-${severity}`;
}

/**
 * Custom hook that bundles all Tiptap-related ref syncing and plugin creation.
 * This replaces multiple useEffect hooks with a single, optimized solution.
 */
export function useTiptapSync(options: UseTiptapSyncOptions) {
  const { analysisHighlights, inlineComments, onCommentClick } = options;

  // Refs for closure access in plugins
  const analysisHighlightsRef = useRef<HighlightItem[]>(analysisHighlights);
  const inlineCommentsRef = useRef<InlineComment[]>(inlineComments);
  const onCommentClickRef = useRef<typeof onCommentClick>(onCommentClick);

  // Batch update refs in a single effect
  useEffect(() => {
    analysisHighlightsRef.current = analysisHighlights;
    inlineCommentsRef.current = inlineComments;
    onCommentClickRef.current = onCommentClick;
  }, [analysisHighlights, inlineComments, onCommentClick]);

  // Force decoration refresh - call this after data changes
  const refreshDecorations = useCallback((editor: Editor) => {
    if (!editor || editor.isDestroyed) return;
    // Trigger a no-op transaction to force decoration recalculation
    editor.view.dispatch(editor.state.tr.setMeta('forceDecorationRefresh', true));
  }, []);

  // Memoized analysis decoration plugin
  const AnalysisDecorations = useMemo(() => {
    return new Plugin({
      key: ANALYSIS_PLUGIN_KEY,
      props: {
        decorations(state) {
          const { doc } = state;
          const decorations: Decoration[] = [];
          const highlights = analysisHighlightsRef.current;

          for (const h of highlights) {
            if (h.start >= 0 && h.start < h.end && h.end <= doc.content.size) {
              decorations.push(
                Decoration.inline(h.start, h.end, {
                  class: getDecorationClass(h.color, h.severity),
                  title: h.title || '',
                })
              );
            }
          }

          return DecorationSet.create(doc, decorations);
        },
      },
    });
  }, []); // Empty deps - plugin uses refs internally

  // Memoized comment decoration plugin
  const CommentDecorations = useMemo(() => {
    return new Plugin({
      key: COMMENT_PLUGIN_KEY,
      props: {
        decorations(state) {
          const { doc } = state;
          const decorations: Decoration[] = [];
          const comments = inlineCommentsRef.current;

          for (const comment of comments) {
            if (comment.dismissed) continue;
            if (
              comment.startIndex >= 0 &&
              comment.startIndex < comment.endIndex &&
              comment.endIndex <= doc.content.size
            ) {
              decorations.push(
                Decoration.inline(comment.startIndex, comment.endIndex, {
                  class: getCommentDecorationClass(comment.severity),
                  'data-comment-id': comment.id,
                })
              );
            }
          }

          return DecorationSet.create(doc, decorations);
        },
        handleClick(view, pos, event) {
          const target = (event.target as HTMLElement | null)?.closest('[data-comment-id]') as HTMLElement | null;
          const commentId = target?.getAttribute('data-comment-id');
          if (commentId) {
            const comments = inlineCommentsRef.current;
            const onClick = onCommentClickRef.current;
            const comment = comments.find(c => c.id === commentId);
            if (comment && onClick) {
              const rect = target.getBoundingClientRect();
              onClick(comment, { top: rect.bottom + 8, left: rect.left });
              return true;
            }
          }
          return false;
        },
      },
    });
  }, []); // Empty deps - plugin uses refs internally

  // Plugin installer - call once after editor is created
  const installPlugins = useCallback((editor: Editor) => {
    if (!editor || editor.isDestroyed) return;

    const state = editor.state;
    const existingPlugins = state.plugins.filter((p: Plugin) => {
      const keyObj = p.spec.key as PluginKey | undefined;
      const keyName = (keyObj as any)?.key ?? (p as any)?.key;
      return keyName !== 'analysis-decorations' && keyName !== 'comment-decorations';
    });

    const newState = state.reconfigure({
      plugins: [...existingPlugins, AnalysisDecorations, CommentDecorations],
    });
    editor.view.updateState(newState);
  }, [AnalysisDecorations, CommentDecorations]);

  return {
    AnalysisDecorations,
    CommentDecorations,
    installPlugins,
    refreshDecorations,
  };
}

/**
 * Creates a debounced callback for editor updates.
 * @param callback - The function to call with the markdown content
 * @param delay - Debounce delay in milliseconds (default: 300)
 */
export function useDebouncedUpdate(
  callback: (text: string) => void,
  delay: number = 300
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  // Keep callback ref fresh
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((text: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(text);
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
