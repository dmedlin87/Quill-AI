import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createChunkId } from '@/services/intelligence/chunkIndex';
import { useChunkIndex, useChunkIndexSync } from '@/features/editor/hooks/useChunkIndex';

const createChunkManagerMock = vi.fn();
let capturedCallbacks: any;
let managerMock: any;

type Stats = {
  totalChunks: number;
  dirtyCount: number;
  freshCount: number;
  processingCount: number;
  errorCount: number;
  byLevel: { scene: number; chapter: number; act: number; book: number };
  isProcessing: boolean;
  chapterCount: number;
};

vi.mock('@/services/intelligence/chunkManager', () => ({
  createChunkManager: (...args: any[]) => createChunkManagerMock(...args),
}));

const buildStats = (overrides: Partial<Stats> = {}): Stats => ({
  totalChunks: 0,
  dirtyCount: 0,
  freshCount: 0,
  processingCount: 0,
  errorCount: 0,
  byLevel: { scene: 0, chapter: 0, act: 0, book: 0 },
  isProcessing: false,
  chapterCount: 0,
  ...overrides,
});

describe('useChunkIndex', () => {
  beforeEach(() => {
    capturedCallbacks = {};
    managerMock = {
      getStats: vi.fn(() => buildStats()),
      registerChapter: vi.fn(),
      handleEdit: vi.fn(),
      getChunk: vi.fn(),
      getChapterChunk: vi.fn(),
      getAnalysisAtCursor: vi.fn(),
      getAggregate: vi.fn(),
      getBookSummary: vi.fn(),
      getAllChapterAnalyses: vi.fn(),
      processAllDirty: vi.fn(),
      reprocessChunk: vi.fn(),
      retryErrors: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };

    createChunkManagerMock.mockImplementation((_config, callbacks) => {
      capturedCallbacks = callbacks;
      return managerMock;
    });
  });

  it('captures lifecycle callbacks to update processing and queue state', async () => {
    const { result, unmount } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    act(() => capturedCallbacks.onProcessingStart?.());
    expect(result.current.state.isProcessing).toBe(true);

    act(() => capturedCallbacks.onQueueChange?.(3));
    expect(result.current.state.dirtyCount).toBe(3);

    act(() => capturedCallbacks.onProcessingEnd?.());
    expect(result.current.state.isProcessing).toBe(false);

    unmount();
    expect(managerMock.destroy).toHaveBeenCalled();
  });

  it('clears state and delegates to manager clear', async () => {
    managerMock.getStats.mockReturnValueOnce(buildStats({ totalChunks: 2, dirtyCount: 1 }));

    const { result } = renderHook(() => useChunkIndex());

    act(() => {
      result.current.registerChapter('chapter-1', 'Once upon a time');
    });

    expect(result.current.state.totalChunks).toBe(2);
    expect(result.current.state.dirtyCount).toBe(1);

    act(() => {
      result.current.clear();
    });

    expect(managerMock.clear).toHaveBeenCalled();
    expect(result.current.state).toEqual({
      isProcessing: false,
      dirtyCount: 0,
      totalChunks: 0,
      lastError: null,
    });
  });
});

