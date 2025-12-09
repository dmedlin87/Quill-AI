import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useTiptapSync, useDebouncedUpdate, type HighlightItem } from '@/features/editor/hooks/useTiptapSync';
import type { InlineComment } from '@/types/schema';

const makeDoc = (size: number) =>
  ({
    content: { size },
    forEach: () => {},
  } as any);

const buildEditor = (plugins: Plugin[] = []) => {
  const state = {
    plugins,
    tr: {
      setMeta: vi.fn((key: string, value: unknown) => ({
        getMeta: (k: string) => (k === key ? value : undefined),
      })),
    },
    reconfigure: vi.fn(({ plugins: newPlugins }: { plugins: Plugin[] }) => ({
      plugins: newPlugins,
      marker: 'reconfigured',
    })),
  } as unknown as { plugins: Plugin[]; tr: { setMeta: (key: string, value: unknown) => any }; reconfigure: (opts: { plugins: Plugin[] }) => unknown };

  return {
    state,
    view: {
      updateState: vi.fn(),
      dispatch: vi.fn(),
    },
    isDestroyed: false,
  } as any;
};

const baseHighlight: HighlightItem = {
  start: 0,
  end: 5,
  color: 'red',
  title: 'alert',
  severity: 'error',
};

const baseComment: InlineComment = {
  id: 'c1',
  type: 'plot',
  issue: 'i',
  suggestion: 's',
  quote: 'q',
  startIndex: 1,
  endIndex: 3,
  severity: 'warning',
  dismissed: false,
  createdAt: 0,
};

describe('useTiptapSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates analysis decorations for valid ranges and skips invalid', () => {
    const { result } = renderHook(() =>
      useTiptapSync({
        analysisHighlights: [baseHighlight, { ...baseHighlight, start: 10, end: 5 }],
        inlineComments: [],
      }),
    );

    const plugin = result.current.AnalysisDecorations;
    const decos = (plugin.props.decorations as any).call(plugin, {
      doc: makeDoc(20),
    } as any) as any;

    const decorations = decos.find ? decos.find() : [];
    expect(decorations).toHaveLength(1);
    expect(decorations[0].type.attrs.class).toContain('decoration-error');
    expect(decorations[0].type.attrs.title).toBe('alert');
  });

  it('handles comment click via decoration handler', () => {
    const onCommentClick = vi.fn();
    const { result } = renderHook(() =>
      useTiptapSync({
        analysisHighlights: [],
        inlineComments: [baseComment],
        onCommentClick,
      }),
    );

    const plugin = result.current.CommentDecorations;
    const decorationSet = (plugin.props.decorations as any).call(plugin, {
      doc: makeDoc(10),
    } as any) as any;
    expect(decorationSet.find ? decorationSet.find() : []).toHaveLength(1);

    const target = document.createElement('span');
    target.setAttribute('data-comment-id', 'c1');
    target.getBoundingClientRect = () => ({ top: 0, left: 10, bottom: 20, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });

    const handled = (plugin.props.handleClick as any)?.call(
      plugin as any,
      {} as any,
      0,
      { target } as any,
    );

    expect(handled).toBe(true);
    expect(onCommentClick).toHaveBeenCalledWith(baseComment, { top: 28, left: 10 });
  });

  it('installs plugins, removing duplicates and updating state', () => {
    const { result } = renderHook(() =>
      useTiptapSync({ analysisHighlights: [baseHighlight], inlineComments: [] }),
    );

    const duplicateAnalysis = { key: 'analysis-decorations', spec: { key: { key: 'analysis-decorations' } } } as any;
    const otherPlugin = { key: 'other', spec: { key: { key: 'other' } } } as any;
    const editor = buildEditor([duplicateAnalysis, otherPlugin]);

    result.current.installPlugins(editor);

    expect(editor.state.reconfigure).toHaveBeenCalled();
    const newPlugins = (editor.state.reconfigure as any).mock.calls[0][0].plugins;
    expect(newPlugins).toContain(result.current.AnalysisDecorations);
    expect(newPlugins).toContain(result.current.CommentDecorations);
    expect(newPlugins.some(p => p === duplicateAnalysis)).toBe(false);
    expect(editor.view.updateState).toHaveBeenCalledWith({
      plugins: newPlugins,
      marker: 'reconfigured',
    });
  });

  it('refreshDecorations dispatches noop transaction', () => {
    const { result } = renderHook(() =>
      useTiptapSync({ analysisHighlights: [baseHighlight], inlineComments: [] }),
    );
    const editor = buildEditor();

    result.current.refreshDecorations(editor);

    expect(editor.view.dispatch).toHaveBeenCalled();
    const tr = (editor.view.dispatch as any).mock.calls[0][0];
    expect(tr.getMeta('forceDecorationRefresh')).toBe(true);
  });
});

