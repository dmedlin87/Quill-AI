
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkManager } from '@/services/intelligence/chunkManager';
import { createChunkId } from '@/services/intelligence/chunkIndex';
import { ChunkAnalysis, ManuscriptIntelligence } from '@/types/intelligence';

// Mock dependencies
const mockSubmitJob = vi.fn();
const mockCancelChapterJobs = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/intelligence/workerPool', () => ({
  getWorkerPool: () => ({
    initialize: mockInitialize,
    submitJob: mockSubmitJob,
    cancelChapterJobs: mockCancelChapterJobs,
  }),
}));

// Mock index functions to avoid actual parsing overhead
vi.mock('@/services/intelligence/index', async () => {
  return {
    processManuscriptCached: vi.fn((text) => createMockIntelligence(text)),
    parseStructure: (text: string) => ({
      scenes: [{ startOffset: 0, endOffset: text.length, tension: 0.5, timeMarker: 'now' }],
      paragraphs: [],
      dialogueMap: [],
      stats: { totalWords: text.split(' ').length, dialogueRatio: 0.1 },
      processedAt: Date.now(),
    }),
  };
});

function createMockIntelligence(text: string, tension = 0.5): ManuscriptIntelligence {
  return {
    chapterId: 'mock-id',
    structural: {
      scenes: [{ startOffset: 0, endOffset: text.length, tension, timeMarker: 'now' }],
      stats: { totalWords: text.split(' ').length, dialogueRatio: 0.1 },
    } as any,
    entities: { nodes: [], edges: [] } as any,
    timeline: { promises: [] } as any,
    style: {
      flags: { passiveVoiceRatio: 0, adverbDensity: 0, filterWordDensity: 0 },
      syntax: { avgSentenceLength: 10 },
    } as any,
    heatmap: { sections: [] } as any,
    voice: { profiles: {}, consistencyAlerts: [] } as any,
    delta: {} as any,
    hud: {} as any,
  };
}

