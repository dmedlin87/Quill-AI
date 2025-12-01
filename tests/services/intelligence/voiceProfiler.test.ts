import { describe, it, expect } from 'vitest';
import { analyzeVoices, generateVoiceProfile } from '../../../services/intelligence/voiceProfiler';
import type { DialogueLine } from '../../../types/intelligence';

const makeLinesForSpeaker = (speaker: string, quotes: string[]): DialogueLine[] =>
  quotes.map((quote, index) => ({ speaker, quote, offset: index * 10 } as any));

describe('voiceProfiler - generateVoiceProfile', () => {
  it('builds profile with metrics and impression', () => {
    const lines = makeLinesForSpeaker('Alice', [
      "I can't believe this is happening!",
      "We should probably reconsider our options.",
    ]);

    const profile = generateVoiceProfile(lines, { speakerName: 'Alice' });

    expect(profile.speakerName).toBe('Alice');
    expect(profile.metrics.avgSentenceLength).toBeGreaterThan(0);
    expect(profile.metrics.uniqueWordCount).toBeGreaterThan(0);
    expect(profile.impression.length).toBeGreaterThan(0);
    expect(profile.lineCount).toBe(lines.length);
  });

  it('falls back to Unknown when no speaker provided', () => {
    const lines = makeLinesForSpeaker('', ['Hello there.']);
    const profile = generateVoiceProfile(lines);
    expect(profile.speakerName).toBe('Unknown');
  });

  it('handles empty lines array safely', () => {
    const profile = generateVoiceProfile([]);
    expect(profile.speakerName).toBe('Unknown');
    expect(profile.metrics.avgSentenceLength).toBe(0);
    expect(profile.metrics.uniqueWordCount).toBe(0);
    expect(profile.impression).toBe('Balanced');
    expect(profile.lineCount).toBe(0);
  });
});

describe('voiceProfiler - analyzeVoices', () => {
  it('groups lines by normalized speaker and produces profiles', () => {
    const lines: DialogueLine[] = [
      ...makeLinesForSpeaker('Alice', [
        'What are we going to do now?',
        "I don't know if this will work.",
        'We have to try!',
        'Are you sure about this?',
        'This is getting complicated.',
      ]),
      ...makeLinesForSpeaker(' ALICE  ', [
        'Another line with slightly different spacing.',
        'Yet another line.',
      ]),
      ...makeLinesForSpeaker('Bob', [
        'Short line.',
        'Another short line.',
        'Third short line.',
        'Fourth short line.',
        'Fifth short line.',
      ]),
    ];

    const result = analyzeVoices(lines);

    expect(Object.keys(result.profiles).length).toBeGreaterThanOrEqual(2);

    const aliceKey = Object.keys(result.profiles).find(key => key.includes('alice'));
    expect(aliceKey).toBeDefined();

    const aliceProfile = aliceKey && result.profiles[aliceKey];
    expect(aliceProfile?.signatureWords.length).toBeGreaterThan(0);
  });

  it('returns empty structures for no dialogues', () => {
    const result = analyzeVoices([]);
    expect(result.profiles).toEqual({});
    expect(result.consistencyAlerts).toEqual([]);
  });

  it('emits consistency alerts when voice metrics shift significantly', () => {
    const firstHalfQuotes = Array.from({ length: 5 }, (_, i) => `Formal declaration number ${i + 1}.`);
    const secondHalfQuotes = Array.from({ length: 5 }, (_, i) => `Hey! What's up ${i + 1}?!`);

    const lines: DialogueLine[] = [
      ...makeLinesForSpeaker('Professor', firstHalfQuotes),
      ...makeLinesForSpeaker('Professor', secondHalfQuotes),
    ];

    const result = analyzeVoices(lines);

    expect(result.consistencyAlerts.length).toBeGreaterThan(0);
    expect(result.consistencyAlerts[0]).toContain('Professor');
  });
});