describe('useDebouncedUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces calls and uses latest value', () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedUpdate(cb, 100), {
      initialProps: { cb: callback },
    });

    act(() => {
      result.current('first');
    });
    act(() => {
      result.current('second');
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('second');

    const newCallback = vi.fn();
    rerender({ cb: newCallback });

    act(() => {
      result.current('third');
      vi.advanceTimersByTime(120);
    });
    expect(newCallback).toHaveBeenCalledWith('third');
  });
});

describe('useTiptapSync branch coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getDecorationClass color mapping', () => {
    it('maps severity directly when provided', () => {
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [{ start: 0, end: 5, color: 'anything', severity: 'success' }],
          inlineComments: [],
        }),
      );

      const plugin = result.current.AnalysisDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(20),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations[0].type.attrs.class).toContain('decoration-success');
    });

    it('maps amber/orange colors to warning', () => {
      const colors = ['amber', 'f59e0b', 'orange'];
      for (const color of colors) {
        const { result } = renderHook(() =>
          useTiptapSync({
            analysisHighlights: [{ start: 0, end: 5, color }],
            inlineComments: [],
          }),
        );

        const plugin = result.current.AnalysisDecorations;
        const decos = (plugin.props.decorations as any).call(plugin, {
          doc: makeDoc(20),
        } as any) as any;

        const decorations = decos.find ? decos.find() : [];
        expect(decorations[0].type.attrs.class).toContain('decoration-warning');
      }
    });

    it('maps indigo/blue colors to info', () => {
      const colors = ['indigo', '6366f1', 'blue'];
      for (const color of colors) {
        const { result } = renderHook(() =>
          useTiptapSync({
            analysisHighlights: [{ start: 0, end: 5, color }],
            inlineComments: [],
          }),
        );

        const plugin = result.current.AnalysisDecorations;
        const decos = (plugin.props.decorations as any).call(plugin, {
          doc: makeDoc(20),
        } as any) as any;

        const decorations = decos.find ? decos.find() : [];
        expect(decorations[0].type.attrs.class).toContain('decoration-info');
      }
    });

    it('maps green colors to success', () => {
      const colors = ['green', '22c55e'];
      for (const color of colors) {
        const { result } = renderHook(() =>
          useTiptapSync({
            analysisHighlights: [{ start: 0, end: 5, color }],
            inlineComments: [],
          }),
        );

        const plugin = result.current.AnalysisDecorations;
        const decos = (plugin.props.decorations as any).call(plugin, {
          doc: makeDoc(20),
        } as any) as any;

        const decorations = decos.find ? decos.find() : [];
        expect(decorations[0].type.attrs.class).toContain('decoration-success');
      }
    });

    it('maps gold colors to analysis', () => {
      const colors = ['gold', 'c9a227'];
      for (const color of colors) {
        const { result } = renderHook(() =>
          useTiptapSync({
            analysisHighlights: [{ start: 0, end: 5, color }],
            inlineComments: [],
          }),
        );

        const plugin = result.current.AnalysisDecorations;
        const decos = (plugin.props.decorations as any).call(plugin, {
          doc: makeDoc(20),
        } as any) as any;

        const decorations = decos.find ? decos.find() : [];
        expect(decorations[0].type.attrs.class).toContain('decoration-analysis');
      }
    });

    it('defaults unknown colors to analysis', () => {
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [{ start: 0, end: 5, color: 'purple' }],
          inlineComments: [],
        }),
      );

      const plugin = result.current.AnalysisDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(20),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations[0].type.attrs.class).toContain('decoration-analysis');
    });

    it('uses empty title when not provided', () => {
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [{ start: 0, end: 5, color: 'red' }],
          inlineComments: [],
        }),
      );

      const plugin = result.current.AnalysisDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(20),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations[0].type.attrs.title).toBe('');
    });
  });

  describe('handleClick branches', () => {
    it('returns false when no data-comment-id attribute', () => {
      const onCommentClick = vi.fn();
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [baseComment],
          onCommentClick,
        }),
      );

      const plugin = result.current.CommentDecorations;
      const target = document.createElement('span');
      // No data-comment-id attribute

      const handled = (plugin.props.handleClick as any)?.call(
        plugin as any,
        {} as any,
        0,
        { target } as any,
      );

      expect(handled).toBe(false);
      expect(onCommentClick).not.toHaveBeenCalled();
    });

    it('returns false when comment not found', () => {
      const onCommentClick = vi.fn();
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [baseComment],
          onCommentClick,
        }),
      );

      const plugin = result.current.CommentDecorations;
      const target = document.createElement('span');
      target.setAttribute('data-comment-id', 'nonexistent');

      const handled = (plugin.props.handleClick as any)?.call(
        plugin as any,
        {} as any,
        0,
        { target } as any,
      );

      expect(handled).toBe(false);
      expect(onCommentClick).not.toHaveBeenCalled();
    });

    it('returns false when onClick callback not provided', () => {
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [baseComment],
          // No onCommentClick
        }),
      );

      const plugin = result.current.CommentDecorations;
      const target = document.createElement('span');
      target.setAttribute('data-comment-id', 'c1');
      target.getBoundingClientRect = () => ({ top: 0, left: 10, bottom: 20, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });

      const handled = (plugin.props.handleClick as any)?.call(
        plugin as any,
        {} as any,
        0,
        { target } as any,
      );

      expect(handled).toBe(false);
    });
  });

  describe('comment decorations branches', () => {
    it('skips dismissed comments', () => {
      const dismissedComment: InlineComment = { ...baseComment, dismissed: true };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [dismissedComment],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations).toHaveLength(0);
    });

    it('skips comments with invalid ranges', () => {
      const invalidComment: InlineComment = { ...baseComment, startIndex: 100, endIndex: 200 };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [invalidComment],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations).toHaveLength(0);
    });

    it('skips comments with negative startIndex', () => {
      const negativeStart: InlineComment = { ...baseComment, startIndex: -1 };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [negativeStart],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations).toHaveLength(0);
    });

    it('skips comments with start >= end', () => {
      const equalStartEnd: InlineComment = { ...baseComment, startIndex: 5, endIndex: 5 };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [equalStartEnd],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations).toHaveLength(0);
    });
  });

  describe('editor guards', () => {
    it('refreshDecorations does nothing on destroyed editor', () => {
      const { result } = renderHook(() =>
        useTiptapSync({ analysisHighlights: [], inlineComments: [] }),
      );

      const destroyedEditor = { isDestroyed: true, view: { dispatch: vi.fn() } };
      result.current.refreshDecorations(destroyedEditor);
      expect(destroyedEditor.view.dispatch).not.toHaveBeenCalled();
    });

    it('refreshDecorations does nothing on null editor', () => {
      const { result } = renderHook(() =>
        useTiptapSync({ analysisHighlights: [], inlineComments: [] }),
      );

      // Should not throw
      result.current.refreshDecorations(null);
    });

    it('installPlugins does nothing on destroyed editor', () => {
      const { result } = renderHook(() =>
        useTiptapSync({ analysisHighlights: [], inlineComments: [] }),
      );

      const destroyedEditor = {
        isDestroyed: true,
        state: { reconfigure: vi.fn() },
        view: { updateState: vi.fn() },
      };
      result.current.installPlugins(destroyedEditor);
      expect(destroyedEditor.state.reconfigure).not.toHaveBeenCalled();
    });

    it('installPlugins does nothing on null editor', () => {
      const { result } = renderHook(() =>
        useTiptapSync({ analysisHighlights: [], inlineComments: [] }),
      );

      // Should not throw
      result.current.installPlugins(null);
    });
  });

  describe('getCommentDecorationClass', () => {
    it('generates correct class for error severity', () => {
      const errorComment: InlineComment = { ...baseComment, severity: 'error' };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [errorComment],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations[0].type.attrs.class).toContain('decoration-error');
    });

    it('generates correct class for info severity', () => {
      const infoComment: InlineComment = { ...baseComment, severity: 'info' };
      const { result } = renderHook(() =>
        useTiptapSync({
          analysisHighlights: [],
          inlineComments: [infoComment],
        }),
      );

      const plugin = result.current.CommentDecorations;
      const decos = (plugin.props.decorations as any).call(plugin, {
        doc: makeDoc(10),
      } as any) as any;

      const decorations = decos.find ? decos.find() : [];
      expect(decorations[0].type.attrs.class).toContain('decoration-info');
    });
  });
});
