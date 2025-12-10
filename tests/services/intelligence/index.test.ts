import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock intelligence submodules to focus on orchestration behaviour in index.ts.

const makeStructural = () => ({
  scenes: [
    {
      id: 's1',
      startOffset: 0,
      endOffset: 50,
      type: 'action',
      pov: 'Alice',
      location: 'Bridge',
      timeMarker: null,
      tension: 0.7,
      dialogueRatio: 0.3,
    },
  ],
  paragraphs: [
    {
      offset: 0,
      length: 50,
      type: 'narration',
      speakerId: null,
      sentiment: 0,
      tension: 0.7,
      sentenceCount: 2,
      avgSentenceLength: 25,
    },
  ],
  dialogueMap: [],
  stats: {
    totalWords: 10,
    totalSentences: 2,
    totalParagraphs: 1,
    avgSentenceLength: 5,
    sentenceLengthVariance: 0,
    dialogueRatio: 0.2,
    sceneCount: 1,
    povShifts: 0,
    avgSceneLength: 50,
  },
  processedAt: 123,
} as any);

const makeEntities = () => ({
  nodes: [
    {
      id: 'c1',
      name: 'Alice',
      type: 'character',
      aliases: [],
      firstMention: 0,
      mentionCount: 3,
      mentions: [],
      attributes: {},
    },
  ],
  edges: [],
  processedAt: 123,
} as any);

const makeTimeline = () => ({
  events: [],
  promises: [],
  causalChains: [],
  processedAt: 123,
} as any);

const makeStyle = () => ({
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
    avgSentenceLength: 10,
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
    passiveVoiceInstances: [],
    adverbInstances: [],
    filterWordInstances: [],
    clicheInstances: [],
    repeatedPhrases: [],
    passiveVoiceRatio: 0,
    adverbDensity: 0,
    clicheCount: 0,
  },
  processedAt: 0,
} as any);

