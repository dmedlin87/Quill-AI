/**
 * CommentMark - Tiptap Mark Extension for Quill AI 3.0
 * 
 * Inline critique system that marks text ranges with AI-generated comments.
 * Comments are stored as mark attributes and rendered as highlighted spans.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkAttributes {
  commentId: string;
  type: 'plot' | 'setting' | 'character' | 'pacing' | 'prose';
  issue: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

type CommentType = CommentMarkAttributes['type'];
type CommentSeverity = CommentMarkAttributes['severity'];

const COLOR_MAP: Record<CommentSeverity, Record<CommentType, string>> = {
  error: {
    plot: 'rgba(239, 68, 68, 0.2)', // Red
    setting: 'rgba(239, 68, 68, 0.2)',
    character: 'rgba(239, 68, 68, 0.2)',
    pacing: 'rgba(239, 68, 68, 0.2)',
    prose: 'rgba(239, 68, 68, 0.2)',
  },
  warning: {
    plot: 'rgba(245, 158, 11, 0.2)', // Amber
    setting: 'rgba(168, 85, 247, 0.2)', // Purple
    character: 'rgba(59, 130, 246, 0.2)', // Blue
    pacing: 'rgba(16, 185, 129, 0.2)', // Green
    prose: 'rgba(236, 72, 153, 0.2)', // Pink
  },
  info: {
    plot: 'rgba(99, 102, 241, 0.15)', // Indigo (lighter)
    setting: 'rgba(168, 85, 247, 0.15)',
    character: 'rgba(59, 130, 246, 0.15)',
    pacing: 'rgba(16, 185, 129, 0.15)',
    prose: 'rgba(236, 72, 153, 0.15)',
  },
};

const BORDER_COLOR_MAP: Record<CommentSeverity, string> = {
  error: 'rgb(239, 68, 68)',
  warning: 'rgb(245, 158, 11)',
  info: 'rgb(99, 102, 241)',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /**
       * Add a comment mark to the selected text
       */
      setComment: (attributes: CommentMarkAttributes) => ReturnType;
      /**
       * Remove a comment mark
       */
      unsetComment: (commentId: string) => ReturnType;
      /**
       * Remove all comment marks
       */
      clearAllComments: () => ReturnType;
    };
  }
}

export const CommentMark = Mark.create({
  name: 'comment',
  
  priority: 1000,
  
  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: (_commentId: string, _attrs: CommentMarkAttributes) => {},
    };
  },
  
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => ({
          'data-comment-id': attributes.commentId,
        }),
      },
      type: {
        default: 'plot',
        parseHTML: element => element.getAttribute('data-comment-type'),
        renderHTML: attributes => ({
          'data-comment-type': attributes.type,
        }),
      },
      issue: {
        default: '',
        parseHTML: element => element.getAttribute('data-comment-issue'),
        renderHTML: attributes => ({
          'data-comment-issue': attributes.issue,
        }),
      },
      suggestion: {
        default: '',
        parseHTML: element => element.getAttribute('data-comment-suggestion'),
        renderHTML: attributes => ({
          'data-comment-suggestion': attributes.suggestion,
        }),
      },
      severity: {
        default: 'warning',
        parseHTML: element => element.getAttribute('data-comment-severity'),
        renderHTML: attributes => ({
          'data-comment-severity': attributes.severity,
        }),
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    const severity = HTMLAttributes['data-comment-severity'] || 'warning';
    const type = HTMLAttributes['data-comment-type'] || 'plot';
    const bgColor = COLOR_MAP[severity]?.[type] || COLOR_MAP.warning.plot;
    const borderColor = BORDER_COLOR_MAP[severity] || BORDER_COLOR_MAP.warning;
    
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'comment-highlight cursor-pointer transition-all hover:brightness-90',
        style: `background-color: ${bgColor}; border-bottom: 2px solid ${borderColor}; padding: 1px 0;`,
      }),
      0,
    ];
  },
  
  addCommands() {
    return {
      setComment:
        (attributes: CommentMarkAttributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetComment:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc, selection } = state;
          const { from, to } = selection;
          
          // Find and remove marks with matching commentId
          doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText) {
              node.marks.forEach(mark => {
                if (mark.type.name === this.name && mark.attrs.commentId === commentId) {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                }
              });
            }
          });
          
          if (dispatch) dispatch(tr);
          return true;
        },
      clearAllComments:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default CommentMark;
