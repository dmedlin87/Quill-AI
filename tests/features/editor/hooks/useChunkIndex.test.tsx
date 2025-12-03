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
});