const makeHeatmap = () => ({
  sections: [
    {
      offset: 0,
      length: 50,
      scores: {
        plotRisk: 0.5,
        pacingRisk: 0.4,
        characterRisk: 0.3,
        settingRisk: 0.2,
        styleRisk: 0.1,
      },
      overallRisk: 0.6,
      flags: ['pacing_slow'],
      suggestions: ['Tighten this section'],
    },
  ],
  hotspots: [],
  processedAt: 123,
} as any);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Intelligence service - processManuscript', () => {
  it('runs full pipeline and uses createEmptyDelta when no previous intelligence', async () => {
    const structural = makeStructural();
    const entities = makeEntities();
    const timeline = makeTimeline();
    const style = makeStyle();
    const heatmap = makeHeatmap();
    const voice = { profiles: {}, consistencyAlerts: [] } as any;
    const delta = { changedRanges: [], invalidatedSections: [], affectedEntities: [], newPromises: [], resolvedPromises: [], contentHash: 'hash', processedAt: 0 } as any;

    const parseStructure = vi.fn(() => structural);
    const extractEntities = vi.fn(() => entities);
    const buildTimeline = vi.fn(() => timeline);
    const analyzeStyle = vi.fn(() => style);
    const analyzeVoices = vi.fn(() => voice);
    const buildHeatmap = vi.fn(() => heatmap);
    const createDelta = vi.fn(() => delta);
    const createEmptyDelta = vi.fn(() => delta);
    const buildHUD = vi.fn(() => ({
      situational: {} as any,
      context: {} as any,
      styleAlerts: [],
      prioritizedIssues: [],
      recentChanges: [],
      stats: { wordCount: 10, readingTime: 1, dialoguePercent: 20, avgSentenceLength: 5 },
      lastFullProcess: structural.processedAt,
      processingTier: 'background',
    }));

    vi.doMock('../../../services/intelligence/structuralParser', () => ({
      parseStructure,
    }));

    vi.doMock('../../../services/intelligence/entityExtractor', () => ({
      extractEntities,
      mergeEntityGraphs: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/timelineTracker', () => ({
      buildTimeline,
      mergeTimelines: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/styleAnalyzer', () => ({
      analyzeStyle,
    }));

    vi.doMock('../../../services/intelligence/voiceProfiler', () => ({
      analyzeVoices,
    }));

    vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
      buildHeatmap,
    }));

    vi.doMock('../../../services/intelligence/deltaTracker', () => ({
      createDelta,
      createEmptyDelta,
      hashContent: vi.fn(),
      ChangeHistory: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/contextBuilder', () => ({
      buildHUD,
      buildAIContextString: vi.fn(),
      buildCompressedContext: vi.fn(),
    }));

    const { processManuscript } = await import('../../../services/intelligence');

    const result = processManuscript('Example text', 'ch-1');

    expect(parseStructure).toHaveBeenCalledWith('Example text');
    expect(extractEntities).toHaveBeenCalledWith(
      'Example text',
      structural.paragraphs,
      structural.dialogueMap,
      'ch-1',
    );
    expect(buildTimeline).toHaveBeenCalledWith('Example text', structural.scenes, 'ch-1');
    expect(analyzeStyle).toHaveBeenCalledWith('Example text');
    expect(analyzeVoices).toHaveBeenCalledWith(structural.dialogueMap);
    expect(buildHeatmap).toHaveBeenCalledWith('Example text', structural, entities, timeline, style);
    expect(createEmptyDelta).toHaveBeenCalledWith('Example text');
    expect(createDelta).not.toHaveBeenCalled();
    expect(buildHUD).toHaveBeenCalledWith(
      expect.objectContaining({ chapterId: 'ch-1', structural, entities, timeline, style, voice, heatmap, delta }),
      0,
    );

    expect(result).toMatchObject({
      chapterId: 'ch-1',
      structural,
      entities,
      timeline,
      style,
      voice,
      heatmap,
      delta,
      hud: expect.any(Object),
    });
  });

  it('uses createDelta when previous intelligence is provided', async () => {
    const structural = makeStructural();
    const entities = makeEntities();
    const timeline = makeTimeline();
    const style = makeStyle();
    const heatmap = makeHeatmap();
    const voice = { profiles: {}, consistencyAlerts: [] } as any;
    const emptyDelta = { changedRanges: [] } as any;
    const computedDelta = { changedRanges: [{ start: 0, end: 1 }] } as any;

    const parseStructure = vi.fn(() => structural);
    const extractEntities = vi.fn(() => entities);
    const buildTimeline = vi.fn(() => timeline);
    const analyzeStyle = vi.fn(() => style);
    const analyzeVoices = vi.fn(() => voice);
    const buildHeatmap = vi.fn(() => heatmap);
    const createDelta = vi.fn(() => computedDelta);
    const createEmptyDelta = vi.fn(() => emptyDelta);
    const buildHUD = vi.fn(() => ({ situational: {} as any, context: {} as any, styleAlerts: [], prioritizedIssues: [], recentChanges: [], stats: { wordCount: 10, readingTime: 1, dialoguePercent: 20, avgSentenceLength: 5 }, lastFullProcess: structural.processedAt, processingTier: 'background' }));

    vi.doMock('../../../services/intelligence/structuralParser', () => ({ parseStructure }));
    vi.doMock('../../../services/intelligence/entityExtractor', () => ({ extractEntities, mergeEntityGraphs: vi.fn() }));
    vi.doMock('../../../services/intelligence/timelineTracker', () => ({ buildTimeline, mergeTimelines: vi.fn() }));
    vi.doMock('../../../services/intelligence/styleAnalyzer', () => ({ analyzeStyle }));
    vi.doMock('../../../services/intelligence/voiceProfiler', () => ({ analyzeVoices }));
    vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({ buildHeatmap }));
    vi.doMock('../../../services/intelligence/deltaTracker', () => ({ createDelta, createEmptyDelta, hashContent: vi.fn(), ChangeHistory: vi.fn() }));
    vi.doMock('../../../services/intelligence/contextBuilder', () => ({ buildHUD, buildAIContextString: vi.fn(), buildCompressedContext: vi.fn() }));

    const { processManuscript } = await import('../../../services/intelligence');

    const prevIntelligence = {
      chapterId: 'ch-1',
      structural,
      entities,
      timeline,
      style,
      voice,
      heatmap,
      delta: emptyDelta,
      hud: null,
    } as any;

    const result = processManuscript('New text', 'ch-1', 'Old text', prevIntelligence);

    expect(createDelta).toHaveBeenCalledWith('Old text', 'New text', prevIntelligence.entities, prevIntelligence.timeline);
    expect(createEmptyDelta).not.toHaveBeenCalled();
    expect(result.delta).toBe(computedDelta);
  });
});

