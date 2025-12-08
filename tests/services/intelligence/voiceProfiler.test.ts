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

  it('produces a punchy, urgent, and casual impression for short excited lines', () => {
    const lines = makeLinesForSpeaker('Rex', [
      "Wow!",
      "We can't wait!",
      "We're racing ahead!",
    ]);

    const profile = generateVoiceProfile(lines);

    expect(profile.impression).toContain('Casual');
    expect(profile.impression).toContain('Urgent');
    expect(profile.impression).toContain('Punchy');
  });

  it('marks verbose and formal voices with inquisitive tone', () => {
    const lines = makeLinesForSpeaker('Professor', [
      'The elaboration of coordination, justification, orientation, determination, and consideration is necessary for civilization transformation and revitalization of cooperation in organization, is it not?',
      'In this deliberation, the implication of cooperation and optimization in our communication and organization remains essential for preservation, articulation, and accumulation of shared information.',
      'Does this continuation of exploration and adaptation reinforce our collective imagination and aspiration for innovation?',
    ]);

    const profile = generateVoiceProfile(lines);

    expect(profile.impression).toContain('Formal');
    expect(profile.impression).toContain('Verbose');
    expect(profile.impression).toContain('Inquisitive');
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

  it('ignores punctuation-only sentences when computing metrics', () => {
    const lines = makeLinesForSpeaker('Loud', ['!!!', '?!?']);
    const profile = generateVoiceProfile(lines);

    expect(profile.metrics.avgSentenceLength).toBe(0);
    expect(profile.metrics.exclamationRatio).toBe(0);
    expect(profile.impression).toBe('Balanced');
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

  it('skips profiles for speakers without enough lines', () => {
    const result = analyzeVoices([
      ...makeLinesForSpeaker('Short', ['Line one.', 'Line two.', 'Line three.']),
      ...makeLinesForSpeaker(
        'Long',
        Array.from({ length: 6 }, () => 'Steady statement with no surprises or punctuation'),
      ),
    ]);

    expect(Object.keys(result.profiles)).toHaveLength(1);
    const onlyProfile = Object.values(result.profiles)[0];
    expect(onlyProfile.speakerName).toBe('Long');
    expect(result.consistencyAlerts).toHaveLength(0);
  });

  it('handles empty quotes while still creating profiles without alerts', () => {
    const lines = makeLinesForSpeaker('Silent', Array.from({ length: 6 }, () => ''));

    const result = analyzeVoices(lines);

    const profileKeys = Object.keys(result.profiles);
    expect(profileKeys).toHaveLength(1);
    const profile = result.profiles[profileKeys[0]];
    expect(profile.metrics.avgSentenceLength).toBe(0);
    expect(profile.signatureWords).toEqual([]);
    expect(result.consistencyAlerts).toEqual([]);
  });

  it('ignores entries without speakers and tolerates undefined quotes', () => {
    const lines: DialogueLine[] = [
      { speaker: '', quote: 'ignored', offset: 0 } as any,
      { speaker: 'Ghost', quote: undefined as any, offset: 1 },
      { speaker: 'Ghost', quote: '!!!', offset: 2 } as any,
      { speaker: 'Ghost', quote: undefined as any, offset: 3 },
      { speaker: 'Ghost', quote: '', offset: 4 } as any,
      { speaker: 'Ghost', quote: undefined as any, offset: 5 },
    ];

    const result = analyzeVoices(lines);

    const ghostProfile = Object.values(result.profiles)[0];
    expect(ghostProfile.speakerName).toBe('Ghost');
    expect(ghostProfile.impression).toBe('Balanced');
    expect(result.consistencyAlerts).toEqual([]);
  });
});
