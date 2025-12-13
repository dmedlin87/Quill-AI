/**
 * ChunkManager tests focused on branch coverage of edge cases and aggregations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkManager } from '@/services/intelligence/chunkManager';
import type { ChunkManagerConfig } from '@/services/intelligence/chunkManager';
import { ChunkAnalysis, ManuscriptIntelligence } from '@/types/intelligence';
import { createChunkId } from '@/services/intelligence/chunkIndex';

const parseStructureMock = vi.fn();
const processManuscriptCachedMock = vi.fn();
const workerPoolMock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  submitJob: vi.fn(),
  cancelChapterJobs: vi.fn(),
};

vi.mock('@/services/intelligence/index', async () => {
  const actual = await vi.importActual('@/services/intelligence/index');
  return {
    ...actual,
    parseStructure: (...args: any[]) => parseStructureMock(...args),
    processManuscriptCached: (...args: any[]) => processManuscriptCachedMock(...args),
  };
});

vi.mock('@/services/intelligence/workerPool', () => ({
  getWorkerPool: () => workerPoolMock,
}));

const createStructureStub = (text: string) => {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const scenes = trimmed.length > 0 ? [{
    id: 'scene-0',
    startOffset: 0,
    endOffset: text.length,
    type: 'dialogue',
    pov: 'POV',
    location: 'Location',
    timeMarker: 'now',
    tension: 0.5,
    dialogueRatio: 0.4,
  }] : [];

  return {
    scenes,
    paragraphs: [],
    dialogueMap: [],
    stats: {
      totalWords: words,
      totalSentences: Math.max(1, words),
      totalParagraphs: scenes.length,
      avgSentenceLength: scenes.length > 0 ? Math.max(1, words) : 0,
      sentenceLengthVariance: 0,
      dialogueRatio: 0.4,
      sceneCount: scenes.length,
      povShifts: 0,
      avgSceneLength: scenes.length > 0 ? text.length : 0,
    },
    processedAt: 1,
  };
};

const createIntelStub = (text: string): ManuscriptIntelligence => ({
  structural: createStructureStub(text) as any,
  entities: createEntitiesStub(['Alice'], ['Town']) as any,
  style: createStyleStub() as any,
  heatmap: { sections: [{ overallRisk: 0.1 }] } as any,
  timeline: createTimelineStub(['promise']) as any,
  hud: null as any,
  processedAt: 1,
});

const createEntitiesStub = (characters: string[], locations: string[]) => ({
  nodes: [
    ...characters.map(name => ({
      id: `char-${name}`,
      name,
      type: 'character',
      aliases: [],
      firstMention: 0,
      mentionCount: 1,
      mentions: [{ offset: 0, chapterId: 'chapter-stub' }],
      attributes: {},
    })),
    ...locations.map(name => ({
      id: `loc-${name}`,
      name,
      type: 'location',
      aliases: [],
      firstMention: 0,
      mentionCount: 1,
      mentions: [{ offset: 0, chapterId: 'chapter-stub' }],
      attributes: {},
    })),
  ],
  edges: [],
  processedAt: 1,
});

const createTimelineStub = (promises: string[] = ['promise']) => ({
  events: [],
  causalChains: [],
  promises: promises.map(desc => ({
    id: `promise-${desc}`,
    type: 'goal',
    description: desc,
    quote: '',
    offset: 0,
    chapterId: 'chapter-stub',
    resolved: false,
  })),
  processedAt: 1,
});

const createStyleStub = (options: {
  passiveVoiceRatio?: number;
  adverbDensity?: number;
  filterWordDensity?: number;
  avgSentenceLength?: number;
 } = {}) => ({
  vocabulary: {
    uniqueWords: 0,
    totalWords: 0,
    avgWordLength: 0,
    lexicalDiversity: 0,
    topWords: [],
    overusedWords: [],
    rareWords: [],
  },
  syntax: {
    avgSentenceLength: options.avgSentenceLength ?? 10,
    sentenceLengthVariance: 0,
    minSentenceLength: 0,
    maxSentenceLength: 0,
    paragraphLengthAvg: 0,
    dialogueToNarrativeRatio: 0,
    questionRatio: 0,
    exclamationRatio: 0,
  },
  rhythm: {
    syllablePattern: [],
    punctuationDensity: 0,
    avgClauseCount: 0,
  },
  flags: {
    passiveVoiceRatio: options.passiveVoiceRatio ?? 0,
    passiveVoiceInstances: [],
    adverbDensity: options.adverbDensity ?? 0,
    adverbInstances: [],
    filterWordDensity: options.filterWordDensity ?? 0,
    filterWordInstances: [],
    clicheCount: 0,
    clicheInstances: [],
    repeatedPhrases: [],
  },
  processedAt: 1,
});

const createHeatmapStub = (risk = 0.2) => ({
  sections: [{
    offset: 0,
    length: 1,
    scores: {
      plotRisk: 0,
      pacingRisk: 0,
      characterRisk: 0,
      settingRisk: 0,
      styleRisk: 0,
    },
    overallRisk: risk,
    flags: [],
    suggestions: [],
  }],
  hotspots: [],
  processedAt: 1,
});

const createDeltaStub = () => ({
  changedRanges: [],
  invalidatedSections: [],
  affectedEntities: [],
  newPromises: [],
  resolvedPromises: [],
  contentHash: '',
  processedAt: 1,
});

const createHudStub = () => ({
  situational: {
    currentScene: null,
    currentParagraph: null,
    narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
    tensionLevel: 'medium',
    pacing: 'moderate',
  },
  context: {
    activeEntities: [],
    activeRelationships: [],
    openPromises: [],
    recentEvents: [],
  },
  styleAlerts: [],
  prioritizedIssues: [],
  recentChanges: [],
  stats: { wordCount: 0, readingTime: 0, dialoguePercent: 0, avgSentenceLength: 0 },
  lastFullProcess: 1,
  processingTier: 'stale',
});

const createIntelligenceStub = (
  text: string,
  options?: {
    risk?: number;
    characters?: string[];
    locations?: string[];
    promises?: string[];
    style?: {
      passiveVoiceRatio?: number;
      adverbDensity?: number;
      filterWordDensity?: number;
      avgSentenceLength?: number;
    };
  }
): ManuscriptIntelligence => ({
  chapterId: 'chapter-stub',
  structural: createStructureStub(text),
  entities: createEntitiesStub(options?.characters ?? ['Hero'], options?.locations ?? ['Mars']),
  timeline: createTimelineStub(options?.promises),
  style: createStyleStub(options?.style),
  voice: { profiles: {}, consistencyAlerts: [] },
  heatmap: createHeatmapStub(options?.risk ?? 0.2),
  delta: createDeltaStub(),
  hud: createHudStub(),
}) as ManuscriptIntelligence;

const createManager = (config: Partial<ChunkManagerConfig> = {}) =>
  new ChunkManager({
    editDebounceMs: 0,
    processingIntervalMs: 0,
    idleThresholdMs: 0,
    ...config,
  });

beforeEach(() => {
  parseStructureMock.mockReset();
  parseStructureMock.mockImplementation((text: string) => createStructureStub(text));
  processManuscriptCachedMock.mockReset();
  processManuscriptCachedMock.mockImplementation((text: string) => createIntelligenceStub(text));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChunkManager edge cases', () => {
  it('handles chapter and scene text retrieval edge cases', () => {
    const manager = createManager() as any;
    const index = manager.index as any;

    // Chapter text missing
    const chapter = index.registerChunk('chapter-ch1', 'chapter', 0, 5, '', 'book');
    expect(manager.getChunkText(chapter)).toBeNull();

    // Chapter with invalid range
    manager.chapterTexts.set('ch2', 'hello world');
    const invalidChapter = index.registerChunk('chapter-ch2', 'chapter', -1, 3, '', 'book');
    expect(manager.getChunkText(invalidChapter)).toBeNull();

    // Scene exactly on chapter boundary returns full text
    manager.chapterTexts.set('boundary', '0123456789');
    const boundaryParent = index.registerChunk('chapter-boundary', 'chapter', 0, 10, '', 'book');
    const boundaryScene = index.registerChunk('chapter-boundary-scene-0', 'scene', 0, 10, '', boundaryParent.id);
    expect(manager.getChunkText(boundaryScene)).toBe('0123456789');

    // Scene slices valid content
    manager.chapterTexts.set('ch3', 'abcdefghij');
    const parent = index.registerChunk('chapter-ch3', 'chapter', 0, 10, '', 'book');
    const scene = index.registerChunk('chapter-ch3-scene-0', 'scene', 2, 6, '', parent.id);
    expect(manager.getChunkText(scene)).toBe('cdef');

    // Scene with out-of-bounds indices
    const badScene = index.registerChunk('chapter-ch3-scene-1', 'scene', 8, 20, '', parent.id);
    expect(manager.getChunkText(badScene)).toBeNull();
  });

  it('aggregates children with and without analysis data', () => {
    const manager = createManager() as any;
    const index = manager.index as any;

    const parent = index.registerChunk('chapter-parent', 'chapter', 0, 0, '', 'book');
    const emptyAggregate = manager.aggregateFromChildren(parent) as ChunkAnalysis;
    expect(emptyAggregate.summary).toBe('No data');
    expect(emptyAggregate.wordCount).toBe(0);

    const childA = index.registerChunk('chapter-parent-scene-0', 'scene', 0, 5, '', parent.id);
    const childB = index.registerChunk('chapter-parent-scene-1', 'scene', 5, 10, '', parent.id);

    const analysisA: ChunkAnalysis = {
      summary: 'first',
      wordCount: 100,
      dialogueRatio: 0.3,
      avgTension: 0.4,
      characterNames: ['Alice'],
      locationNames: ['Paris'],
      timeMarkers: ['dawn'],
      openPromises: ['mystery'],
      styleFlags: ['flag-a'],
      riskScore: 0.2,
      structural: null as any,
      entities: null as any,
      style: null as any,
      processedAt: 1,
    };

    const analysisB: ChunkAnalysis = {
      ...analysisA,
      summary: 'second',
      wordCount: 50,
      dialogueRatio: 0.5,
      avgTension: 0.8,
      characterNames: ['Bob'],
      locationNames: ['Paris'],
      timeMarkers: ['dusk'],
      openPromises: ['mystery', 'foreshadow'],
      styleFlags: ['flag-b'],
      riskScore: 0.6,
      processedAt: 2,
    };

    index.updateAnalysis(childA.id, analysisA);
    index.updateAnalysis(childB.id, analysisB);

    const aggregate = manager.aggregateFromChildren(parent) as ChunkAnalysis;
    expect(aggregate.summary).toContain('150 words');
    expect(aggregate.dialogueRatio).toBeCloseTo((0.3 + 0.5) / 2);
    expect(aggregate.avgTension).toBeCloseTo((0.4 + 0.8) / 2);
    expect(new Set(aggregate.characterNames)).toEqual(new Set(['Alice', 'Bob']));
    expect(new Set(aggregate.locationNames)).toEqual(new Set(['Paris']));
    expect(new Set(aggregate.timeMarkers)).toEqual(new Set(['dawn', 'dusk']));
    expect(new Set(aggregate.openPromises)).toEqual(new Set(['mystery', 'foreshadow']));
    expect(new Set(aggregate.styleFlags)).toEqual(new Set(['flag-a', 'flag-b']));
    expect(aggregate.riskScore).toBeCloseTo((0.2 + 0.6) / 2);
  });

  it('converts ManuscriptIntelligence to ChunkAnalysis with style flag branches', () => {
    const manager = createManager() as any;

    const intelligenceHigh = {
      structural: {
        scenes: [
          { tension: 0.9, timeMarker: 'dawn' },
          { tension: 0.6, timeMarker: null },
        ],
        stats: { totalWords: 120, dialogueRatio: 0.4 },
      },
      entities: {
        nodes: [
          { type: 'character', name: 'Eve' },
          { type: 'location', name: 'Venice' },
        ],
      },
      timeline: {
        promises: [
          { description: 'Resolve mystery', resolved: false },
          { description: 'Closed loop', resolved: true },
        ],
      },
      style: {
        flags: {
          passiveVoiceRatio: 0.2,
          adverbDensity: 0.06,
          filterWordDensity: 0.04,
        },
        syntax: { avgSentenceLength: 35 },
      },
      heatmap: { sections: [{ overallRisk: 0.8 }, { overallRisk: 0.4 }] },
    } as unknown as ManuscriptIntelligence;

    const analysisHigh = manager.intelligenceToChunkAnalysis(intelligenceHigh) as ChunkAnalysis;
    expect(analysisHigh.styleFlags).toEqual([
      'passive_voice_heavy',
      'adverb_overuse',
      'filter_words',
      'long_sentences',
    ]);
    expect(analysisHigh.riskScore).toBeCloseTo(0.6);
    expect(analysisHigh.openPromises).toEqual(['Resolve mystery']);
    expect(analysisHigh.locationNames).toEqual(['Venice']);

    const intelligenceLow = {
      structural: {
        scenes: [{ tension: 0.2, timeMarker: 'noon' }],
        stats: { totalWords: 20, dialogueRatio: 0 },
      },
      entities: { nodes: [] },
      timeline: { promises: [] },
      style: {
        flags: { passiveVoiceRatio: 0, adverbDensity: 0, filterWordDensity: 0 },
        syntax: { avgSentenceLength: 5 },
      },
      heatmap: { sections: [] },
    } as unknown as ManuscriptIntelligence;

    const analysisLow = manager.intelligenceToChunkAnalysis(intelligenceLow) as ChunkAnalysis;
    expect(analysisLow.styleFlags).toEqual(['short_sentences']);
    expect(analysisLow.timeMarkers).toEqual(['noon']);
  });
});

describe('ChunkManager processing and persistence flows', () => {
  it('defers batch processing when edits keep coming', async () => {
    vi.useFakeTimers();
    const manager = createManager({
      idleThresholdMs: 1000,
      maxBatchSize: 1,
      processingIntervalMs: 0,
    });

    manager.registerChapter('edit-ch', 'steady text');
    (manager as any).lastEditTime = Date.now();
    const processSpy = vi.spyOn(manager as any, 'processChunk');

    await manager.processNextBatch();

    expect(processSpy).not.toHaveBeenCalled();
    expect(manager.getStats().dirtyCount).toBeGreaterThan(0);
    expect(processManuscriptCachedMock).not.toHaveBeenCalled();

    processSpy.mockRestore();
    manager.pause();
  });

  it('emits errors when chunk text cannot be loaded', async () => {
    const errors: Array<{ chunkId: string; error: string }> = [];
    const manager = new ChunkManager(
      { editDebounceMs: 0, processingIntervalMs: 0, idleThresholdMs: 0 },
      {
        onError: (chunkId, error) => errors.push({ chunkId, error }),
      }
    );

    manager.registerChapter('missing-text', 'alpha bravo');
    manager.chapterTexts.delete('missing-text');

    await manager.processAllDirty();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].error).toBe('Could not retrieve chunk text (invalid range or missing chapter)');
    expect(processManuscriptCachedMock).not.toHaveBeenCalled();
  });

  it('handles edits that shrink and greatly expand chapter text around chunk boundaries', async () => {
    vi.useFakeTimers();

    const manager = createManager({ editDebounceMs: 0, processingIntervalMs: 0, idleThresholdMs: 0 });

    // Start with a moderate-length chapter registered through the normal path
    manager.registerChapter('resize-ch', 'abcdefghij');
    const initialChunk = manager.getChapterChunk('resize-ch');
    expect(initialChunk?.endIndex).toBe(10);

    // Apply an edit that shrinks the chapter so text is shorter than the original chunk length
    manager.handleEdit('resize-ch', 'abc', 0, 10);
    await vi.runAllTimersAsync();

    const shrunkChunk = manager.getChapterChunk('resize-ch');
    expect(shrunkChunk?.endIndex).toBe(3);
    expect((manager as any).chapterTexts.get('resize-ch')).toBe('abc');

    // Now grow the chapter to an extremely large size to ensure processing and indexing stay stable
    const largeText = 'Alpha beta gamma '.repeat(4000); // reasonably large but safe for tests
    manager.handleEdit('resize-ch', largeText, 0, 3);
    await vi.runAllTimersAsync();

    const grownChunk = manager.getChapterChunk('resize-ch');
    expect(grownChunk?.endIndex).toBe(largeText.length);
    expect((manager as any).chapterTexts.get('resize-ch')?.length).toBe(largeText.length);

    vi.useRealTimers();
  });

  it('exercises persistence, manual controls, and stats helpers', async () => {
    const processed: Array<[string, ChunkAnalysis]> = [];
    const manager = new ChunkManager(
      { editDebounceMs: 0, processingIntervalMs: 0, idleThresholdMs: 0 },
      {
        onChunkProcessed: (chunkId, analysis) => processed.push([chunkId, analysis]),
      }
    );

    manager.registerChapter('persist-chap', 'alpha beta gamma');
    await manager.processAllDirty();

    expect(processed.length).toBeGreaterThan(0);
    expect(manager.getChapterChunk('persist-chap')).toBeDefined();
    expect(manager.getAnalysisAtCursor('persist-chap', 1)).not.toBeNull();
    expect(manager.getAllChapterAnalyses().has('persist-chap')).toBe(true);
    expect(manager.getBookSummary()).toBeDefined();

    const stats = manager.getStats();
    expect(stats.chapterCount).toBeGreaterThan(0);
    expect(stats.isProcessing).toBe(false);

    const state = manager.exportState();
    expect(state.chapterTexts).toHaveProperty('persist-chap');

    const freshManager = createManager();
    freshManager.loadState(state);
    expect(freshManager.getChapterChunk('persist-chap')).toBeDefined();

    manager.removeChapter('persist-chap');
    expect(manager.getChapterChunk('persist-chap')).toBeUndefined();

    manager.registerChapter('retry-chap', 'delta epsilon');
    const retryChunkId = createChunkId('chapter', 'retry-chap');
    const retryChunk = manager.getChunk(retryChunkId);
    expect(retryChunk).toBeDefined();
    if (retryChunk) {
      retryChunk.status = 'error';
    }

    const retriedIds = manager.retryErrors();
    expect(retriedIds).toContain(retryChunkId);
    expect(retryChunk?.status).toBe('dirty');

    const processSpy = vi.spyOn(manager as any, 'processChunk');
    await manager.reprocessChunk(retryChunkId);
    expect(processSpy).toHaveBeenCalledWith(retryChunkId);
    processSpy.mockRestore();

    manager.pause();
    (manager as any).index.markDirty(retryChunkId);
    const scheduleSpy = vi.spyOn(manager as any, 'scheduleProcessing');
    manager.resume();
    expect(scheduleSpy).toHaveBeenCalled();
    scheduleSpy.mockRestore();

    manager.clear();
    expect(manager.getStats().chapterCount).toBe(0);
    expect(manager.getChunk('book')).toBeUndefined();

    manager.destroy();
    expect((manager as any).isDestroyed).toBe(true);
  });
});

describe('ChunkManager worker + error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseStructureMock.mockImplementation((text: string) => createStructureStub(text));
    processManuscriptCachedMock.mockImplementation((text: string) => createIntelStub(text));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels worker jobs when removing a chapter in worker mode', () => {
    const manager = new ChunkManager({ useWorker: true });
    manager.removeChapter('chap-x');
    expect(workerPoolMock.cancelChapterJobs).toHaveBeenCalledWith('chap-x');
    manager.destroy();
  });

  it('reports errors when chapter text is missing during reprocess', async () => {
    const onError = vi.fn();
    const manager = new ChunkManager({ useWorker: false }, { onError });

    manager.registerChapter('c1', 'Hello world');
    // Simulate a sync bug where chapter text cache is missing.
    (manager as any).chapterTexts.delete('c1');

    await manager.reprocessChunk(createChunkId('chapter', 'c1'));

    expect(onError).toHaveBeenCalledWith(
      createChunkId('chapter', 'c1'),
      expect.stringContaining('Could not retrieve chunk text'),
    );

    manager.destroy();
  });

  it('surfaces worker failures as chunk processing errors', async () => {
    const onError = vi.fn();
    const manager = new ChunkManager({ useWorker: true }, { onError });

    workerPoolMock.submitJob.mockImplementationOnce((_job: any, cb: any) => cb({ error: 'worker-fail' }));
    workerPoolMock.submitJob.mockImplementation((_job: any, cb: any) => cb({ intelligence: createIntelStub('ok') }));

    manager.registerChapter('c1', 'Hello world');
    await manager.processAllDirty();

    expect(onError).toHaveBeenCalled();
    expect(String(onError.mock.calls[0][1])).toContain('worker-fail');

    manager.destroy();
  });
});
