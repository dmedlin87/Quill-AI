import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getVoiceProfileForCharacter,
  upsertVoiceProfile,
  mergeVoiceMetrics
} from '../../../services/memory/voiceProfiles';
import { createMemory, getMemories, updateMemory } from '../../../services/memory/memoryService';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import type { VoiceProfile } from '../../../types/intelligence';

vi.mock('../../../services/memory/memoryService', () => ({
  createMemory: vi.fn(),
  getMemories: vi.fn(),
  updateMemory: vi.fn(),
}));

vi.mock('../../../services/intelligence/voiceProfiler', () => ({
  generateVoiceProfile: vi.fn(),
}));

describe('Voice Profiles Service', () => {
  const mockProjectId = 'proj-123';
  const mockCharacter = 'Bob';

  const mockProfile: VoiceProfile = {
    speakerName: 'Bob',
    impression: 'Calm',
    lineCount: 10,
    signatureWords: ['hmm', 'ah'],
    metrics: {
      avgSentenceLength: 10,
      sentenceVariance: 2,
      contractionRatio: 0.1,
      questionRatio: 0.2,
      exclamationRatio: 0.05,
      latinateRatio: 0.3,
      uniqueWordCount: 100,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVoiceProfileForCharacter', () => {
    it('should return null if no profile exists', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);

      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);

      expect(result).toBeNull();
      expect(getMemories).toHaveBeenCalledWith(expect.objectContaining({
        topicTags: expect.arrayContaining(['voice_profile', 'character:bob']),
      }));
    });

    it('should return profile from memory structured content', async () => {
      vi.mocked(getMemories).mockResolvedValue([{
        id: '1',
        text: 'Voice profile...',
        structuredContent: { voiceProfile: mockProfile }
      } as any]);

      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);

      expect(result).toEqual(mockProfile);
    });

    it('should return null if memory exists but has no profile data', async () => {
      vi.mocked(getMemories).mockResolvedValue([{
        id: '1',
        text: 'Voice profile...',
        structuredContent: {}
      } as any]);

      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);

      expect(result).toBeNull();
    });
  });

  describe('upsertVoiceProfile', () => {
    const dialogueLines = [{ speaker: 'Bob', quote: 'Hello.' }];

    beforeEach(() => {
      vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile);
    });

    it('should create a new memory if none exists', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);

      const result = await upsertVoiceProfile(mockProjectId, mockCharacter, dialogueLines);

      expect(result).toEqual(mockProfile);
      expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Voice profile for Bob'),
        topicTags: expect.arrayContaining(['voice_profile', 'character:bob']),
        structuredContent: { voiceProfile: mockProfile },
      }));
    });

    it('should update existing memory by merging profiles', async () => {
      const existingProfile = { ...mockProfile, lineCount: 10, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };
      const incomingProfile = { ...mockProfile, lineCount: 10, metrics: { ...mockProfile.metrics, avgSentenceLength: 40 } };

      vi.mocked(generateVoiceProfile).mockReturnValue(incomingProfile);

      vi.mocked(getMemories).mockResolvedValue([{
        id: '1',
        topicTags: ['voice_profile'],
        structuredContent: { voiceProfile: existingProfile }
      } as any]);

      const result = await upsertVoiceProfile(mockProjectId, mockCharacter, dialogueLines);

      // Weighted average: (20*10 + 40*10) / 20 = 30
      expect(result.metrics.avgSentenceLength).toBe(30);
      expect(result.lineCount).toBe(20);

      expect(updateMemory).toHaveBeenCalledWith('1', expect.objectContaining({
        structuredContent: expect.objectContaining({ voiceProfile: result }),
      }));
    });

    it('should handle merging when memory exists but structuredContent lacks voiceProfile', async () => {
       const incomingProfile = { ...mockProfile };
       vi.mocked(generateVoiceProfile).mockReturnValue(incomingProfile);

       vi.mocked(getMemories).mockResolvedValue([{
         id: '1',
         topicTags: ['voice_profile'],
         structuredContent: {}
       } as any]);

       const result = await upsertVoiceProfile(mockProjectId, mockCharacter, dialogueLines);

       expect(result.lineCount).toBe(mockProfile.lineCount * 2);
    });

    it('should handle existing memory with no tags', async () => {
      vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile);

      vi.mocked(getMemories).mockResolvedValue([{
        id: '1',
        // topicTags is undefined
        structuredContent: { voiceProfile: mockProfile }
      } as any]);

      await upsertVoiceProfile(mockProjectId, mockCharacter, dialogueLines);

      expect(updateMemory).toHaveBeenCalledWith('1', expect.objectContaining({
        topicTags: expect.arrayContaining(['voice_profile', 'character:bob']),
      }));
    });
  });

  describe('mergeVoiceMetrics', () => {
    it('should calculate weighted average correctly', () => {
        const p1 = { ...mockProfile, lineCount: 1, metrics: { ...mockProfile.metrics, avgSentenceLength: 10 } };
        const p2 = { ...mockProfile, lineCount: 9, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };

        const result = mergeVoiceMetrics(p1, p2);
        expect(result.metrics.avgSentenceLength).toBe(19);
    });

    it('should handle zero line counts gracefully', () => {
         const p1 = { ...mockProfile, lineCount: 0, metrics: { ...mockProfile.metrics, avgSentenceLength: 10 } };
         const p2 = { ...mockProfile, lineCount: 0, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };

         const result = mergeVoiceMetrics(p1, p2);
         expect(result.metrics.avgSentenceLength).toBe(15);
    });

    it('should handle missing optional fields', () => {
        const p1: VoiceProfile = {
            ...mockProfile,
            signatureWords: undefined,
            impression: undefined,
        };
        const p2: VoiceProfile = {
             ...mockProfile,
             signatureWords: undefined,
             impression: 'New Impression',
             speakerName: 'New Name'
        };

        const result = mergeVoiceMetrics(p1, p2);

        expect(result.signatureWords).toEqual([]);
        expect(result.impression).toBe('New Impression');
        expect(result.speakerName).toBe('Bob');
    });

    it('should use existing speaker name if new one is missing', () => {
        const p1 = { ...mockProfile, speakerName: 'Old Name' };
        const p2 = { ...mockProfile, speakerName: undefined };

        // @ts-ignore
        const result = mergeVoiceMetrics(p1, p2);
        expect(result.speakerName).toBe('Old Name');
    });

    it('should merge signature words with duplicates', () => {
      const p1: VoiceProfile = {
        ...mockProfile,
        signatureWords: ['word1', 'word2'],
      };
      const p2: VoiceProfile = {
        ...mockProfile,
        signatureWords: ['word2', 'word3'],
      };

      const result = mergeVoiceMetrics(p1, p2);
      expect(result.signatureWords).toEqual(['word1', 'word2', 'word3']);
    });
  });
});
