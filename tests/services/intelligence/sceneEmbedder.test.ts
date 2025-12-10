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
  SceneEmbedding
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
    // scene-3 has very different text, so it's filtered out by the 0.3 similarity threshold
    expect(sims.length).toBeGreaterThanOrEqual(1);
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

  it('handles empty text gracefully (magnitude 0)', () => {
    // Case 1: Empty text -> no tokens, no structural features -> all zeros
    const emptyScene = { ...baseScene, id: 'empty', startOffset: 0, endOffset: 0 };
    const emptyText = '';

    const embedding = embedScene(emptyScene, emptyText, 'ch1');

    expect(embedding.embedding.every(v => v === 0)).toBe(true);
    expect(embedding.themes).toEqual([]);
    expect(embedding.keyTerms).toEqual([]);
  });

  it('handles stop-word only text gracefully (max 0 in TF, but structural features present)', () => {
    // Case 2: Pure stop words -> TF max will be 0, but structural features (sentences etc) persist
    const scene = { ...baseScene, id: 'stopwords', startOffset: 0, endOffset: 15 };
    const stopWordsText = 'the a an is are';

    const embedding = embedScene(scene, stopWordsText, 'ch1');

    // Should have some non-zero values (structural)
    expect(embedding.embedding.some(v => v > 0)).toBe(true);
    // But themes and keyTerms should be empty because tokens are filtered out
    expect(embedding.themes).toEqual([]);
    expect(embedding.keyTerms).toEqual([]);
  });

  it('analyzes emotional arc transitions correctly', () => {
    // Create 3 fake embeddings with specific properties to trigger transition logic
    const embeddings = [
      {
        sceneId: 's1',
        emotionalTone: 'neutral',
        tensionLevel: 'low',
        embedding: [],
        themes: [],
        keyTerms: [],
        pacingCategory: 'moderate',
        chapterId: 'c1',
        metadata: {}
      } as unknown as SceneEmbedding,
      {
        sceneId: 's2',
        emotionalTone: 'negative', // Change from neutral
        tensionLevel: 'high',      // Change from low (rising)
        embedding: [],
        themes: [],
        keyTerms: [],
        pacingCategory: 'fast',
        chapterId: 'c1',
        metadata: {}
      } as unknown as SceneEmbedding,
      {
        sceneId: 's3',
        emotionalTone: 'negative', // Same as prev
        tensionLevel: 'medium',    // Change from high (falling)
        embedding: [],
        themes: [],
        keyTerms: [],
        pacingCategory: 'slow',
        chapterId: 'c1',
        metadata: {}
      } as unknown as SceneEmbedding
    ];

    const arc = analyzeEmotionalArc(embeddings);

    expect(arc).toHaveLength(2);

    // Transition s1 -> s2
    // Tone: neutral -> negative
    // Tension: low(1) -> high(3) => rising
    // The code prioritizes tone change first if present, then tension?
    // Let's check logic:
    // if tone diff -> set transition string
    // if tension diff -> OVERWRITE transition string
    // So tension change takes precedence in the output string if both change?
    // Reading code:
    // let transition = 'stable';
    // if (tone diff) transition = 'tone -> tone';
    // if (tension diff) transition = 'tension rising/falling';
    // Yes, tension overwrites tone.

    expect(arc[0].transition).toBe('tension rising');

    // Transition s2 -> s3
    // Tone: negative -> negative (no change)
    // Tension: high(3) -> medium(2) => falling
    expect(arc[1].transition).toBe('tension falling');
  });

  it('detects mixed emotional tone correctly', () => {
    // Needs > 5 total emotional words, ratio between 0.35 and 0.65
    // 3 positive, 3 negative = 6 total, ratio 0.5
    const mixedText = 'happy sad love hate joy fear';
    const scene = { ...baseScene, id: 'mixed' };

    const embedding = embedScene(scene, mixedText, 'ch1');
    expect(embedding.emotionalTone).toBe('mixed');
  });

  it('exercises searchScenes match reason branches', () => {
    const embeddings = [
      {
        sceneId: 's1',
        embedding: new Array(64).fill(0.5), // High similarity potential
        themes: ['war'],
        keyTerms: ['general'],
        emotionalTone: 'negative',
        tensionLevel: 'high',
        pacingCategory: 'fast',
        chapterId: 'c1',
        metadata: {}
      } as unknown as SceneEmbedding
    ];

    // 1. High semantic score, no keywords/themes
    // Mock embedQuery to return matching vector
    // But embedQuery is deterministic based on text.
    // Instead, we trust the integration.
    // We can manually call searchScenes with a query that triggers specific paths?
    // It's hard to force high semantic score without matching keywords if we use real embedQuery.
    // However, we can mock embedQuery? No, imported directly.

    // Let's try to hit the branches by crafting the query.
    // Query: "war" -> matches theme 'war'.
    // Query: "general" -> matches keyword 'general'.

    // Branch 1: Semantic > 0.3
    // Branch 2: Term boost > 0
    // Branch 3: Theme match

    const results = searchScenes('general war', embeddings, { minScore: 0 });

    expect(results).toHaveLength(1);
    const reason = results[0].matchReason;

    // Expect all parts if possible, or at least check logic coverage
    // "general" is in keyTerms -> termBoost > 0
    // "war" is in themes -> theme match

    expect(reason).toContain('keywords: general');
    expect(reason).toContain('themes: war');
    // Semantic match depends on the random hash collision of 'general war' vs 0.5 array
    // Likely low semantic score with garbage embedding, but keyword matches should trigger.
  });
});
