import { ai } from '../gemini/client';
import { ModelConfig } from '../../config/models';
import { applyBedsideNoteMutation } from './bedsideNoteMutations';
import { getOrCreateBedsideNote } from './chains';
import { createMemory, deleteMemory, getMemories } from './index';
import type { MemoryNote } from './types';

const EPISODIC_TAG = 'episodic';
const NARRATIVE_TAG = 'narrative_arc';

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    const abortError = new Error('Dreaming aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }
};

interface DreamingSummaryPayload {
  title?: string;
  summary?: string;
  tags?: string[];
  answeredQuestions?: string[];
}

const DEFAULT_SUMMARY_FALLBACK = 'Recent edits were consolidated into a narrative checkpoint.';

const buildSummaryPrompt = (
  episodicMemories: MemoryNote[],
  openQuestions: string[],
): string => {
  const memoryLines = episodicMemories
    .map((memory, index) => `${index + 1}. ${memory.text}`)
    .join('\n');

  const questionsBlock = openQuestions.length
    ? `OPEN QUESTIONS (mark any that are now clearly answered):\n- ${openQuestions.join('\n- ')}`
    : 'No outstanding questions recorded.';

  return `You are Quill's background consolidator. Compress the recent episodic micro-memories into a concise narrative arc summary.\n\nRECENT EPISODIC ENTRIES:\n${memoryLines}\n\n${questionsBlock}\n\nRespond in JSON with keys: title (short), summary (2-3 sentences), tags (array of 1-3 concise tags), answeredQuestions (array of the question strings that are answered).`;
};

const parseDreamingResponse = (raw: string): DreamingSummaryPayload => {
  try {
    const trimmed = raw.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const toParse = jsonMatch ? jsonMatch[0] : trimmed;
    const parsed = JSON.parse(toParse);
    return {
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag: unknown) => typeof tag === 'string') : undefined,
      answeredQuestions: Array.isArray(parsed.answeredQuestions)
        ? parsed.answeredQuestions.filter((q: unknown) => typeof q === 'string')
        : undefined,
    };
  } catch (error) {
    console.warn('[Dreaming] Failed to parse LLM response, using fallback', error);
    return {};
  }
};

async function summarizeEpisodicMemories(
  episodicMemories: MemoryNote[],
  openQuestions: string[],
  signal?: AbortSignal,
): Promise<DreamingSummaryPayload> {
  throwIfAborted(signal);

  const prompt = buildSummaryPrompt(episodicMemories, openQuestions);
  const response = await ai.models.generateContent({
    model: ModelConfig.agent,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 },
  });

  throwIfAborted(signal);

  const text = response?.response?.text?.() ?? '';
  return parseDreamingResponse(text);
}

const filterRecentEpisodicMemories = async (
  projectId: string,
  limit = 25,
  maxAgeMs = 1000 * 60 * 60,
): Promise<MemoryNote[]> => {
  const now = Date.now();
  const memories = await getMemories({
    scope: 'project',
    projectId,
    limit: 250,
  });

  return memories
    .filter(memory => memory.topicTags.some(tag => tag.toLowerCase().includes(EPISODIC_TAG)))
    .filter(memory => now - (memory.updatedAt || memory.createdAt) <= maxAgeMs)
    .sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt))
    .slice(-limit);
};

const archiveAnsweredQuestions = async (
  projectId: string,
  answeredQuestions: string[] | undefined,
): Promise<void> => {
  if (!answeredQuestions || answeredQuestions.length === 0) return;

  try {
    await applyBedsideNoteMutation(projectId, {
      section: 'openQuestions',
      action: 'remove',
      content: answeredQuestions,
    });
  } catch (error) {
    console.warn('[Dreaming] Failed to archive bedside questions', error);
  }
};

const persistNarrativeMemory = async (
  projectId: string,
  summary: DreamingSummaryPayload,
  episodicMemories: MemoryNote[],
): Promise<void> => {
  const title = summary.title?.trim();
  const baseText = summary.summary?.trim() || DEFAULT_SUMMARY_FALLBACK;
  const tags = new Set<string>([NARRATIVE_TAG, 'episodic_rollup']);
  summary.tags?.forEach(tag => tags.add(tag.trim()));

  const importance = Math.min(1, Math.max(0.5, episodicMemories.reduce((acc, mem) => acc + mem.importance, 0) / episodicMemories.length));

  const text = title ? `${title}: ${baseText}` : baseText;

  await createMemory({
    scope: 'project',
    projectId,
    text,
    type: 'observation',
    topicTags: Array.from(tags),
    importance,
  });
};

const deleteEpisodicMemories = async (episodicMemories: MemoryNote[]): Promise<void> => {
  await Promise.all(episodicMemories.map(memory => deleteMemory(memory.id)));
};

export const runDreamingCycle = async (
  projectId: string,
  signal?: AbortSignal,
): Promise<{ summarized: number; removed: number }> => {
  const episodicMemories = await filterRecentEpisodicMemories(projectId);
  if (episodicMemories.length === 0) {
    return { summarized: 0, removed: 0 };
  }

  const bedsideNote = await getOrCreateBedsideNote(projectId);
  const openQuestions = (bedsideNote.structuredContent as { openQuestions?: string[] } | undefined)?.openQuestions || [];

  const summary = await summarizeEpisodicMemories(episodicMemories, openQuestions, signal);
  throwIfAborted(signal);

  await persistNarrativeMemory(projectId, summary, episodicMemories);
  await archiveAnsweredQuestions(projectId, summary.answeredQuestions);

  throwIfAborted(signal);

  await deleteEpisodicMemories(episodicMemories);

  return { summarized: 1, removed: episodicMemories.length };
};
