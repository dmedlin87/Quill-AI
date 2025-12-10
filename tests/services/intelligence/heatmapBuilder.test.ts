import { describe, it, expect } from 'vitest';
import {
  buildHeatmap,
  getSectionAtOffset,
  getHighRiskSections,
  getSuggestionsForRange,
  getRiskSummary,
} from '../../../services/intelligence/heatmapBuilder';
import type {
  ClassifiedParagraph,
  StructuralFingerprint,
  EntityGraph,
  Timeline,
  StyleFingerprint,
  StructuralStats,
  DialogueLine,
  EntityNode,
  TimelineEvent,
  PlotPromise,
} from '../../../types/intelligence';

const makeStructural = (): StructuralFingerprint => ({
  paragraphs: [
    {
      offset: 0,
      length: 100,
      avgSentenceLength: 31,
      sentenceCount: 4,
      tension: 0.1,
      type: 'exposition',
    } as any,
    {
      offset: 200,
      length: 150,
      avgSentenceLength: 4,
      sentenceCount: 5,
      tension: 0.1,
      type: 'dialogue',
    } as any,
  ],
  scenes: [
    {
      id: 's1',
      startOffset: 0,
      endOffset: 400,
      tension: 0.1,
      location: null,
      type: 'scene',
    } as any,
  ],
  dialogueMap: [] as DialogueLine[],
  stats: ({
    totalWords: 1000,
    totalSentences: 100,
    totalParagraphs: 10,
    avgSentenceLength: 10,
    sentenceLengthVariance: 0,
    dialogueRatio: 0.5,
    sceneCount: 1,
    povShifts: 0,
    avgSceneLength: 400,
  } as unknown) as StructuralStats,
  processedAt: 0,
});

const makeEntities = (): EntityGraph => ({
  nodes: [
    {
      id: 'c1',
      type: 'character',
      name: 'Alice',
      mentionCount: 3,
      mentions: [{ offset: 10 } as any, { offset: 520 } as any, { offset: 1020 } as any],
      aliases: [],
      firstMention: { offset: 10 } as any,
      attributes: {},
    } as EntityNode,
    {
      id: 'loc1',
      type: 'location',
      name: 'Castle',
      mentionCount: 1,
      mentions: [{ offset: 30 } as any],
      aliases: [],
      firstMention: { offset: 30 } as any,
      attributes: {},
    } as EntityNode,
  ],
  edges: [],
  processedAt: 0,
});

const makeTimeline = (): Timeline => ({
  events: [] as TimelineEvent[],
  promises: [
    ({
      id: 'p1',
      resolved: false,
      offset: 20,
      type: 'mystery',
      description: 'A question is raised',
      quote: 'A question is raised',
      chapterId: 'ch-1',
    } as unknown) as PlotPromise,
  ],
  causalChains: [],
  processedAt: 0,
});

const makeStyle = (): StyleFingerprint => ({
  flags: {
    passiveVoiceInstances: [{ offset: 5 } as any, { offset: 520 } as any],
    adverbInstances: [{ offset: 6 } as any, { offset: 7 } as any, { offset: 8 } as any],
    filterWordInstances: [{ offset: 9 } as any, { offset: 10 } as any],
    passiveVoiceRatio: 4,
    adverbDensity: 5,
    clicheCount: 1,
    clicheInstances: [{ phrase: 'at the end of the day', offset: 15 } as any],
  },
  syntax: { avgSentenceLength: 20 } as any,
  vocabulary: { overusedWords: ['just', 'really', 'actually'] } as any,
} as StyleFingerprint);

const makeHeatmap = () =>
  buildHeatmap('x'.repeat(1200), makeStructural(), makeEntities(), makeTimeline(), makeStyle());

const makeParagraph = (opts: {
  offset: number;
  length: number;
  avgSentenceLength: number;
  sentenceCount: number;
  tension: number;
  type: 'dialogue' | 'action' | 'description' | 'internal' | 'exposition';
}) => ({
  offset: opts.offset,
  length: opts.length,
  avgSentenceLength: opts.avgSentenceLength,
  sentenceCount: opts.sentenceCount,
  tension: opts.tension,
  type: opts.type,
  speakerId: null,
  sentiment: 0,
}) as ClassifiedParagraph;

