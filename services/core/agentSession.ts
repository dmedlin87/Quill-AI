import type { Chat } from '@google/genai';
import type { Persona } from '@/types/personas';
import type { AgentContextInput, MemoryProvider } from './AgentController';
import { createAgentSession } from '@/services/gemini/agent';
import {
  getActiveGoals,
  formatMemoriesForPrompt,
  formatGoalsForPrompt,
} from '@/services/memory';
import { getMemoriesForContext } from '@/services/memory/memoryQueries';
import { searchBedsideHistory, type BedsideHistoryMatch } from '@/services/memory/bedsideHistorySearch';

export const buildManuscriptContext = (
  chapters: AgentContextInput['chapters'],
  fullText: string,
  activeChapterId?: string | null,
): string =>
  chapters
    .map(chapter => {
      const isActive = activeChapterId ? chapter.id === activeChapterId : chapter.content === fullText;
      return `[CHAPTER: ${chapter.title}]${
        isActive
          ? ' (ACTIVE - You can edit this)'
          : ' (READ ONLY - Request user to switch)'
      }\n${chapter.content}\n`;
    })
    .join('\n-------------------\n');

export const buildMemoryContext = async (
  memoryProvider?: MemoryProvider,
  projectId?: string | null,
): Promise<string> => {
  if (!memoryProvider || !projectId) {
    return '';
  }

  try {
    return await memoryProvider.buildMemoryContext(projectId);
  } catch (error) {
    console.warn('[AgentSession] Failed to fetch memory context:', error);
    return '';
  }
};

/**
 * Fetch long-term memory context from BedsideHistorySearch.
 * Returns thematic insights, character arcs, and historical context.
 */
export const fetchBedsideHistoryContext = async (
  projectId: string,
  options: { query?: string; limit?: number } = {},
): Promise<{ matches: BedsideHistoryMatch[]; formatted: string }> => {
  const { query = 'themes character arcs plot developments conflicts', limit = 5 } = options;

  try {
    const matches = await searchBedsideHistory(projectId, query, { limit });

    if (matches.length === 0) {
      return { matches: [], formatted: '' };
    }

    const lines: string[] = ['## Long-Term Memory (Bedside Notes)'];
    for (const match of matches) {
      const relevance = Math.round(match.similarity * 100);
      const date = new Date(match.note.createdAt).toISOString().slice(0, 10);
      lines.push(`- [${relevance}% match, ${date}]: ${match.note.text.slice(0, 200)}${match.note.text.length > 200 ? '...' : ''}`);
    }

    return { matches, formatted: lines.join('\n') };
  } catch (error) {
    console.warn('[AgentSession] Failed to fetch bedside history:', error);
    return { matches: [], formatted: '' };
  }
};

export const fetchMemoryContext = async (projectId: string): Promise<string> => {
  try {
    const [memories, goals, bedsideHistory] = await Promise.all([
      getMemoriesForContext(projectId, { limit: 25 }),
      getActiveGoals(projectId),
      fetchBedsideHistoryContext(projectId),
    ]);

    let memorySection = '[AGENT MEMORY]\n';

    // Add long-term bedside history context first (most relevant)
    if (bedsideHistory.formatted) {
      memorySection += bedsideHistory.formatted + '\n\n';
    }

    const formattedMemories = formatMemoriesForPrompt(memories, { maxLength: 3000 });
    if (formattedMemories) {
      memorySection += formattedMemories + '\n';
    } else if (!bedsideHistory.formatted) {
      memorySection += '(No stored memories yet.)\n';
    }

    const formattedGoals = formatGoalsForPrompt(goals);
    if (formattedGoals) {
      memorySection += '\n' + formattedGoals + '\n';
    }

    return memorySection;
  } catch (error) {
    console.warn('[AgentSession] Failed to fetch default memory context:', error);
    return '';
  }
};

export const buildInitializationMessage = ({
  chapters,
  fullText,
  memoryContext,
  persona,
}: {
  chapters: AgentContextInput['chapters'];
  fullText: string;
  memoryContext: string;
  persona: Persona;
}): string =>
  `I have loaded the manuscript. Total Chapters: ${chapters.length}. ` +
  `Active Chapter Length: ${fullText.length} characters. ` +
  `${memoryContext ? 'Memory loaded.' : 'No memories yet.'} ` +
  `I am ${persona.name}, ready to help with my ${persona.role} expertise.`;

export const createChatSessionFromContext = async ({
  context,
  persona,
  memoryProvider,
  projectId,
}: {
  context: AgentContextInput;
  persona: Persona;
  memoryProvider?: MemoryProvider;
  projectId?: string | null;
}): Promise<{ chat: Chat; memoryContext: string }> => {
  const fullManuscriptContext = buildManuscriptContext(
    context.chapters,
    context.fullText,
    context.activeChapterId ?? null,
  );
  const resolvedProjectId = projectId ?? context.projectId ?? null;
  const memoryContext = memoryProvider
    ? await buildMemoryContext(memoryProvider, resolvedProjectId)
    : resolvedProjectId
      ? await fetchMemoryContext(resolvedProjectId)
      : '';

  const chat = createAgentSession({
    lore: context.lore,
    analysis: context.analysis || undefined,
    fullManuscriptContext,
    persona,
    intensity: context.critiqueIntensity,
    experience: context.experienceLevel,
    autonomy: context.autonomyMode,
    intelligenceHUD: context.intelligenceHUD,
    interviewTarget: context.interviewTarget,
    memoryContext,
  });

  return { chat, memoryContext };
};