describe('useChunkIndexSync', () => {
  let chunkIndexMock: any;

  beforeEach(() => {
    chunkIndexMock = {
      registerChapter: vi.fn(),
      handleEdit: vi.fn(),
      getChunk: vi.fn((chunkId: string) => ({ id: chunkId, content: `content:${chunkId}` })),
      getAnalysisAtCursor: vi.fn(() => ({ summary: 'analysis' })),
    };
  });

  it('registers chapters, handles edits, and exposes chunk analysis', async () => {
    const { result, rerender } = renderHook(
      ({ chapterId, content, cursorOffset }) =>
        useChunkIndexSync(chapterId, content, cursorOffset, chunkIndexMock),
      {
        initialProps: {
          chapterId: 'ch1',
          content: 'Hello world',
          cursorOffset: 0,
        },
      }
    );

    await waitFor(() =>
      expect(chunkIndexMock.registerChapter).toHaveBeenCalledWith('ch1', 'Hello world')
    );
    expect(chunkIndexMock.registerChapter).toHaveBeenCalledTimes(1);
    expect(result.current.currentChunk).toEqual({
      id: createChunkId('chapter', 'ch1'),
      content: `content:${createChunkId('chapter', 'ch1')}`,
    });
    expect(result.current.currentAnalysis).toEqual({ summary: 'analysis' });

    act(() => {
      rerender({ chapterId: 'ch1', content: 'Hello brave world', cursorOffset: 5 });
    });

    await waitFor(() =>
      expect(chunkIndexMock.handleEdit).toHaveBeenCalledWith('ch1', 'Hello brave world', 6, 6)
    );

    act(() => {
      rerender({ chapterId: 'ch2', content: 'New chapter text', cursorOffset: 2 });
    });

    await waitFor(() =>
      expect(chunkIndexMock.registerChapter).toHaveBeenCalledWith('ch2', 'New chapter text')
    );
    expect(chunkIndexMock.registerChapter).toHaveBeenCalledTimes(2);
    expect(result.current.currentChunk).toEqual({
      id: createChunkId('chapter', 'ch2'),
      content: `content:${createChunkId('chapter', 'ch2')}`,
    });
  });

  it('returns undefined/null when chapterId is null', () => {
    const { result } = renderHook(
      ({ chapterId, content, cursorOffset }) =>
        useChunkIndexSync(chapterId, content, cursorOffset, chunkIndexMock),
      {
        initialProps: {
          chapterId: null as string | null,
          content: 'Hello world',
          cursorOffset: 0,
        },
      }
    );

    expect(result.current.currentChunk).toBeUndefined();
    expect(result.current.currentAnalysis).toBeNull();
    expect(chunkIndexMock.registerChapter).not.toHaveBeenCalled();
  });

  it('does not call handleEdit when content unchanged', async () => {
    const { rerender } = renderHook(
      ({ chapterId, content, cursorOffset }) =>
        useChunkIndexSync(chapterId, content, cursorOffset, chunkIndexMock),
      {
        initialProps: {
          chapterId: 'ch1',
          content: 'Hello world',
          cursorOffset: 0,
        },
      }
    );

    await waitFor(() =>
      expect(chunkIndexMock.registerChapter).toHaveBeenCalledWith('ch1', 'Hello world')
    );

    // Rerender with same content
    act(() => {
      rerender({ chapterId: 'ch1', content: 'Hello world', cursorOffset: 5 });
    });

    // handleEdit should not be called for unchanged content
    expect(chunkIndexMock.handleEdit).not.toHaveBeenCalled();
  });
});