describe('Intelligence service - cached processing', () => {
  it('uses cached variants for structural, entities, and style', async () => {
    const structural = makeStructural();
    const entities = makeEntities();
    const timeline = makeTimeline();
    const style = makeStyle();
    const heatmap = makeHeatmap();
    const voice = { profiles: {}, consistencyAlerts: [] } as any;
    const delta = { changedRanges: [] } as any;

    const parseStructureCached = vi.fn(() => structural);
    const extractEntitiesCached = vi.fn(() => entities);
    const analyzeStyleCached = vi.fn(() => style);
    const buildTimeline = vi.fn(() => timeline);
    const buildHeatmap = vi.fn(() => heatmap);
    const analyzeVoices = vi.fn(() => voice);
    const createDelta = vi.fn(() => delta);
    const createEmptyDelta = vi.fn(() => delta);
    const buildHUD = vi.fn(() => ({ situational: {} as any, context: {} as any, styleAlerts: [], prioritizedIssues: [], recentChanges: [], stats: { wordCount: 10, readingTime: 1, dialoguePercent: 20, avgSentenceLength: 5 }, lastFullProcess: structural.processedAt, processingTier: 'background' }));

    vi.doMock('../../../services/intelligence/cache', () => ({
      parseStructureCached,
      extractEntitiesCached,
      analyzeStyleCached,
      getIntelligenceCache: vi.fn(),
      clearIntelligenceCache: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/timelineTracker', () => ({
      buildTimeline,
      mergeTimelines: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
      buildHeatmap,
    }));

    vi.doMock('../../../services/intelligence/voiceProfiler', () => ({
      analyzeVoices,
    }));

    vi.doMock('../../../services/intelligence/deltaTracker', () => ({
      createDelta,
      createEmptyDelta,
      hashContent: vi.fn(),
      ChangeHistory: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/contextBuilder', () => ({
      buildHUD,
      buildAIContextString: vi.fn(),
      buildCompressedContext: vi.fn(),
    }));

    const { processManuscriptCached } = await import('../../../services/intelligence');

    const result = processManuscriptCached('Cached text', 'ch-1');

    expect(parseStructureCached).toHaveBeenCalledWith('Cached text');
    expect(extractEntitiesCached).toHaveBeenCalledWith(
      'Cached text',
      structural.paragraphs,
      structural.dialogueMap,
      'ch-1',
    );
    expect(analyzeStyleCached).toHaveBeenCalledWith('Cached text');
    expect(buildTimeline).toHaveBeenCalledWith('Cached text', structural.scenes, 'ch-1');
    expect(buildHeatmap).toHaveBeenCalledWith('Cached text', structural, entities, timeline, style);
    expect(result.chapterId).toBe('ch-1');
  });
});

