import { db } from '../db';
import { cosineSimilarity, generateMemoryEmbedding } from './semanticDedup';
import { BEDSIDE_NOTE_TAG, MemoryNote } from './types';
import { embedBedsideNoteText } from './bedsideEmbeddings';

export interface SearchBedsideHistoryOptions {
  arcId?: string;
  chapterId?: string;
  limit?: number;
  /** Only consider versions created at or before this timestamp (epoch ms) */
  asOf?: number;
}

export interface BedsideHistoryMatch {
  note: MemoryNote;
  similarity: number;
}

const matchesScope = (note: MemoryNote, projectId: string, options: SearchBedsideHistoryOptions): boolean => {
  if (note.scope !== 'project' || note.projectId !== projectId) return false;
  if (!note.topicTags.includes(BEDSIDE_NOTE_TAG)) return false;
  if (options.arcId && !note.topicTags.includes(`arc:${options.arcId}`)) return false;
  if (options.chapterId && !note.topicTags.includes(`chapter:${options.chapterId}`)) return false;
  if (options.asOf && note.createdAt > options.asOf) return false;
  return true;
};

export const searchBedsideHistory = async (
  projectId: string,
  query: string,
  options: SearchBedsideHistoryOptions = {},
): Promise<BedsideHistoryMatch[]> => {
  const limit = options.limit ?? 5;
  const queryEmbedding = await embedBedsideNoteText(query);

  const candidateNotes = await db.memories
    .filter(note => matchesScope(note, projectId, options))
    .toArray();

  const scored = candidateNotes
    .map(note => {
      const noteEmbedding = note.embedding ?? generateMemoryEmbedding(note.text);
      const similarity = cosineSimilarity(queryEmbedding, noteEmbedding);
      return { note, similarity };
    })
    .sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      return b.note.createdAt - a.note.createdAt;
    });

  return limit > 0 ? scored.slice(0, limit) : scored;
};