describe('ChunkManager Integration & Worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSubmitJob.mockReset();
    mockCancelChapterJobs.mockReset();
    mockInitialize.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes worker pool when useWorker is true', () => {
    new ChunkManager({ useWorker: true });
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('does not initialize worker pool when useWorker is false', () => {
    new ChunkManager({ useWorker: false });
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('dispatches jobs to worker when enabled', async () => {
    const manager = new ChunkManager({
      useWorker: true,
      editDebounceMs: 0,
      processingIntervalMs: 0
    });

    // Setup worker response
    mockSubmitJob.mockImplementation((job, callback) => {
      callback({
        success: true,
        intelligence: createMockIntelligence(job.text),
      });
    });

    manager.registerChapter('ch1', 'Some content');

    // Trigger processing
    await manager.processAllDirty();

    expect(mockSubmitJob).toHaveBeenCalled();
    const jobCall = mockSubmitJob.mock.calls[0][0];
    expect(jobCall.type).toBe('PROCESS_FULL');
    expect(jobCall.text).toBe('Some content');
  });

  it('cancels pending worker jobs on new edits', () => {
    const manager = new ChunkManager({ useWorker: true });

    manager.handleEdit('ch1', 'First draft', 0, 10);

    // Fast forward to trigger debounce but not processing yet
    // Actually handleEdit calls cancelChapterJobs immediately
    expect(mockCancelChapterJobs).toHaveBeenCalledWith('ch1');
  });

  it('aggregates tension correctly (Peak/Min)', async () => {
    // This tests the logic inside aggregateFromChildren which we modified
    const manager = new ChunkManager({ useWorker: false });

    // We need to simulate having processed children with different tensions.
    // The easiest way is to mock the `analyzeTextChunk` or inject data directly into the index.
    // Or we can register a chapter with a custom parseStructure mock for this test,
    // but manipulating the internal index is more direct for testing aggregation logic specifically.

    const index = (manager as any).index;

    // Create a parent chapter chunk
    const parent = index.registerChunk('chapter-1', 'chapter', 0, 100, 'full text', 'book');

    // Create child scenes with specific analysis
    const scene1 = index.registerChunk('chapter-1-scene-1', 'scene', 0, 50, 'part 1', parent.id);
    const scene2 = index.registerChunk('chapter-1-scene-2', 'scene', 50, 100, 'part 2', parent.id);

    // Inject analysis directly
    index.updateAnalysis(scene1.id, {
        wordCount: 100,
        dialogueRatio: 0.1,
        avgTension: 0.2, // Low tension
        characterNames: [],
        locationNames: [],
        timeMarkers: [],
        openPromises: [],
        styleFlags: ['passive'],
        riskScore: 0.1,
        processedAt: Date.now()
    } as ChunkAnalysis);

    index.updateAnalysis(scene2.id, {
        wordCount: 100,
        dialogueRatio: 0.1,
        avgTension: 0.8, // High tension
        characterNames: [],
        locationNames: [],
        timeMarkers: [],
        openPromises: [],
        styleFlags: ['passive'], // Repeated flag
        riskScore: 0.1,
        processedAt: Date.now()
    } as ChunkAnalysis);

    // Force aggregation
    // The manager's aggregateFromChildren is private, but we can call it via casting or triggering `processChunk` on the parent.
    // However, `processChunk` checks if it's a chapter/scene to decide whether to call analyzeTextChunk or aggregate.
    // For 'chapter' level, `processChunk` calls `analyzeTextChunk` (which is for text analysis).
    // Wait, the code says:
    // if (chunk.level === 'scene' || chunk.level === 'chapter') { analyzeTextChunk... } else { aggregateFromChildren... }
    //
    // So 'chapter' is treated as a text chunk, not an aggregate of scenes?
    // Let's check ChunkManager.ts:
    // if (chunk.level === 'scene' || chunk.level === 'chapter') { ... analyzeTextChunk ... }
    //
    // So Chapter chunks are NOT aggregated from scenes in the current logic?
    // Ah, but `aggregateFromChildren` is called for 'book' or 'act'.
    //
    // Let's create an 'act' or 'book' to test aggregation.

    const act = index.registerChunk('act-1', 'act', 0, 0, '', 'book');
    // Re-parent the scenes to the act? No, scenes belong to chapters.
    // So let's reparent the chapter to the act, and give the chapter an analysis.

    // Actually, let's look at `aggregateFromChildren` again. It aggregates children.
    // If I want to test it, I should use a level that uses aggregation.
    // 'book' aggregates chapters.

    // Update parent (chapter) analysis manually
    const chapter1 = parent;
    chapter1.parentId = act.id;
    act.childIds.push(chapter1.id);

    index.updateAnalysis(chapter1.id, {
        wordCount: 200,
        dialogueRatio: 0.1,
        avgTension: 0.5,
        characterNames: [],
        locationNames: [],
        timeMarkers: [],
        openPromises: [],
        styleFlags: [],
        riskScore: 0.1,
        processedAt: Date.now()
    });

    // Let's add another chapter to the act
    const chapter2 = index.registerChunk('chapter-2', 'chapter', 0, 0, '', act.id);
    index.updateAnalysis(chapter2.id, {
        wordCount: 300,
        dialogueRatio: 0.2,
        avgTension: 0.9, // High tension
        characterNames: [],
        locationNames: [],
        timeMarkers: [],
        openPromises: [],
        styleFlags: [],
        riskScore: 0.2,
        processedAt: Date.now()
    });

    // Now process the Act
    await (manager as any).processChunk(act.id);

    const actAnalysis = index.getChunk(act.id)?.analysis;

    expect(actAnalysis).toBeDefined();
    expect(actAnalysis?.summary).toContain('Peak: 9.0');
    expect(actAnalysis?.avgTension).toBeCloseTo(0.7); // (0.5 + 0.9) / 2
  });

  it('handles worker errors gracefully', async () => {
    const manager = new ChunkManager({
      useWorker: true,
      editDebounceMs: 0,
      processingIntervalMs: 0
    });

    mockSubmitJob.mockImplementation((job, callback) => {
      callback({
        success: false,
        error: 'Worker exploded',
      });
    });

    const onErrorSpy = vi.fn();
    (manager as any).onError = onErrorSpy;

    manager.registerChapter('error-ch', 'boom');
    await manager.processAllDirty();

    expect(onErrorSpy).toHaveBeenCalledWith(expect.stringContaining('chapter-error-ch'), 'Worker exploded');
  });
});
