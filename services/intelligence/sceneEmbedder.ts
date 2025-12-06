/**
 * Scene Embedder (Enhancement 1C)
 * 
 * Generates lightweight semantic embeddings for scenes to enable
 * semantic search queries like "Find scenes where tension escalates"
 * or "Show me dialogue-heavy scenes with conflict".
 * 
 * Uses a bag-of-words + TF-IDF approach for client-side speed.
 * Can be extended to use transformers.js for better quality.
 */

import { Scene, StructuralFingerprint } from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneEmbedding {
  sceneId: string;
  chapterId: string;
  embedding: number[]; // 64-dim lightweight embedding
  themes: string[];
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  tensionLevel: 'low' | 'medium' | 'high';
  pacingCategory: 'slow' | 'moderate' | 'fast';
  keyTerms: string[];
  metadata: {
    startOffset: number;
    endOffset: number;
    wordCount: number;
    dialogueRatio: number;
  };
}

export interface SemanticSearchResult {
  sceneId: string;
  score: number;
  embedding: SceneEmbedding;
  matchReason: string;
}

export interface SemanticSearchOptions {
  minScore?: number;
  maxResults?: number;
  filterByTone?: SceneEmbedding['emotionalTone'];
  filterByTension?: SceneEmbedding['tensionLevel'];
  filterByPacing?: SceneEmbedding['pacingCategory'];
}

// ─────────────────────────────────────────────────────────────────────────────
// VOCABULARY & SEMANTIC CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

// Semantic categories with associated terms (for theme detection)
const SEMANTIC_CATEGORIES: Record<string, string[]> = {
  conflict: ['argue', 'fight', 'clash', 'disagree', 'confront', 'challenge', 'oppose', 'resist', 'struggle', 'battle'],
  romance: ['love', 'kiss', 'embrace', 'heart', 'passion', 'desire', 'tender', 'intimate', 'adore', 'cherish'],
  tension: ['nervous', 'anxious', 'worried', 'fear', 'dread', 'uneasy', 'tense', 'stress', 'threat', 'danger'],
  discovery: ['find', 'discover', 'reveal', 'uncover', 'learn', 'realize', 'understand', 'secret', 'truth', 'mystery'],
  action: ['run', 'chase', 'fight', 'escape', 'attack', 'defend', 'leap', 'crash', 'explode', 'pursue'],
  emotion: ['cry', 'laugh', 'smile', 'frown', 'sigh', 'gasp', 'scream', 'whisper', 'tremble', 'shiver'],
  dialogue: ['said', 'asked', 'replied', 'shouted', 'whispered', 'muttered', 'exclaimed', 'questioned', 'answered', 'spoke'],
  introspection: ['thought', 'wondered', 'pondered', 'considered', 'reflected', 'remembered', 'imagined', 'dreamed', 'felt', 'believed'],
  setting: ['room', 'house', 'forest', 'city', 'street', 'mountain', 'ocean', 'sky', 'night', 'morning'],
  resolution: ['finally', 'resolved', 'concluded', 'ended', 'settled', 'peace', 'agreement', 'understanding', 'forgive', 'accept'],
};

// Emotional valence words
const POSITIVE_WORDS = new Set([
  'happy', 'joy', 'love', 'hope', 'peace', 'smile', 'laugh', 'beautiful', 'wonderful', 'amazing',
  'excited', 'delighted', 'pleased', 'grateful', 'relief', 'triumph', 'success', 'warm', 'bright', 'gentle',
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'angry', 'fear', 'hate', 'pain', 'cry', 'scream', 'dark', 'terrible', 'horrible',
  'worried', 'anxious', 'nervous', 'grief', 'despair', 'failure', 'cold', 'harsh', 'bitter', 'cruel',
]);

// ─────────────────────────────────────────────────────────────────────────────
// TEXT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

const stopWords = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'been', 'being', 'there', 'here', 'when', 'where', 'why', 'how',
]);

/**
 * Tokenize and clean text
 */
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
};

/**
 * Calculate term frequency
 */
const calculateTF = (tokens: string[]): Map<string, number> => {
  const tf = new Map<string, number>();
  let max = 0;

  for (const token of tokens) {
    const nextCount = (tf.get(token) || 0) + 1;
    tf.set(token, nextCount);
    if (nextCount > max) {
      max = nextCount;
    }
  }

  if (max === 0) {
    return tf;
  }

  for (const [term, count] of tf) {
    tf.set(term, count / max);
  }
  return tf;
};

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 64;

