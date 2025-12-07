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
