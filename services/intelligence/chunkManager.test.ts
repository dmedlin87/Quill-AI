import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChunkManager } from './chunkManager';

// Mock the intelligence entry point used inside the manager
vi.mock('./index', () => {
  const parseStructure = (text: string) => ({
    scenes: [
      {
        id: 'scene-0',
        startOffset: 0,
        endOffset: text.length,
        tension: 0.5,
        timeMarker: null,
      },
    ],
    paragraphs: [],
    dialogueMap: {},
    acts: [],
    sections: [],
    arcs: [],
    outline: [],
    highlights: [],
    stats: {
      totalWords: text.split(/\s+/).filter(Boolean).length,
      dialogueRatio: 0,
      totalParagraphs: 0,
      totalScenes: 1,
      avgSentenceLength: 0,
      readability: 0,
    },
    fingerprints: {
      sentenceLengths: [],
      structureEntropy: 0,
    },
  });

  const baseManuscript = (text: string) => ({
    structural: parseStructure(text),
    entities: { nodes: [], edges: [] },
    style: {
      flags: { passiveVoiceRatio: 0, adverbDensity: 0, filterWordDensity: 0 },
      syntax: { avgSentenceLength: 10, sentenceComplexity: 0, variety: 0, pacingScore: 0 },
      metrics: { readability: 0, rhythmScore: 0 },
    },
    heatmap: { sections: [] },
    timeline: { events: [], promises: [] },
    cache: { hash: '', timestamp: Date.now() },
    voices: [],
    context: '',
  });

  return {
    parseStructure,
    processManuscriptCached: vi.fn((text: string) => baseManuscript(text)),
  };
});

const { processManuscriptCached } = await import('./index');

type ChunkManagerTestView = {
  index: {
    applyEdit: (range: unknown, text: string) => void;
    registerScenesForChapter: (...args: unknown[]) => void;
    hasDirtyChunks: (...args: unknown[]) => boolean;
  };
  scheduleProcessing: () => void;
  editDebounceTimer: ReturnType<typeof setTimeout> | null;
  processingTimer: ReturnType<typeof setTimeout> | null;
  pendingEditRange: unknown | null;
};

describe('ChunkManager handleEdit/applyEdit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('coalesces rapid edits, restarts debounce, and schedules processing once', () => {
    const callbacks = {
      onProcessingStart: vi.fn(),
      onProcessingEnd: vi.fn(),
      onChunkProcessed: vi.fn(),
      onError: vi.fn(),
      onQueueChange: vi.fn(),
    };

    const manager = new ChunkManager(
      { editDebounceMs: 20, idleThresholdMs: 0, processingIntervalMs: 0, maxBatchSize: 1, useWorker: false },
      callbacks
    );

    const mockIndex = {
      applyEdit: vi.fn(),
      registerScenesForChapter: vi.fn(),
      hasDirtyChunks: vi.fn().mockReturnValue(true),
    };

    const managerView = manager as unknown as ChunkManagerTestView;

    // Replace the internal index to isolate handleEdit/applyEdit behavior
    managerView.index = mockIndex;

    const scheduleSpy = vi
      .spyOn(manager as unknown as { scheduleProcessing: () => void }, 'scheduleProcessing')
      .mockImplementation(() => undefined);

    // Clear any timers created during construction
    vi.clearAllTimers();

    manager.handleEdit('chapter-1', 'First draft', 0, 5);
    const initialDebounce = managerView.editDebounceTimer;

    manager.handleEdit('chapter-1', 'Revised draft', 4, 9);
    const restartedDebounce = managerView.editDebounceTimer;

    // Debounce timer should restart
    expect(restartedDebounce).not.toBe(initialDebounce);

    // Apply edit after debounce period
    vi.advanceTimersByTime(25);

    expect(mockIndex.applyEdit).toHaveBeenCalledTimes(1);
    const editArgs = mockIndex.applyEdit.mock.calls[0];
    expect(editArgs[0]).toMatchObject({ start: 0, end: 9, chapterId: 'chapter-1' });

    expect(scheduleSpy).toHaveBeenCalledTimes(1);

    // processingTimer should be cleared if it existed when edit arrived
    const manualProcessingTimer = setTimeout(() => undefined, 1000);
    (manager as unknown as { processingTimer: ReturnType<typeof setTimeout> | null }).processingTimer = manualProcessingTimer;
    manager.handleEdit('chapter-1', 'Final draft', 2, 3);
    expect(managerView.processingTimer).toBeNull();

    vi.advanceTimersByTime(25);

    // pendingEditRange resets after apply
    expect(managerView.pendingEditRange).toBeNull();
  });
});

describe('ChunkManager processing callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callbacks for successful processing and error scenarios', async () => {
    const callbacks = {
      onProcessingStart: vi.fn(),
      onProcessingEnd: vi.fn(),
      onChunkProcessed: vi.fn(),
      onError: vi.fn(),
      onQueueChange: vi.fn(),
    };

    const manager = new ChunkManager(
      { editDebounceMs: 0, idleThresholdMs: 0, processingIntervalMs: 0, maxBatchSize: 5, useWorker: false },
      callbacks
    );

    // Make the mocked processor throw for the scene chunk to trigger onError
    vi.mocked(processManuscriptCached).mockImplementationOnce(() => {
      throw new Error('analysis failure');
    });

    // Register chapter to populate chunks and queue
    manager.registerChapter('1', 'Hello world');

    // Allow scheduled processing to run
    await vi.runAllTimersAsync();

    expect(callbacks.onProcessingStart).toHaveBeenCalled();
    expect(callbacks.onProcessingEnd).toHaveBeenCalled();
    expect(callbacks.onQueueChange).toHaveBeenCalled();

    // One chunk should fail, others succeed
    expect(callbacks.onError).toHaveBeenCalled();
    expect(callbacks.onChunkProcessed).toHaveBeenCalled();

    // processingTimer should be cleared after processing completes
    expect((manager as unknown as ChunkManagerTestView).processingTimer).toBeNull();
    // Debounce timer should not persist
    expect((manager as unknown as ChunkManagerTestView).editDebounceTimer).toBeNull();
  });
});