/**
 * Generate a lightweight embedding for scene text
 * Uses category-based projection for interpretability
 */
const generateEmbedding = (text: string): number[] => {
  const tokens = tokenize(text);
  const tf = calculateTF(tokens);
  const embedding = new Array(EMBEDDING_DIM).fill(0);
  
  // First 10 dimensions: semantic category scores
  const categories = Object.keys(SEMANTIC_CATEGORIES);
  for (let i = 0; i < Math.min(categories.length, 10); i++) {
    const category = categories[i];
    const categoryTerms = SEMANTIC_CATEGORIES[category];
    let score = 0;
    for (const term of categoryTerms) {
      score += tf.get(term) || 0;
    }
    embedding[i] = Math.min(1, score);
  }
  
  // Dimensions 10-20: Emotional valence
  let positiveScore = 0;
  let negativeScore = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) positiveScore++;
    if (NEGATIVE_WORDS.has(token)) negativeScore++;
  }
  const total = Math.max(1, positiveScore + negativeScore);
  embedding[10] = positiveScore / total;
  embedding[11] = negativeScore / total;
  embedding[12] = Math.abs(positiveScore - negativeScore) / total; // Emotional intensity
  
  // Dimensions 13-20: Structural features
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  embedding[13] = Math.min(1, sentences.length / 20); // Sentence density
  embedding[14] = Math.min(1, tokens.length / 500); // Word density
  
  const avgSentenceLength = tokens.length / Math.max(1, sentences.length);
  embedding[15] = Math.min(1, avgSentenceLength / 30); // Avg sentence length
  
  const dialogueMatches = text.match(/[""][^""]+[""]/g) || [];
  embedding[16] = Math.min(1, dialogueMatches.length / 10); // Dialogue density
  
  const questionMarks = (text.match(/\?/g) || []).length;
  embedding[17] = Math.min(1, questionMarks / 5); // Question density
  
  const exclamationMarks = (text.match(/!/g) || []).length;
  embedding[18] = Math.min(1, exclamationMarks / 5); // Exclamation density
  
  // Dimensions 20-64: Hashed term features (for similarity)
  for (const token of tokens) {
    const hash = simpleHash(token) % (EMBEDDING_DIM - 20);
    embedding[20 + hash] += tf.get(token) || 0;
  }
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
};

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * Detect themes from text
 */
const detectThemes = (text: string): string[] => {
  const tokens = new Set(tokenize(text));
  const themes: string[] = [];
  
  for (const [category, terms] of Object.entries(SEMANTIC_CATEGORIES)) {
    const matchCount = terms.filter(term => tokens.has(term)).length;
    if (matchCount >= 2) {
      themes.push(category);
    }
  }
  
  return themes;
};

/**
 * Detect emotional tone
 */
const detectEmotionalTone = (text: string): SceneEmbedding['emotionalTone'] => {
  const tokens = tokenize(text);
  let positive = 0;
  let negative = 0;
  
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) positive++;
    if (NEGATIVE_WORDS.has(token)) negative++;
  }
  
  const total = positive + negative;
  if (total < 3) return 'neutral';
  
  const ratio = positive / total;
  if (ratio > 0.65) return 'positive';
  if (ratio < 0.35) return 'negative';
  if (total > 5) return 'mixed';
  return 'neutral';
};

/**
 * Extract key terms from text
 */
