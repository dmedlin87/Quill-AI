import { generateVoiceProfile } from '../intelligence/voiceProfiler';
import type { DialogueLine, VoiceMetrics, VoiceProfile } from '../../types/intelligence';
import { createMemory, getMemories, updateMemory } from './memoryService';
import type { MemoryNote } from './types';

const VOICE_PROFILE_TAG = 'voice_profile';

const normalizeCharacter = (name: string): string => name.trim().toLowerCase();

const weightedAverage = (prev: number, next: number, prevWeight: number, nextWeight: number): number => {
  const total = prevWeight + nextWeight;
  if (total === 0) return next;
  return (prev * prevWeight + next * nextWeight) / total;
};

const mergeVoiceMetrics = (existing: VoiceProfile, incoming: VoiceProfile): VoiceProfile => {
  const prevWeight = Math.max(existing.lineCount, 1);
  const nextWeight = Math.max(incoming.lineCount, 1);

  const mergeMetric = (key: keyof VoiceMetrics): number =>
    weightedAverage(existing.metrics[key], incoming.metrics[key], prevWeight, nextWeight);

  return {
    speakerName: existing.speakerName || incoming.speakerName,
    metrics: {
      avgSentenceLength: mergeMetric('avgSentenceLength'),
      sentenceVariance: mergeMetric('sentenceVariance'),
      contractionRatio: mergeMetric('contractionRatio'),
      questionRatio: mergeMetric('questionRatio'),
      exclamationRatio: mergeMetric('exclamationRatio'),
      latinateRatio: mergeMetric('latinateRatio'),
      uniqueWordCount: mergeMetric('uniqueWordCount'),
    },
    signatureWords: Array.from(new Set([...(existing.signatureWords || []), ...(incoming.signatureWords || [])])).slice(0, 7),
    impression: incoming.impression || existing.impression,
    lineCount: existing.lineCount + incoming.lineCount,
  };
};

const buildVoiceNoteText = (character: string, profile: VoiceProfile): string => {
  return `Voice profile for ${character}: ${profile.impression} — avg sentence length ${profile.metrics.avgSentenceLength.toFixed(1)}.`;
};

export async function getVoiceProfileForCharacter(
  projectId: string,
  characterName: string,
): Promise<VoiceProfile | null> {
  const normalized = normalizeCharacter(characterName);
  const notes = await getMemories({
    scope: 'project',
    projectId,
    topicTags: [VOICE_PROFILE_TAG, `character:${normalized}`],
    limit: 1,
  });

  if (!notes.length) return null;

  const profile = (notes[0].structuredContent as { voiceProfile?: VoiceProfile } | undefined)?.voiceProfile;
  return profile ?? null;
}

export async function upsertVoiceProfile(
  projectId: string,
  characterName: string,
  dialogueLines: DialogueLine[],
): Promise<VoiceProfile> {
  const normalized = normalizeCharacter(characterName);
  const incoming = generateVoiceProfile(dialogueLines, { speakerName: characterName });
  const existingNote = (
    await getMemories({
      scope: 'project',
      projectId,
      topicTags: [VOICE_PROFILE_TAG, `character:${normalized}`],
      limit: 1,
    })
  )[0];

  if (!existingNote) {
    const newNote: MemoryNote = {
      id: crypto.randomUUID(),
      scope: 'project',
      projectId,
      text: buildVoiceNoteText(characterName, incoming),
      type: 'observation',
      topicTags: [VOICE_PROFILE_TAG, `character:${normalized}`],
      importance: 0.55,
      createdAt: Date.now(),
      structuredContent: { voiceProfile: incoming },
    };

    await createMemory(newNote);
    return incoming;
  }

  const existingProfile = (existingNote.structuredContent as any)?.voiceProfile;
  const mergedProfile = existingProfile ? mergeVoiceMetrics(existingProfile, incoming) : incoming;

  await updateMemory(existingNote.id, {
    text: buildVoiceNoteText(characterName, mergedProfile),
    topicTags: existingNote.topicTags?.length
      ? Array.from(new Set([...existingNote.topicTags, VOICE_PROFILE_TAG, `character:${normalized}`]))
      : [VOICE_PROFILE_TAG, `character:${normalized}`],
    structuredContent: {
      ...(existingNote.structuredContent || {}),
      voiceProfile: mergedProfile,
    },
    scope: 'project',
    projectId,
  });

  return mergedProfile;
}

export { mergeVoiceMetrics };
