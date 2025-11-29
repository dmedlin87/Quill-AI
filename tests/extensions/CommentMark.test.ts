import { describe, it, expect, vi } from 'vitest';

import { CommentMark, type CommentMarkAttributes } from '@/features/editor/extensions/CommentMark';

describe('CommentMark extension', () => {
  it('defines expected attributes with parse/render helpers', () => {
    const cfg = (CommentMark as any).config;
    const attrs = cfg.addAttributes();

    expect(attrs).toHaveProperty('commentId');
    expect(attrs).toHaveProperty('type');
    expect(attrs).toHaveProperty('issue');
    expect(attrs).toHaveProperty('suggestion');
    expect(attrs).toHaveProperty('severity');

    const el: any = {
      getAttribute: (name: string) => {
        const map: Record<string, string> = {
          'data-comment-id': 'c1',
          'data-comment-type': 'plot',
          'data-comment-issue': 'Issue',
          'data-comment-suggestion': 'Suggestion',
          'data-comment-severity': 'warning',
        };
        return map[name];
      },
    };

    expect(attrs.commentId.parseHTML(el)).toBe('c1');
    expect(attrs.type.parseHTML(el)).toBe('plot');
    expect(attrs.issue.parseHTML(el)).toBe('Issue');
    expect(attrs.suggestion.parseHTML(el)).toBe('Suggestion');
    expect(attrs.severity.parseHTML(el)).toBe('warning');

    const rendered = {
      ...attrs.commentId.renderHTML({ commentId: 'c2' }),
      ...attrs.type.renderHTML({ type: 'character' }),
      ...attrs.issue.renderHTML({ issue: 'Other' }),
      ...attrs.suggestion.renderHTML({ suggestion: 'Do X' }),
      ...attrs.severity.renderHTML({ severity: 'error' }),
    };

    expect(rendered['data-comment-id']).toBe('c2');
    expect(rendered['data-comment-type']).toBe('character');
    expect(rendered['data-comment-issue']).toBe('Other');
    expect(rendered['data-comment-suggestion']).toBe('Do X');
    expect(rendered['data-comment-severity']).toBe('error');
  });

  it('parses HTML only for span elements with data-comment-id', () => {
    const cfg = (CommentMark as any).config;
    const rules = cfg.parseHTML();

    expect(Array.isArray(rules)).toBe(true);
    expect(rules[0]).toMatchObject({ tag: 'span[data-comment-id]' });
  });

  it('computes background and border colors based on severity and type', () => {
    const cfg = (CommentMark as any).config;
    const [tag, attrs] = cfg.renderHTML.call({
      options: { HTMLAttributes: {} },
    }, {
      HTMLAttributes: {
        'data-comment-severity': 'error',
        'data-comment-type': 'plot',
      },
    } as any);

    expect(tag).toBe('span');
    expect(attrs.class).toContain('comment-highlight');
    expect(attrs.style).toContain('rgba(239, 68, 68, 0.2)');

    const [, fallbackAttrs] = cfg.renderHTML.call({
      options: { HTMLAttributes: {} },
    }, {
      HTMLAttributes: {
        'data-comment-severity': 'unknown',
        'data-comment-type': 'unknown',
      },
    } as any);

    // Falls back to warning/plot color
    expect(fallbackAttrs.style).toContain('rgba(245, 158, 11, 0.2)');
  });

  it('setComment command delegates to setMark with correct attributes', () => {
    const attrs: CommentMarkAttributes = {
      commentId: 'c1',
      type: 'plot',
      issue: 'Issue',
      suggestion: 'Suggestion',
      severity: 'warning',
    };

    const cfg = (CommentMark as any).config;
    const commands = cfg.addCommands();
    const setMark = vi.fn().mockReturnValue(true);

    const handler = commands.setComment(attrs);
    const result = handler({ commands: { setMark } } as any);

    expect(setMark).toHaveBeenCalledWith(CommentMark.name, attrs);
    expect(result).toBe(true);
  });

  it('clearAllComments command unsets the mark', () => {
    const cfg = (CommentMark as any).config;
    const commands = cfg.addCommands();
    const unsetMark = vi.fn().mockReturnValue('done');

    const handler = commands.clearAllComments();
    const result = handler({ commands: { unsetMark } } as any);

    expect(unsetMark).toHaveBeenCalledWith(CommentMark.name);
    expect(result).toBe('done');
  });

  it('unsetComment removes marks with matching commentId and dispatches transaction', () => {
    const cfg = (CommentMark as any).config;
    const commands = cfg.addCommands();

    const removeMark = vi.fn();
    const tr = { removeMark } as any;
    const matchingMark = { type: { name: CommentMark.name }, attrs: { commentId: 'target' } } as any;
    const nonMatchingMark = { type: { name: CommentMark.name }, attrs: { commentId: 'other' } } as any;

    const doc = {
      nodesBetween: (from: number, to: number, cb: (node: any, pos: number) => void) => {
        cb({ isText: true, nodeSize: 3, marks: [matchingMark, nonMatchingMark] }, from);
      },
    };

    const state = {
      doc,
      selection: { from: 0, to: 5 },
    } as any;

    const dispatch = vi.fn();

    const handler = commands.unsetComment('target');
    const result = handler({ tr, state, dispatch } as any);

    expect(removeMark).toHaveBeenCalledTimes(1);
    expect(removeMark).toHaveBeenCalledWith(0, 3, matchingMark);
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(result).toBe(true);
  });

  it('unsetComment still returns true when dispatch is not provided', () => {
    const cfg = (CommentMark as any).config;
    const commands = cfg.addCommands();

    const removeMark = vi.fn();
    const tr = { removeMark } as any;
    const mark = { type: { name: CommentMark.name }, attrs: { commentId: 'id' } } as any;
    const doc = {
      nodesBetween: (from: number, to: number, cb: (node: any, pos: number) => void) => {
        cb({ isText: true, nodeSize: 1, marks: [mark] }, from);
      },
    };

    const state = {
      doc,
      selection: { from: 0, to: 1 },
    } as any;

    const handler = commands.unsetComment('id');
    const result = handler({ tr, state, dispatch: undefined } as any);

    expect(removeMark).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