const extractKeyTerms = (text: string, maxTerms: number = 5): string[] => {
  const tf = calculateTF(tokenize(text));
  return Array.from(tf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed a single scene
 */
export const embedScene = (
  scene: Scene,
  text: string,
  chapterId: string
): SceneEmbedding => {
  const sceneText = text.slice(scene.startOffset, scene.endOffset);
  const wordCount = sceneText.split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    sceneId: scene.id,
    chapterId,
    embedding: generateEmbedding(sceneText),
    themes: detectThemes(sceneText),
    emotionalTone: detectEmotionalTone(sceneText),
    tensionLevel: scene.tension > 0.7 ? 'high' : scene.tension > 0.4 ? 'medium' : 'low',
    pacingCategory: scene.dialogueRatio > 0.5 ? 'fast' : scene.dialogueRatio < 0.2 ? 'slow' : 'moderate',
    keyTerms: extractKeyTerms(sceneText),
    metadata: {
      startOffset: scene.startOffset,
      endOffset: scene.endOffset,
      wordCount,
      dialogueRatio: scene.dialogueRatio,
    },
  };
};

/**
 * Embed all scenes in a structural fingerprint
 */
export const embedAllScenes = (
  structural: StructuralFingerprint,
  text: string,
  chapterId: string
): SceneEmbedding[] => {
  return structural.scenes.map(scene => embedScene(scene, text, chapterId));
};

/**
 * Calculate cosine similarity between two embeddings
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
};

/**
 * Embed a search query
 */
export const embedQuery = (query: string): number[] => {
  return generateEmbedding(query);
};

/**
 * Semantic search across scenes
 */
export const searchScenes = (
  query: string,
  sceneEmbeddings: SceneEmbedding[],
  options: SemanticSearchOptions = {}
): SemanticSearchResult[] => {
  const {
    minScore = 0.2,
    maxResults = 10,
    filterByTone,
    filterByTension,
    filterByPacing,
  } = options;
  
  const queryEmbedding = embedQuery(query);
  const queryTokens = new Set(tokenize(query));
  
  const results: SemanticSearchResult[] = [];
  
  for (const embedding of sceneEmbeddings) {
    // Apply filters
    if (filterByTone && embedding.emotionalTone !== filterByTone) continue;
    if (filterByTension && embedding.tensionLevel !== filterByTension) continue;
    if (filterByPacing && embedding.pacingCategory !== filterByPacing) continue;
    
    // Calculate similarity
    const semanticScore = cosineSimilarity(queryEmbedding, embedding.embedding);
    
    // Boost for exact term matches in themes/keyTerms
    let termBoost = 0;
    for (const theme of embedding.themes) {
      if (queryTokens.has(theme)) termBoost += 0.1;
    }
    for (const term of embedding.keyTerms) {
      if (queryTokens.has(term)) termBoost += 0.05;
    }
    
    const finalScore = Math.min(1, semanticScore + termBoost);
    
    if (finalScore >= minScore) {
      // Generate match reason
      const matchReasons: string[] = [];
      if (semanticScore > 0.3) matchReasons.push('semantic match');
      if (termBoost > 0) matchReasons.push(`keywords: ${embedding.keyTerms.filter(t => queryTokens.has(t)).join(', ')}`);
      if (embedding.themes.some(t => queryTokens.has(t))) {
        matchReasons.push(`themes: ${embedding.themes.filter(t => queryTokens.has(t)).join(', ')}`);
      }
      
      results.push({
        sceneId: embedding.sceneId,
        score: finalScore,
        embedding,
        matchReason: matchReasons.join('; ') || 'general relevance',
      });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Find scenes similar to a given scene
 */
export const findSimilarScenes = (
  targetSceneId: string,
  sceneEmbeddings: SceneEmbedding[],
  maxResults: number = 5
): SemanticSearchResult[] => {
  const target = sceneEmbeddings.find(e => e.sceneId === targetSceneId);
  if (!target) return [];
  
  return sceneEmbeddings
    .filter(e => e.sceneId !== targetSceneId)
    .map(e => ({
      sceneId: e.sceneId,
      score: cosineSimilarity(target.embedding, e.embedding),
      embedding: e,
      matchReason: `similar to scene ${targetSceneId}`,
    }))
    .filter(r => r.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Get scenes by theme
 */
export const getScenesByTheme = (
  theme: string,
  sceneEmbeddings: SceneEmbedding[]
): SceneEmbedding[] => {
  return sceneEmbeddings.filter(e => e.themes.includes(theme));
};

/**
 * Get scenes by emotional arc (transition patterns)
 */
export const analyzeEmotionalArc = (
  sceneEmbeddings: SceneEmbedding[]
): { sceneId: string; transition: string }[] => {
  const arc: { sceneId: string; transition: string }[] = [];
  
  for (let i = 1; i < sceneEmbeddings.length; i++) {
    const prev = sceneEmbeddings[i - 1];
    const curr = sceneEmbeddings[i];
    
    let transition = 'stable';
    if (prev.emotionalTone !== curr.emotionalTone) {
      transition = `${prev.emotionalTone} → ${curr.emotionalTone}`;
    }
    if (prev.tensionLevel !== curr.tensionLevel) {
      const tensionLevels = { low: 1, medium: 2, high: 3 };
      const prevLevel = tensionLevels[prev.tensionLevel];
      const currLevel = tensionLevels[curr.tensionLevel];
      transition = currLevel > prevLevel ? 'tension rising' : 'tension falling';
    }
    
    arc.push({ sceneId: curr.sceneId, transition });
  }
  
  return arc;
};
