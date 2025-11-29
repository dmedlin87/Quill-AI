import { AnalysisResult, CharacterProfile } from '@/types';

export function createCharacter(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return {
    name: 'Aria',
    bio: 'A determined protagonist.',
    arc: 'Learns to trust others.',
    arcStages: [
      { stage: 'Setup', description: 'Alone and guarded.' },
      { stage: 'Midpoint', description: 'Begins to open up.' },
      { stage: 'Climax', description: 'Relies on her allies.' },
    ],
    relationships: [
      { name: 'Cassian', type: 'Ally', dynamic: 'Protective but distant.' },
    ],
    plotThreads: ['Secret lineage', 'Broken alliance'],
    inconsistencies: [
      {
        issue: 'Age appears to change between chapters',
        quote: 'At sixteen, she had already...',
        startIndex: 10,
        endIndex: 40,
      },
    ],
    developmentSuggestion: 'Deepen her doubts in the first act to better justify later resolve.',
    ...overrides,
  };
}

export function createAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  const base: AnalysisResult = {
    summary: 'Overall, the manuscript shows strong character work and a compelling central conflict.',
    strengths: ['Vivid descriptions', 'Engaging character dynamics'],
    weaknesses: ['Opening is slightly slow', 'Some dialogue feels expository'],
    pacing: {
      score: 7,
      analysis: 'The pacing is generally solid with a minor lull in the opening chapters.',
      slowSections: ['The market scene in chapter 1 drags slightly.'],
      fastSections: ['The climax in chapter 12 rushes past key emotional beats.'],
    },
    settingAnalysis: {
      score: 6,
      analysis: 'Setting is imaginative, but a few details feel out of place for the chosen era.',
      issues: [
        {
          quote: 'She checked her wristwatch under the gaslight.',
          issue: 'Modern object referenced in a pre-industrial setting.',
          suggestion: 'Replace "wristwatch" with an era-appropriate timekeeping device.',
          alternatives: ['Pocket watch', 'Town clock tower chime'],
        },
      ],
    },
    plotIssues: [
      {
        issue: 'Motivation for leaving home is unclear.',
        location: 'Chapter 2, middle section',
        suggestion: 'Clarify the stakes and emotional drive behind the decision to depart.',
        quote: 'Without another word, he packed his bags and walked into the storm.',
        startIndex: 120,
        endIndex: 190,
      },
    ],
    characters: [createCharacter()],
    generalSuggestions: ['Tighten the first chapter by merging redundant descriptions.'],
  };

  return {
    ...base,
    ...overrides,
    pacing: {
      ...base.pacing,
      ...overrides.pacing,
    },
    settingAnalysis: overrides.settingAnalysis
      ? {
          ...base.settingAnalysis!,
          ...overrides.settingAnalysis,
        }
      : base.settingAnalysis,
  };
}
