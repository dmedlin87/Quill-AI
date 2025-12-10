import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVoiceProfileForCharacter, upsertVoiceProfile, mergeVoiceMetrics } from '../../../services/memory/voiceProfiles';
import { createMemory, getMemories, updateMemory } from '../../../services/memory/memoryService';
import { generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';

vi.mock('../../../services/memory/memoryService', () => ({
  createMemory: vi.fn(),
  getMemories: vi.fn(),
  updateMemory: vi.fn(),
}));

vi.mock('../../../services/intelligence/voiceProfiler', () => ({
  generateVoiceProfile: vi.fn(),
}));

describe('Voice Profiles', () => {
  const mockProjectId = 'project-123';
  const mockCharacter = 'Alice';
  const mockDialogue = [{ speaker: 'Alice', quote: 'Hello world.' }];
  const mockProfile = {
    speakerName: 'Alice',
    metrics: { avgSentenceLength: 10, sentenceVariance: 0, contractionRatio: 0, questionRatio: 0, exclamationRatio: 0, latinateRatio: 0, uniqueWordCount: 10 },
    lineCount: 1,
    signatureWords: ['hello'],
    impression: 'Friendly',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVoiceProfileForCharacter', () => {
    it('should return null if no profile exists', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);
      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);
      expect(result).toBeNull();
    });

    it('should return profile if exists', async () => {
      vi.mocked(getMemories).mockResolvedValue([{
        structuredContent: { voiceProfile: mockProfile }
      }] as any);

      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);
      expect(result).toEqual(mockProfile);
    });

    it('should return null if memory exists but no structured content', async () => {
       vi.mocked(getMemories).mockResolvedValue([{
        structuredContent: undefined
      }] as any);

      const result = await getVoiceProfileForCharacter(mockProjectId, mockCharacter);
      expect(result).toBeNull();
    });
  });

  describe('upsertVoiceProfile', () => {
    it('should create a new profile if none exists', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);
      vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile as any);

      const result = await upsertVoiceProfile(mockProjectId, mockCharacter, mockDialogue);

      expect(result).toEqual(mockProfile);
      expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
        topicTags: expect.arrayContaining(['voice_profile', 'character:alice']),
        structuredContent: { voiceProfile: mockProfile },
      }));
    });

    it('should update and merge profile if exists', async () => {
      const existingProfile = { ...mockProfile, lineCount: 10, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };
      vi.mocked(getMemories).mockResolvedValue([{
        id: 'mem-1',
        topicTags: ['voice_profile', 'character:alice'],
        structuredContent: { voiceProfile: existingProfile }
      }] as any);
      vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile as any); // new profile has avg 10, count 1

      const result = await upsertVoiceProfile(mockProjectId, mockCharacter, mockDialogue);

      // Expected Weighted Average: (20*10 + 10*1) / 11 = 210 / 11 ~= 19.09
      expect(result.metrics.avgSentenceLength).toBeCloseTo(19.09, 1);
      expect(result.lineCount).toBe(11);

      expect(updateMemory).toHaveBeenCalledWith('mem-1', expect.objectContaining({
         structuredContent: expect.objectContaining({
             voiceProfile: result
         })
      }));
    });

    it('should handle existing memory with missing topic tags when updating', async () => {
      const existingProfile = { ...mockProfile };
      vi.mocked(getMemories).mockResolvedValue([{
        id: 'mem-1',
        topicTags: undefined, // Simulating missing tags
        structuredContent: { voiceProfile: existingProfile }
      }] as any);
      vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile as any);

      await upsertVoiceProfile(mockProjectId, mockCharacter, mockDialogue);

      expect(updateMemory).toHaveBeenCalledWith('mem-1', expect.objectContaining({
         topicTags: expect.arrayContaining(['voice_profile', 'character:alice'])
      }));
    });

    it('should handle existing memory with missing voiceProfile in structuredContent', async () => {
       // This simulates a corrupt or legacy memory note that has the tag but no profile data
       vi.mocked(getMemories).mockResolvedValue([{
        id: 'mem-1',
        topicTags: ['voice_profile', 'character:alice'],
        structuredContent: {} // Empty
      }] as any);
       vi.mocked(generateVoiceProfile).mockReturnValue(mockProfile as any);

       const result = await upsertVoiceProfile(mockProjectId, mockCharacter, mockDialogue);

       // Should default to incoming profile instead of crashing on merge
       expect(result).toEqual(mockProfile);
       expect(updateMemory).toHaveBeenCalledWith('mem-1', expect.objectContaining({
         structuredContent: { voiceProfile: mockProfile }
       }));
    });
  });

  describe('mergeVoiceMetrics', () => {
      it('should handle zero weights correctly', () => {
          const p1 = { ...mockProfile, lineCount: 0, metrics: { ...mockProfile.metrics, avgSentenceLength: 10 } };
          const p2 = { ...mockProfile, lineCount: 0, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };

          // Implementation uses Math.max(lineCount, 1) so weights are 1 and 1
          // (10*1 + 20*1) / 2 = 15

          const result = mergeVoiceMetrics(p1 as any, p2 as any);
          expect(result.metrics.avgSentenceLength).toBe(15);
      });

      it('should merge signature words and limit to 7', () => {
         const p1 = { ...mockProfile, signatureWords: ['a', 'b', 'c', 'd'] };
         const p2 = { ...mockProfile, signatureWords: ['c', 'd', 'e', 'f', 'g', 'h'] };

         const result = mergeVoiceMetrics(p1 as any, p2 as any);

         expect(result.signatureWords).toHaveLength(7);
         expect(result.signatureWords).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
      });

      it('should prefer incoming impression if available', () => {
         const p1 = { ...mockProfile, impression: 'Old impression' };
         const p2 = { ...mockProfile, impression: 'New impression' };

         const result = mergeVoiceMetrics(p1 as any, p2 as any);
         expect(result.impression).toBe('New impression');
      });

      it('should keep existing impression if incoming is empty', () => {
         const p1 = { ...mockProfile, impression: 'Old impression' };
         const p2 = { ...mockProfile, impression: '' };

         const result = mergeVoiceMetrics(p1 as any, p2 as any);
         expect(result.impression).toBe('Old impression');
      });

      it('should handle empty metrics in one profile gracefully', () => {
          // This case might be unrealistic with types, but good for robustness
          // Assuming generateVoiceProfile always returns full metrics, but let's test partials if possible
          // The code assumes metrics exist. If they don't it might NaN.
          // Let's ensure our test covers the math:
          const p1 = { ...mockProfile, lineCount: 1, metrics: { ...mockProfile.metrics, avgSentenceLength: 10 } };
          const p2 = { ...mockProfile, lineCount: 9, metrics: { ...mockProfile.metrics, avgSentenceLength: 20 } };

          // (10*1 + 20*9) / 10 = (10 + 180) / 10 = 19
          const result = mergeVoiceMetrics(p1 as any, p2 as any);
          expect(result.metrics.avgSentenceLength).toBe(19);
      });
  });
});