const makeRichStructural = (): StructuralFingerprint => ({
  paragraphs: [
    makeParagraph({ offset: 0, length: 250, avgSentenceLength: 35, sentenceCount: 5, tension: 0.1, type: 'exposition' }),
    makeParagraph({ offset: 210, length: 50, avgSentenceLength: 3, sentenceCount: 5, tension: 0.1, type: 'dialogue' }),
    makeParagraph({ offset: 270, length: 40, avgSentenceLength: 4, sentenceCount: 5, tension: 0.1, type: 'dialogue' }),
    makeParagraph({ offset: 330, length: 30, avgSentenceLength: 4, sentenceCount: 5, tension: 0.05, type: 'dialogue' }),
    makeParagraph({ offset: 600, length: 120, avgSentenceLength: 12, sentenceCount: 4, tension: 0.15, type: 'exposition' }),
    makeParagraph({ offset: 730, length: 110, avgSentenceLength: 11, sentenceCount: 4, tension: 0.18, type: 'exposition' }),
    makeParagraph({ offset: 860, length: 100, avgSentenceLength: 13, sentenceCount: 4, tension: 0.17, type: 'exposition' }),
    makeParagraph({ offset: 980, length: 90, avgSentenceLength: 10, sentenceCount: 4, tension: 0.16, type: 'exposition' }),
  ],
  scenes: [
    {
      id: 'scene-a',
      startOffset: 0,
      endOffset: 400,
      type: 'description',
      pov: null,
      location: 'Castle',
      timeMarker: 'morning',
      tension: 0.1,
      dialogueRatio: 0.4,
    },
    {
      id: 'scene-b',
      startOffset: 600,
      endOffset: 1100,
      type: 'description',
      pov: null,
      location: null,
      timeMarker: 'afternoon',
      tension: 0.15,
      dialogueRatio: 0.05,
    },
  ],
  dialogueMap: [],
  stats: {
    totalWords: 2000,
    totalSentences: 200,
    totalParagraphs: 8,
    avgSentenceLength: 12,
    sentenceLengthVariance: 4,
    dialogueRatio: 0.7,
    sceneCount: 2,
    povShifts: 1,
    avgSceneLength: 550,
  } as StructuralStats,
  processedAt: 0,
});

const makeRichEntities = (): EntityGraph => ({
  nodes: [
    {
      id: 'char-rich',
      type: 'character',
      name: 'Hero',
      mentionCount: 2,
      mentions: [
        { offset: 10, chapterId: 'ch-1' },
        { offset: 250, chapterId: 'ch-1' },
      ],
      aliases: [],
      firstMention: 10,
      attributes: {},
    } as any,
    {
      id: 'loc-rich',
      type: 'location',
      name: 'Castle',
      mentionCount: 1,
      mentions: [{ offset: 30, chapterId: 'ch-1' }],
      aliases: [],
      firstMention: 30,
      attributes: {},
    } as any,
  ],
  edges: [],
  processedAt: 0,
});

const makeRichTimeline = (): Timeline => ({
  events: [],
  promises: [
    {
      id: 'promise-rich',
      resolved: false,
      offset: 40,
      type: 'question',
      description: 'A mystery is teased',
      quote: 'A mystery is teased',
      chapterId: 'ch-1',
    } as PlotPromise,
  ],
  causalChains: [],
  processedAt: 0,
});

const makeRichStyle = (): StyleFingerprint => ({
  flags: {
    passiveVoiceRatio: 4,
    passiveVoiceInstances: [
      { offset: 5, quote: 'was seen' },
      { offset: 45, quote: 'was told' },
      { offset: 550, quote: 'was whispered' },
      { offset: 560, quote: 'was breathed' },
    ],
    adverbDensity: 5,
    adverbInstances: [
      { offset: 6, word: 'really' },
      { offset: 12, word: 'quietly' },
      { offset: 20, word: 'clearly' },
    ],
    filterWordDensity: 6,
    filterWordInstances: [{ offset: 7, word: 'seemed' }, { offset: 8, word: 'felt' }],
    clicheCount: 0,
    clicheInstances: [],
    repeatedPhrases: [],
  },
  syntax: {
    avgSentenceLength: 12,
    sentenceLengthVariance: 2,
    minSentenceLength: 2,
    maxSentenceLength: 35,
    paragraphLengthAvg: 75,
    dialogueToNarrativeRatio: 0.6,
    questionRatio: 0.1,
    exclamationRatio: 0.05,
  },
  vocabulary: {
    uniqueWords: 400,
    totalWords: 1500,
    avgWordLength: 4,
    lexicalDiversity: 0.6,
    topWords: [],
    overusedWords: [],
    rareWords: [],
  },
  rhythm: {
    syllablePattern: [1, 2, 3],
    punctuationDensity: 0.1,
    avgClauseCount: 2,
  },
  processedAt: 0,
});

