import { describe, it, expect } from 'vitest';
import {
  buildHeatmap,
  getSectionAtOffset,
  getHighRiskSections,
  getSuggestionsForRange,
  getRiskSummary,
} from '../../../services/intelligence/heatmapBuilder';
import type {
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
});
