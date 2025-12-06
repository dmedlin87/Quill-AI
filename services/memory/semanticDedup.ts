/**
 * Semantic Deduplication (Enhancement 3A)
 * 
 * Uses lightweight embeddings to detect semantically similar memories,
 * preventing near-duplicates like "Sarah has blue eyes" vs "Sarah's eyes are blue".
 */

import { MemoryNote, type MemoryEmbedding } from './types';
import { getMemories } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticDuplicateResult {
  isDuplicate: boolean;
  similarNote?: MemoryNote;
  similarity: number;
  reason?: string;
}

export interface SemanticMemoryEmbedding {
  memoryId: string;
  embedding: number[];
  keyTerms: string[];
  entityMentions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

const stopWords = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'and', 'but', 'or', 'so', 'if', 'then', 'than', 'that', 'which', 'who',
  'this', 'these', 'those', 'it', 'its',
]);

/**
 * Tokenize and normalize text for embedding
 */
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
};

/**
 * Extract potential entity mentions (capitalized words in original text)
 */
const extractEntities = (text: string): string[] => {
  const matches = text.match(/\b[A-Z][a-z]+\b/g) || [];
  return [...new Set(matches)];
};

/**
 * Extract key terms using TF heuristic
 */
const extractKeyTerms = (tokens: string[], maxTerms: number = 5): string[] => {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
};

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 32; // Lightweight for fast comparison

/**
 * Generate a lightweight embedding for memory text
 * Uses bag-of-words with hashing for speed
 */
export const generateMemoryEmbedding = (text: string): MemoryEmbedding => {
  const tokens = tokenize(text);
  const embedding = new Array(EMBEDDING_DIM).fill(0);
  
  // Hash tokens into embedding dimensions
  for (const token of tokens) {
    const hash = simpleHash(token);
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    embedding[idx] += 1;
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding as MemoryEmbedding;
};

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
};

/**
 * Prefer stored embeddings when available to avoid recomputation.
 */
const getEmbeddingVector = (
  note: Pick<MemoryNote, 'text' | 'embedding'>
): MemoryEmbedding => {
  if (Array.isArray(note.embedding) && note.embedding.length === EMBEDDING_DIM) {
    return note.embedding;
  }
  return generateMemoryEmbedding(note.text);
};

/**
 * Calculate cosine similarity between embeddings
 */
