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

export const buildManuscriptContext = (
  chapters: AgentContextInput['chapters'],
  fullText: string,
): string =>
  chapters
    .map(chapter => {
      const isActive = chapter.content === fullText;
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
 * Default memory builder used by the UI hook (pulls from memory service).
 * Kept here so AgentController consumers can share the logic.
 */
export const fetchMemoryContext = async (projectId: string): Promise<string> => {
  const [memories, goals] = await Promise.all([
    getMemoriesForContext(projectId, { limit: 25 }),
    getActiveGoals(projectId),
  ]);

  let memorySection = '[AGENT MEMORY]\n';

  const formattedMemories = formatMemoriesForPrompt(memories, { maxLength: 3000 });
  if (formattedMemories) {
    memorySection += formattedMemories + '\n';
  } else {
    memorySection += '(No stored memories yet.)\n';
  }

  const formattedGoals = formatGoalsForPrompt(goals);
  if (formattedGoals) {
    memorySection += '\n' + formattedGoals + '\n';
  }

  return memorySection;
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
  const fullManuscriptContext = buildManuscriptContext(context.chapters, context.fullText);
  const memoryContext = await buildMemoryContext(
    memoryProvider,
    projectId ?? context.projectId ?? null,
  );

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
