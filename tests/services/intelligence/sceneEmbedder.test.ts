import { describe, it, expect } from 'vitest';

import {
  analyzeEmotionalArc,
  cosineSimilarity,
  embedAllScenes,
  embedQuery,
  embedScene,
  findSimilarScenes,
  getScenesByTheme,
  searchScenes,
} from '@/services/intelligence/sceneEmbedder';
import type { Scene, StructuralFingerprint } from '@/types/intelligence';

const baseScene: Scene = {
  id: 'scene-1',
  startOffset: 0,
  endOffset: 120,
  type: 'action',
  pov: null,
  location: null,
  timeMarker: null,
  tension: 0.8,
  dialogueRatio: 0.6,
};

const sampleText = `
  The lovers embrace and kiss before the battle. They fight and clash, then laugh together.
  "We will survive this," she said, smiling as danger loomed. The tension was high!
`;

describe('sceneEmbedder', () => {
  it('embeds a single scene with themes, tone, pacing, and metadata', () => {
    const embedding = embedScene(baseScene, sampleText, 'chapter-1');

    expect(embedding.embedding).toHaveLength(64);
    expect(embedding.sceneId).toBe('scene-1');
    expect(embedding.chapterId).toBe('chapter-1');
    expect(embedding.themes).toEqual(expect.arrayContaining(['conflict', 'romance']));
    expect(embedding.emotionalTone).toBe('positive');
    expect(embedding.tensionLevel).toBe('high');
    expect(embedding.pacingCategory).toBe('fast');
    expect(embedding.keyTerms.length).toBeGreaterThan(0);
    expect(embedding.metadata.wordCount).toBeGreaterThan(0);
  });

  it('embeds all scenes and searches with filters and boosts', () => {
    const fingerprint: StructuralFingerprint = {
      scenes: [
        baseScene,
        { ...baseScene, id: 'scene-2', startOffset: 120, endOffset: 240, tension: 0.2, dialogueRatio: 0.1 },
      ],
      paragraphs: [],
      dialogueMap: [],
      stats: {
        totalWords: 0,
        totalSentences: 0,
        totalParagraphs: 0,
        avgSentenceLength: 0,
        sentenceLengthVariance: 0,
        dialogueRatio: 0,
        sceneCount: 2,
        povShifts: 0,
        avgSceneLength: 0,
      },
      processedAt: Date.now(),
    };

    const all = embedAllScenes(fingerprint, sampleText + sampleText, 'chapter-1');
    expect(all).toHaveLength(2);

    const results = searchScenes('conflict romance', all, { minScore: 0.1, filterByTension: 'high' });
    expect(results).toHaveLength(1);
    expect(results[0].sceneId).toBe('scene-1');
    expect(results[0].matchReason).toContain('themes');
  });

  it('finds similar scenes and handles missing targets', () => {
    const embeddings = [
      embedScene(baseScene, sampleText, 'chapter-1'),
      embedScene({ ...baseScene, id: 'scene-2', tension: 0.5 }, sampleText, 'chapter-1'),
      embedScene({ ...baseScene, id: 'scene-3', tension: 0.1 }, 'Calm peaceful evening by the lake', 'chapter-1'),
    ];

    const none = findSimilarScenes('missing', embeddings);
    expect(none).toEqual([]);

    const sims = findSimilarScenes('scene-1', embeddings, 2);
    expect(sims).toHaveLength(2);
    expect(sims[0].score).toBeGreaterThan(0);
    expect(sims[0].sceneId).toBe('scene-2');
  });

  it('supports theme filtering, cosine safety, and query embedding', () => {
    const embeddings = [
      embedScene(baseScene, sampleText, 'chapter-1'),
      embedScene({ ...baseScene, id: 'scene-2' }, 'Peaceful village morning with smiles and joy', 'chapter-1'),
    ];

    const romanceScenes = getScenesByTheme('romance', embeddings);
    expect(romanceScenes.length).toBeGreaterThan(0);

    expect(cosineSimilarity([1, 0], [0])).toBe(0);

    const queryEmbedding = embedQuery('joyful morning');
    expect(queryEmbedding).toHaveLength(64);

    const arc = analyzeEmotionalArc(embeddings);
    expect(arc.length).toBe(1);
  });
});
