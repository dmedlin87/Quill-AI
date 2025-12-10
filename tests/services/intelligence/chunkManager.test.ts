/**
 * ChunkManager tests focused on branch coverage of edge cases and aggregations
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '@/services/intelligence/chunkManager';
import { ChunkAnalysis, ManuscriptIntelligence } from '@/types/intelligence';

const createManager = () =>
  new ChunkManager({
    editDebounceMs: 0,
    processingIntervalMs: 0,
    idleThresholdMs: 0,
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
