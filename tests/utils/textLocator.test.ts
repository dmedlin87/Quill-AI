import { describe, it, expect } from 'vitest';
import { enrichAnalysisWithPositions, findQuoteRange } from '@/features/shared/utils/textLocator';

const sampleText = 'First line.  Second line with   extra spaces.';

describe('findQuoteRange', () => {
  it('finds exact and trimmed matches', () => {
    expect(findQuoteRange(sampleText, 'Second line')).toEqual({ start: 13, end: 24 });
    expect(findQuoteRange(sampleText, '  Second line ')).toEqual({ start: 11, end: 25 });
  });

  it('handles normalized whitespace and partial fallbacks', () => {
    expect(findQuoteRange(sampleText, 'Second line with extra spaces')).toEqual({ start: 13, end: 42 });
    expect(findQuoteRange(sampleText, 'First line.  Second')).toEqual({ start: 0, end: 19 });
  });
});

describe('enrichAnalysisWithPositions', () => {
  it('populates indices for nested analysis structures', () => {
    const enriched = enrichAnalysisWithPositions({
      summary: '',
      strengths: [],
      weaknesses: [],
      pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      plotIssues: [
        { issue: 'Plot hole', location: 'chap', suggestion: 'fix', quote: 'Second line with   extra spaces.' },
      ],
      characters: [
        {
          name: 'A',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [{ issue: 'conflict', quote: 'First line.' }],
          developmentSuggestion: '',
          voiceTraits: '',
        },
      ],
      generalSuggestions: [],
      settingAnalysis: { score: 0, analysis: '', issues: [{ issue: 's', suggestion: '', quote: 'Second line' }] },
    }, sampleText);

    expect(enriched.plotIssues[0]).toMatchObject({ startIndex: 13, endIndex: 45 });
    expect(enriched.settingAnalysis?.issues?.[0]).toMatchObject({ startIndex: 13, endIndex: 24 });
    expect(enriched.characters[0].inconsistencies[0]).toMatchObject({ startIndex: 0, endIndex: 11 });
  });
});
