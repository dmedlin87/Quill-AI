import type { MemoryNote } from './types';
import { getMemories } from './memoryQueries';

export interface MemoryRelevanceOptions {
  /** Names of currently active entities (characters, locations) */
  activeEntityNames?: string[];
  /** Keywords from current selection or query */
  selectionKeywords?: string[];
  /** Boost memories related to the active chapter */
  activeChapterId?: string;
}

export function scoreMemoryRelevance(
  note: MemoryNote,
  relevance: MemoryRelevanceOptions
): number {
  const {
    activeEntityNames = [],
    selectionKeywords = [],
    activeChapterId,
  } = relevance;
  const normalizedEntities = activeEntityNames.map(e => e.toLowerCase());
  const normalizedKeywords = selectionKeywords.map(k => k.toLowerCase());
  const normalizedActiveChapter = activeChapterId?.toLowerCase();

  let relevanceScore = 0;

  for (const tag of note.topicTags) {
    const normalizedTag = tag.toLowerCase();
    const tagName = normalizedTag.includes(':')
      ? normalizedTag.split(':')[1]
      : normalizedTag;

    if (
      normalizedActiveChapter &&
      (tagName.includes(normalizedActiveChapter) ||
        normalizedTag.includes(normalizedActiveChapter))
    ) {
      relevanceScore += 2.5;
    }

    if (
      normalizedEntities.some(
        entity => entity.includes(tagName) || tagName.includes(entity)
      )
    ) {
      relevanceScore += 2;
    }
  }

  const normalizedText = note.text.toLowerCase();
  for (const keyword of normalizedKeywords) {
    if (normalizedText.includes(keyword)) {
      relevanceScore += 1;
    }
  }

  relevanceScore += note.importance;

  return relevanceScore;
}

export async function getRelevantMemoriesForContext(
  projectId: string,
  relevance: MemoryRelevanceOptions = {},
  options: { limit?: number } = {}
): Promise<{ author: MemoryNote[]; project: MemoryNote[] }> {
  const { limit = 50 } = options;

  const authorNotes = await getMemories({ scope: 'author', limit });
  const allProjectNotes = await getMemories({ scope: 'project', projectId });

  if (
    (relevance.activeEntityNames?.length ?? 0) === 0 &&
    (relevance.selectionKeywords?.length ?? 0) === 0
  ) {
    return {
      author: authorNotes,
      project: allProjectNotes.slice(0, limit),
    };
  }

  const scoredNotes = allProjectNotes.map(note => ({
    note,
    relevanceScore: scoreMemoryRelevance(note, relevance),
  }));

  let relevantNotes = scoredNotes.filter(s => s.relevanceScore > 0);

  if (relevantNotes.length === 0) {
    relevantNotes = scoredNotes;
  }

  relevantNotes.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    if (b.note.importance !== a.note.importance) {
      return b.note.importance - a.note.importance;
    }
    return b.note.createdAt - a.note.createdAt;
  });

  return {
    author: authorNotes,
    project: relevantNotes.slice(0, limit).map(s => s.note),
  };
}