describe('Intelligence service - metrics helpers', () => {
  it('processInstant uses cached structural when fresh', async () => {
    const { processInstant } = await import('../../../services/intelligence');

    const cachedStructural = {
      scenes: [
        { startOffset: 0, endOffset: 10, type: 'setup', tension: 0.2 },
      ],
      paragraphs: [],
      dialogueMap: [],
      stats: {
        totalWords: 100,
        totalSentences: 10,
        totalParagraphs: 3,
        avgSentenceLength: 10,
        sentenceLengthVariance: 0,
        dialogueRatio: 0.1,
        sceneCount: 1,
        povShifts: 0,
        avgSceneLength: 10,
      },
      processedAt: Date.now(),
    } as any;

    const metrics = processInstant('ignored', 5, cachedStructural);

    expect(metrics.wordCount).toBe(100);
    expect(metrics.sentenceCount).toBe(10);
    expect(metrics.paragraphCount).toBe(3);
    expect(metrics.cursorScene).toBe('setup');
    expect(metrics.cursorTension).toBe(0.2);
  });

  it('processInstant falls back to quick calculation when cache is stale', async () => {
    const { processInstant } = await import('../../../services/intelligence');

    const staleStructural = {
      scenes: [],
      paragraphs: [],
      dialogueMap: [],
      stats: { totalWords: 0, totalSentences: 0, totalParagraphs: 0 },
      processedAt: Date.now() - 10_000,
    } as any;

    const text = 'One two three. Four five six.';
    const metrics = processInstant(text, 0, staleStructural);

    expect(metrics.wordCount).toBe(6);
    expect(metrics.sentenceCount).toBe(2);
    expect(metrics.paragraphCount).toBe(1);
    expect(metrics.cursorScene).toBeNull();
  });

  it('processDebounced parses structure and derives metrics', async () => {
    const structural = {
      scenes: [
        { startOffset: 0, endOffset: 20, type: 'action', tension: 0.9 },
      ],
      paragraphs: [
        { offset: 0, length: 20, type: 'dialogue', sentenceCount: 2, avgSentenceLength: 10 },
      ],
      dialogueMap: [],
      stats: {
        totalWords: 20,
        totalSentences: 4,
        totalParagraphs: 2,
        avgSentenceLength: 5,
        sentenceLengthVariance: 0,
        dialogueRatio: 0.5,
        sceneCount: 1,
        povShifts: 0,
        avgSceneLength: 20,
      },
      processedAt: 0,
    } as any;

    const parseStructure = vi.fn(() => structural);

    vi.doMock('../../../services/intelligence/structuralParser', () => ({ parseStructure }));

    const { processDebounced } = await import('../../../services/intelligence');

    const metrics = processDebounced('text', 10);

    expect(parseStructure).toHaveBeenCalledWith('text');
    expect(metrics.wordCount).toBe(20);
    expect(metrics.paragraphCount).toBe(2);
    expect(metrics.cursorScene).toBe('action');
    expect(metrics.currentParagraphType).toBe('dialogue');
    expect(metrics.dialogueRatio).toBe(0.5);
    expect(metrics.avgSentenceLength).toBe(5);
  });
});

describe('Intelligence service - context utilities', () => {
  it('generateAIContext delegates to buildHUD and context builders', async () => {
    const buildHUD = vi.fn(() => ({ hud: true } as any));
    const buildAIContextString = vi.fn(() => '[FULL]');
    const buildCompressedContext = vi.fn(() => '[COMPRESSED]');

    vi.doMock('../../../services/intelligence/contextBuilder', () => ({
      buildHUD,
      buildAIContextString,
      buildCompressedContext,
    }));

    const { generateAIContext } = await import('../../../services/intelligence');

    const intelligence = { chapterId: 'ch-1' } as any;

    const full = generateAIContext(intelligence, 5, false);
    const compressed = generateAIContext(intelligence, 10, true);

    expect(buildHUD).toHaveBeenCalledWith(intelligence, 5);
    expect(buildHUD).toHaveBeenCalledWith(intelligence, 10);
    expect(buildAIContextString).toHaveBeenCalledTimes(1);
    expect(buildCompressedContext).toHaveBeenCalledTimes(1);
    expect(full).toBe('[FULL]');
    expect(compressed).toBe('[COMPRESSED]');
  });

  it('generateSectionContext summarizes scenes, entities, and issues in range', async () => {
    const { generateSectionContext } = await import('../../../services/intelligence');

    const intelligence = {
      structural: {
        scenes: [
          { startOffset: 0, endOffset: 100, type: 'action', tension: 0.8 },
          { startOffset: 200, endOffset: 300, type: 'quiet', tension: 0.2 },
        ],
      },
      entities: {
        nodes: [
          {
            id: 'c1',
            name: 'Alice',
            type: 'character',
            mentions: [{ offset: 10 }],
          },
        ],
      },
      heatmap: {
        sections: [
          { offset: 0, length: 100, flags: ['pacing_slow'], suggestions: [] },
        ],
      },
    } as any;

    const ctx = generateSectionContext(intelligence, 0, 150);

    expect(ctx).toContain('[SCENES IN SECTION]');
    expect(ctx).toContain('action scene');
    expect(ctx).toContain('[ENTITIES IN SECTION]');
    expect(ctx).toContain('Alice');
    expect(ctx).toContain('[ISSUES IN SECTION]');
    expect(ctx).toContain('pacing_slow');
  });

  it('updateHUDForCursor delegates to buildHUD', async () => {
    const buildHUD = vi.fn(() => ({ hud: 'updated' } as any));
    vi.doMock('../../../services/intelligence/contextBuilder', () => ({
      buildHUD,
      buildAIContextString: vi.fn(),
      buildCompressedContext: vi.fn(),
    }));

    const { updateHUDForCursor } = await import('../../../services/intelligence');
    const intelligence = { chapterId: 'ch-1' } as any;
    const result = updateHUDForCursor(intelligence, 123);

    expect(buildHUD).toHaveBeenCalledWith(intelligence, 123);
    expect(result).toEqual({ hud: 'updated' });
  });
});