describe('useChunkIndex branch coverage', () => {
  beforeEach(() => {
    capturedCallbacks = {};
    managerMock = {
      getStats: vi.fn(() => buildStats()),
      registerChapter: vi.fn(),
      handleEdit: vi.fn(),
      getChunk: vi.fn(),
      getChapterChunk: vi.fn(),
      getAnalysisAtCursor: vi.fn(),
      getAggregate: vi.fn(),
      getBookSummary: vi.fn(),
      getAllChapterAnalyses: vi.fn(() => new Map()),
      processAllDirty: vi.fn(),
      reprocessChunk: vi.fn(),
      retryErrors: vi.fn(() => ['id1', 'id2']),
      pause: vi.fn(),
      resume: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
    };

    createChunkManagerMock.mockImplementation((_config, callbacks) => {
      capturedCallbacks = callbacks;
      return managerMock;
    });
  });

  it('calls onChunkProcessed callback and updates stats', async () => {
    managerMock.getStats.mockReturnValue(buildStats({ totalChunks: 5, dirtyCount: 2 }));

    const { result } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    act(() => capturedCallbacks.onChunkProcessed?.('chunk-1'));

    expect(result.current.state.totalChunks).toBe(5);
    expect(result.current.state.dirtyCount).toBe(2);
  });

  it('calls onError callback and updates lastError', async () => {
    const { result } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    act(() => capturedCallbacks.onError?.('chunk-1', 'Something went wrong'));

    expect(result.current.state.lastError).toBe('Something went wrong');
  });

  it('delegates to manager methods correctly', async () => {
    const { result } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    // Test all delegated methods
    act(() => {
      result.current.handleEdit('ch1', 'new text', 0, 5);
    });
    expect(managerMock.handleEdit).toHaveBeenCalledWith('ch1', 'new text', 0, 5);

    result.current.getChunk('chunk-1' as any);
    expect(managerMock.getChunk).toHaveBeenCalledWith('chunk-1');

    result.current.getChapterChunk('ch1');
    expect(managerMock.getChapterChunk).toHaveBeenCalledWith('ch1');

    result.current.getAnalysisAtCursor('ch1', 10);
    expect(managerMock.getAnalysisAtCursor).toHaveBeenCalledWith('ch1', 10);

    result.current.getAggregate('agg-1' as any);
    expect(managerMock.getAggregate).toHaveBeenCalledWith('agg-1');

    result.current.getBookSummary();
    expect(managerMock.getBookSummary).toHaveBeenCalled();

    const analyses = result.current.getAllChapterAnalyses();
    expect(managerMock.getAllChapterAnalyses).toHaveBeenCalled();
    expect(analyses).toBeInstanceOf(Map);

    await act(async () => {
      await result.current.processAllDirty();
    });
    expect(managerMock.processAllDirty).toHaveBeenCalled();

    await act(async () => {
      await result.current.reprocessChunk('chunk-1' as any);
    });
    expect(managerMock.reprocessChunk).toHaveBeenCalledWith('chunk-1');

    const retried = result.current.retryErrors();
    expect(managerMock.retryErrors).toHaveBeenCalled();
    expect(retried).toEqual(['id1', 'id2']);

    result.current.pause();
    expect(managerMock.pause).toHaveBeenCalled();

    result.current.resume();
    expect(managerMock.resume).toHaveBeenCalled();
  });

  it('returns default stats when manager getStats returns undefined', async () => {
    // Test fallback when getStats returns nothing
    managerMock.getStats.mockReturnValue(undefined);

    const { result, unmount } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    // Temporarily make getStats return undefined
    managerMock.getStats.mockReturnValueOnce(undefined);
    const stats = result.current.getStats();
    
    // Should return the fallback default stats
    expect(stats).toEqual({
      totalChunks: 0,
      dirtyCount: 0,
      freshCount: 0,
      processingCount: 0,
      errorCount: 0,
      byLevel: { scene: 0, chapter: 0, act: 0, book: 0 },
      isProcessing: false,
      chapterCount: 0,
    });

    unmount();
  });

  it('returns empty array from retryErrors when manager retryErrors returns undefined', async () => {
    managerMock.retryErrors.mockReturnValueOnce(undefined);

    const { result, unmount } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    // Temporarily make retryErrors return undefined
    managerMock.retryErrors.mockReturnValueOnce(undefined);
    const retried = result.current.retryErrors();
    expect(retried).toEqual([]);

    unmount();
  });

  it('returns empty map from getAllChapterAnalyses when manager returns undefined', async () => {
    managerMock.getAllChapterAnalyses.mockReturnValueOnce(undefined);

    const { result, unmount } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    // Temporarily make getAllChapterAnalyses return undefined
    managerMock.getAllChapterAnalyses.mockReturnValueOnce(undefined);
    const analyses = result.current.getAllChapterAnalyses();
    expect(analyses).toBeInstanceOf(Map);
    expect(analyses.size).toBe(0);

    unmount();
  });

  it('returns null from getAnalysisAtCursor when manager returns nothing', async () => {
    managerMock.getAnalysisAtCursor.mockReturnValue(undefined);

    const { result } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    const analysis = result.current.getAnalysisAtCursor('ch1', 10);
    expect(analysis).toBeNull();
  });

  it('handles methods returning undefined gracefully', async () => {
    // Set up manager to return undefined for various methods
    managerMock.getChunk.mockReturnValue(undefined);
    managerMock.getChapterChunk.mockReturnValue(undefined);
    managerMock.getAggregate.mockReturnValue(undefined);
    managerMock.getBookSummary.mockReturnValue(undefined);

    const { result, unmount } = renderHook(() => useChunkIndex());

    await waitFor(() => expect(createChunkManagerMock).toHaveBeenCalled());

    expect(result.current.getChunk('chunk-1' as any)).toBeUndefined();
    expect(result.current.getChapterChunk('ch1')).toBeUndefined();
    expect(result.current.getAggregate('agg-1' as any)).toBeUndefined();
    expect(result.current.getBookSummary()).toBeUndefined();

    unmount();
  });
});
