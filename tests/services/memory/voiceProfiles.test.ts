import { describe, expect, it } from 'vitest';
import { mergeVoiceMetrics } from '@/services/memory/voiceProfiles';
import type { VoiceProfile } from '@/types/intelligence';

const buildProfile = (overrides: Partial<VoiceProfile> = {}): VoiceProfile => ({
  speakerName: 'Test',
  metrics: {
    avgSentenceLength: 10,
    sentenceVariance: 2,
    contractionRatio: 0.1,
    questionRatio: 0.1,
    exclamationRatio: 0.05,
    latinateRatio: 0.2,
    uniqueWordCount: 50,
  },
  signatureWords: ['gruff'],
  impression: 'Balanced',
  lineCount: 5,
  ...overrides,
});

describe('voiceProfiles', () => {
  it('merges voice metrics with weighted averages', () => {
    const baseline = buildProfile();
    const incoming = buildProfile({
      metrics: {
        avgSentenceLength: 20,
        sentenceVariance: 5,
        contractionRatio: 0.05,
        questionRatio: 0.2,
        exclamationRatio: 0.1,
        latinateRatio: 0.4,
        uniqueWordCount: 80,
      },
      lineCount: 10,
    });

    const merged = mergeVoiceMetrics(baseline, incoming);

    expect(merged.metrics.avgSentenceLength).toBeCloseTo(16.67, 1);
    expect(merged.metrics.latinateRatio).toBeCloseTo(0.33, 2);
    expect(merged.lineCount).toBe(15);
  });

  it('keeps union of signature words', () => {
    const merged = mergeVoiceMetrics(
      buildProfile({ signatureWords: ['gruff', 'short'] }),
      buildProfile({ signatureWords: ['eloquent', 'vivid'], lineCount: 1 }),
    );

    expect(merged.signatureWords).toEqual(expect.arrayContaining(['gruff', 'eloquent']));
  });
});