describe('Intelligence service - cross-chapter processing', () => {
  it('mergeChapterIntelligence aggregates stats and merges sub-data', async () => {
    const mergeEntityGraphs = vi.fn(() => ({
      nodes: [{ name: 'Alice', type: 'character' }, { name: 'Bob', type: 'character' }],
      edges: [],
    }));
    const mergeTimelines = vi.fn(() => ({ events: [], causalChains: [] }));

    vi.doMock('../../../services/intelligence/entityExtractor', () => ({
      extractEntities: vi.fn(),
      mergeEntityGraphs,
    }));

    vi.doMock('../../../services/intelligence/timelineTracker', () => ({
      buildTimeline: vi.fn(),
      mergeTimelines,
    }));

    const { mergeChapterIntelligence } = await import('../../../services/intelligence');

    const ch1 = {
      structural: { stats: { totalWords: 100 }, scenes: [{ tension: 0.8 }] },
      entities: { id: 'e1' },
      timeline: { id: 't1' },
    } as any;
    const ch2 = {
      structural: { stats: { totalWords: 50 }, scenes: [{ tension: 0.2 }] },
      entities: { id: 'e2' },
      timeline: { id: 't2' },
    } as any;

    const result = mergeChapterIntelligence([ch1, ch2]);

    expect(mergeEntityGraphs).toHaveBeenCalled();
    expect(mergeTimelines).toHaveBeenCalled();
    expect(result.projectStats.totalWords).toBe(150);
    expect(result.projectStats.totalScenes).toBe(2);
    expect(result.projectStats.avgTension).toBeCloseTo(0.5);
    expect(result.projectStats.topCharacters).toEqual(['Alice', 'Bob']);
  });

  it('mergeChapterIntelligence handles empty input gracefully', async () => {
    const mergeEntityGraphs = vi.fn(() => ({ nodes: [], edges: [] }));
    const mergeTimelines = vi.fn(() => ({ events: [], causalChains: [] }));

    vi.doMock('../../../services/intelligence/entityExtractor', () => ({
      extractEntities: vi.fn(),
      mergeEntityGraphs,
    }));

    vi.doMock('../../../services/intelligence/timelineTracker', () => ({
      buildTimeline: vi.fn(),
      mergeTimelines,
    }));

    const { mergeChapterIntelligence } = await import('../../../services/intelligence');

    const result = mergeChapterIntelligence([]);

    expect(result.projectStats.totalWords).toBe(0);
    expect(result.projectStats.avgTension).toBe(0.5); // Fallback
    expect(result.projectStats.topCharacters).toEqual([]);
  });
});

describe('Intelligence service - factory functions', () => {
  it('createEmptyIntelligence initializes all fields with defaults', async () => {
    const { createEmptyIntelligence } = await import('../../../services/intelligence');

    const result = createEmptyIntelligence('new-chapter');

    expect(result.chapterId).toBe('new-chapter');
    expect(result.structural.scenes).toEqual([]);
    expect(result.structural.stats.totalWords).toBe(0);
    expect(result.entities.nodes).toEqual([]);
    expect(result.timeline.events).toEqual([]);
    expect(result.style.vocabulary.uniqueWords).toBe(0);
    expect(result.voice.profiles).toEqual({});
    expect(result.heatmap.sections).toEqual([]);
    expect(result.delta.changedRanges).toEqual([]);
    expect(result.hud.situational.currentScene).toBeNull();
    expect(result.hud.stats.wordCount).toBe(0);
  });
});