describe('heatmapBuilder - buildHeatmap and helpers', () => {
  it('builds sections and hotspots with non-empty text', () => {
    const heatmap = makeHeatmap();

    expect(heatmap.sections.length).toBeGreaterThan(0);
    expect(heatmap.processedAt).toBeTypeOf('number');

    const anyWithFlags = heatmap.sections.some(section => section.flags.length > 0);
    expect(anyWithFlags).toBe(true);

    const anyHotspotsAboveThreshold = heatmap.hotspots.every(h => h.severity > 0.5);
    expect(anyHotspotsAboveThreshold).toBe(true);
  });

  it('returns empty sections and hotspots for empty text', () => {
    const emptyStructural = makeStructural();
    emptyStructural.paragraphs = [];
    const emptyEntities = { nodes: [], edges: [] } as EntityGraph;
    const emptyTimeline = { events: [], promises: [] } as Timeline;
    const style = makeStyle();

    const heatmap = buildHeatmap('', emptyStructural, emptyEntities, emptyTimeline, style);
    expect(heatmap.sections).toEqual([]);
    expect(heatmap.hotspots).toEqual([]);
  });

  it('getSectionAtOffset returns correct section or null', () => {
    const heatmap = makeHeatmap();
    const first = heatmap.sections[0];

    expect(getSectionAtOffset(heatmap, first.offset + 10)).toEqual(first);
    expect(getSectionAtOffset(heatmap, 999999)).toBeNull();
  });

  it('getHighRiskSections filters and sorts by overallRisk', () => {
    const heatmap = makeHeatmap();
    const highRisk = getHighRiskSections(heatmap, 0.1);

    expect(highRisk.length).toBeGreaterThan(0);
    for (let i = 1; i < highRisk.length; i++) {
      expect(highRisk[i - 1].overallRisk).toBeGreaterThanOrEqual(highRisk[i].overallRisk);
    }
  });

  it('getSuggestionsForRange aggregates unique suggestions', () => {
    const heatmap = makeHeatmap();
    const suggestions = getSuggestionsForRange(heatmap, 0, 600);

    expect(suggestions.length).toBeGreaterThan(0);

    const unique = new Set(suggestions);
    expect(unique.size).toBe(suggestions.length);
  });

  it('getRiskSummary computes averages and top issues safely', () => {
    const heatmap = makeHeatmap();
    const summary = getRiskSummary(heatmap);

    expect(summary.avgRisk).toBeGreaterThanOrEqual(0);
    expect(summary.avgRisk).toBeLessThanOrEqual(1);
    expect(summary.hotspotCount).toBe(heatmap.hotspots.length);
    expect(summary.topIssues.length).toBeLessThanOrEqual(5);
  });

  it('getRiskSummary handles heatmap with no sections', () => {
    const emptyHeatmap = { sections: [], hotspots: [], processedAt: 0 } as any;
    const summary = getRiskSummary(emptyHeatmap);

    expect(summary.avgRisk).toBe(0);
    expect(summary.hotspotCount).toBe(0);
    expect(summary.topIssues).toEqual([]);
  });

  it('flags every relevant risk when inputs span multiple sections', () => {
    const richHeatmap = buildHeatmap(
      'x'.repeat(1200),
      makeRichStructural(),
      makeRichEntities(),
      makeRichTimeline(),
      makeRichStyle()
    );

    expect(richHeatmap.sections.length).toBeGreaterThan(1);

    const [firstSection, secondSection] = richHeatmap.sections;

    expect(firstSection.flags).toEqual(expect.arrayContaining([
      'unresolved_promise',
      'long_sentences',
      'short_sentences',
      'low_tension',
      'dialogue_heavy',
      'passive_voice_heavy',
      'adverb_overuse',
      'filter_words',
    ]));

    expect(secondSection.flags).toEqual(expect.arrayContaining([
      'exposition_dump',
      'character_absent',
      'setting_unclear',
    ]));

    expect(firstSection.suggestions).toContain('Break up long sentences for better pacing');
    expect(secondSection.suggestions).toEqual(expect.arrayContaining([
      'Break up exposition with action or dialogue',
      'Consider establishing the setting more clearly',
    ]));
  });
});