export const cosineSimilarity = (
  a: MemoryEmbedding,
  b: MemoryEmbedding,
): number => {
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

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY-AWARE SIMILARITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate entity overlap between two texts
 */
const entityOverlap = (entities1: string[], entities2: string[]): number => {
  if (entities1.length === 0 || entities2.length === 0) return 0;
  
  const set1 = new Set(entities1.map(e => e.toLowerCase()));
  const set2 = new Set(entities2.map(e => e.toLowerCase()));
  
  const intersection = new Set([...set1].filter(e => set2.has(e)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};

/**
 * Calculate tag overlap between memories
 */
const tagOverlap = (tags1: string[], tags2: string[]): number => {
  if (tags1.length === 0 && tags2.length === 0) return 1;
  if (tags1.length === 0 || tags2.length === 0) return 0;
  
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);
  
  const intersection = new Set([...set1].filter(t => set2.has(t)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DEDUPLICATION API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a new memory is semantically duplicate of existing ones
 */
export const isSemanticDuplicate = async (
  projectId: string,
  newText: string,
  newTags: string[],
  options: {
    similarityThreshold?: number;
    entityWeight?: number;
    tagWeight?: number;
    limit?: number;
  } = {}
): Promise<SemanticDuplicateResult> => {
  const {
    similarityThreshold = 0.75,
    entityWeight = 0.2,
    tagWeight = 0.15,
    limit = 100,
  } = options;
  
  // Get existing memories
  const existing = await getMemories({
    scope: 'project',
    projectId,
    limit,
  });
  
  if (existing.length === 0) {
    return { isDuplicate: false, similarity: 0 };
  }
  
  // Generate embedding for new text
  const newEmbedding = generateMemoryEmbedding(newText);
  const newEntities = extractEntities(newText);
  
  let highestSimilarity = 0;
  let mostSimilar: MemoryNote | undefined;
  let matchReason: string | undefined;
  
  for (const note of existing) {
    // Calculate embedding similarity
    const noteEmbedding = getEmbeddingVector(note);
    const embeddingSim = cosineSimilarity(newEmbedding, noteEmbedding);
    
    // Calculate entity similarity
    const noteEntities = extractEntities(note.text);
    const entitySim = entityOverlap(newEntities, noteEntities);
    
    // Calculate tag similarity
    const tagSim = tagOverlap(newTags, note.topicTags);
    
    // Weighted combination
    const semanticWeight = 1 - entityWeight - tagWeight;
    const combinedSimilarity = 
      embeddingSim * semanticWeight +
      entitySim * entityWeight +
      tagSim * tagWeight;
    
    if (combinedSimilarity > highestSimilarity) {
      highestSimilarity = combinedSimilarity;
      mostSimilar = note;
      
      // Determine reason
      if (entitySim > 0.5 && embeddingSim > 0.5) {
        matchReason = 'Same entities with similar content';
      } else if (tagSim > 0.5) {
        matchReason = 'Similar tags with overlapping content';
      } else {
        matchReason = 'Semantic similarity';
      }
    }
  }
  
  return {
    isDuplicate: highestSimilarity >= similarityThreshold,
    similarNote: highestSimilarity >= similarityThreshold ? mostSimilar : undefined,
    similarity: highestSimilarity,
    reason: matchReason,
  };
};

/**
 * Find all memories similar to given text
 */
export const findSimilarMemories = async (
  projectId: string,
  text: string,
  options: {
    minSimilarity?: number;
    maxResults?: number;
  } = {}
): Promise<Array<{ note: MemoryNote; similarity: number }>> => {
  const { minSimilarity = 0.3, maxResults = 10 } = options;
  
  const existing = await getMemories({
    scope: 'project',
    projectId,
    limit: 200,
  });
  
  const queryEmbedding = generateMemoryEmbedding(text);
  const queryEntities = extractEntities(text);
  
  const results: Array<{ note: MemoryNote; similarity: number }> = [];
  
  for (const note of existing) {
    const noteEmbedding = getEmbeddingVector(note);
    const embeddingSim = cosineSimilarity(queryEmbedding, noteEmbedding);
    
    const noteEntities = extractEntities(note.text);
    const entitySim = entityOverlap(queryEntities, noteEntities);
    
    const similarity = embeddingSim * 0.7 + entitySim * 0.3;
    
    if (similarity >= minSimilarity) {
      results.push({ note, similarity });
    }
  }
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
};

/**
 * Suggest memory to merge with when duplicate found
 */
export const suggestMerge = (
  newText: string,
  existingNote: MemoryNote
): { shouldMerge: boolean; mergedText?: string; reason: string } => {
  const newTokens = new Set(tokenize(newText));
  const existingTokens = new Set(tokenize(existingNote.text));
  
  // Check if new text adds new information
  const newOnlyTokens = [...newTokens].filter(t => !existingTokens.has(t));
  const existingOnlyTokens = [...existingTokens].filter(t => !newTokens.has(t));
  
  if (newOnlyTokens.length < 3 && existingOnlyTokens.length < 3) {
    // Very similar, keep existing
    return {
      shouldMerge: false,
      reason: 'New memory is too similar to existing - skipping',
    };
  }
  
  if (newOnlyTokens.length > 5 && newText.length > existingNote.text.length) {
    // New text has significant new info, consider merging
    return {
      shouldMerge: true,
      mergedText: newText.length > existingNote.text.length ? newText : existingNote.text,
      reason: 'New memory has additional details - suggesting update',
    };
  }
  
  return {
    shouldMerge: false,
    reason: 'Memories are similar but serve different purposes',
  };
};
