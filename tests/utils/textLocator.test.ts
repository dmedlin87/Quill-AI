import { describe, it, expect } from 'vitest';
import { enrichAnalysisWithPositions, findQuoteRange, extractClickableIssues } from '@/features/shared/utils/textLocator';

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

  it('returns the first match when multiple occurrences exist', () => {
    const text = 'repeat here and repeat over there';
    expect(findQuoteRange(text, 'repeat')).toEqual({ start: 0, end: 6 });
  });

  it('falls back to fuzzy search when exact matching fails', () => {
    const text = 'abcdefg hijkl';
    // Missing the "d" would normally fail an exact match, so this exercises the fuzzy matcher path.
    expect(findQuoteRange(text, 'abcefg')).toEqual({ start: 0, end: 6 });
  });

  it('handles normalized whitespace mapping back to original indices', () => {
    const text = 'A  B\tC';
    expect(findQuoteRange(text, 'A B C')).toEqual({ start: 0, end: 5 });
  });

  it('returns null when no match can be found', () => {
    expect(findQuoteRange(sampleText, 'Nonexistent quote')).toBeNull();
    expect(findQuoteRange('', 'anything')).toBeNull();
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

  it('leaves issues untouched when positions cannot be resolved', () => {
    const analysis = {
      summary: '',
      strengths: [],
      weaknesses: [],
      pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
      plotIssues: [{ issue: 'Missing quote', location: '', suggestion: '', quote: 'nowhere' }],
      settingAnalysis: { score: 0, analysis: '', issues: [{ issue: 'missing', suggestion: '', quote: 'absent' }] },
      characters: [
        {
          name: 'A',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [{ issue: 'no quote', quote: '' }],
          developmentSuggestion: '',
          voiceTraits: '',
        },
      ],
      generalSuggestions: [],
    } as const;

    const enriched = enrichAnalysisWithPositions(analysis, 'short text');

    expect(enriched.plotIssues[0]).not.toHaveProperty('startIndex');
    expect(enriched.settingAnalysis?.issues?.[0]).not.toHaveProperty('startIndex');
    expect(enriched.characters[0].inconsistencies[0]).not.toHaveProperty('startIndex');
  });
});

describe('findQuoteRange edge cases', () => {
  it('returns null for empty quote', () => {
    expect(findQuoteRange('some text', '')).toBeNull();
  });

  it('returns null for whitespace-only quote', () => {
    expect(findQuoteRange('some text', '   ')).toBeNull();
  });

  it('returns null for null/undefined inputs', () => {
    expect(findQuoteRange('', 'test')).toBeNull();
    expect(findQuoteRange(null as any, 'test')).toBeNull();
    expect(findQuoteRange('test', null as any)).toBeNull();
  });

  it('handles long quote partial matching (>20 chars)', () => {
    const text = 'This is a very long sentence with lots of words in it.';
    const longQuote = 'This is a very long sentence that does not exist exactly';
    // First 20 chars: "This is a very long " should match
    const result = findQuoteRange(text, longQuote);
    expect(result).not.toBeNull();
    expect(result?.start).toBe(0);
  });

  it('clamps range to text boundaries', () => {
    const text = 'short';
    // Quote would extend beyond text length
    const result = findQuoteRange(text, 'short text');
    expect(result).not.toBeNull();
    expect(result?.end).toBeLessThanOrEqual(text.length);
  });

  it('handles text with only whitespace', () => {
    expect(findQuoteRange('   ', 'text')).toBeNull();
  });

  it('handles quotes at the very end of text', () => {
    const text = 'beginning middle end';
    expect(findQuoteRange(text, 'end')).toEqual({ start: 17, end: 20 });
  });

  it('handles normalized whitespace in complex scenarios', () => {
    const text = 'word1\t\nword2   word3';
    // Normalized: "word1 word2 word3"
    const result = findQuoteRange(text, 'word1 word2 word3');
    expect(result).not.toBeNull();
  });
});

describe('extractClickableIssues', () => {
  const baseAnalysis = {
    summary: '',
    strengths: [],
    weaknesses: [],
    pacing: { score: 0, analysis: '', slowSections: [], fastSections: [] },
    plotIssues: [],
    characters: [],
    generalSuggestions: [],
  };

  it('extracts plot issues with quotes', () => {
    const analysis = {
      ...baseAnalysis,
      plotIssues: [
        { issue: 'Plot hole', location: 'ch1', suggestion: 'Fix it', quote: 'Second line' },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('plot');
    expect(issues[0].issue).toBe('Plot hole');
    expect(issues[0].suggestion).toBe('Fix it');
    expect(issues[0].quote).toBe('Second line');
    expect(issues[0].range).toEqual({ start: 13, end: 24 });
  });

  it('extracts plot issues without quotes (range is null)', () => {
    const analysis = {
      ...baseAnalysis,
      plotIssues: [
        { issue: 'Plot issue', location: 'ch1', suggestion: 'Fix', quote: undefined as any },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(1);
    expect(issues[0].range).toBeNull();
  });

  it('extracts setting issues', () => {
    const analysis = {
      ...baseAnalysis,
      settingAnalysis: {
        score: 5,
        analysis: 'Good setting',
        issues: [
          { issue: 'Setting unclear', suggestion: 'Add detail', quote: 'First line.' },
        ],
      },
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('setting');
    expect(issues[0].issue).toBe('Setting unclear');
    expect(issues[0].range).toEqual({ start: 0, end: 11 });
  });

  it('extracts character inconsistencies', () => {
    const analysis = {
      ...baseAnalysis,
      characters: [
        {
          name: 'Alice',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [
            { issue: 'Voice change', quote: 'Second line' },
          ],
          developmentSuggestion: '',
        },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('character');
    expect(issues[0].issue).toBe('Alice: Voice change');
    expect(issues[0].range).toEqual({ start: 13, end: 24 });
  });

  it('extracts character inconsistencies without quotes', () => {
    const analysis = {
      ...baseAnalysis,
      characters: [
        {
          name: 'Bob',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [
            { issue: 'No quote here', quote: '' },
          ],
          developmentSuggestion: '',
        },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('character');
    expect(issues[0].range).toBeNull();
  });

  it('combines all issue types', () => {
    const analysis = {
      ...baseAnalysis,
      plotIssues: [
        { issue: 'Plot 1', location: '', suggestion: '', quote: 'First line.' },
      ],
      settingAnalysis: {
        score: 0,
        analysis: '',
        issues: [
          { issue: 'Setting 1', suggestion: '', quote: 'Second line' },
        ],
      },
      characters: [
        {
          name: 'C',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [{ issue: 'Inc 1', quote: 'extra' }],
          developmentSuggestion: '',
        },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(3);
    expect(issues.map(i => i.type)).toEqual(['plot', 'setting', 'character']);
  });

  it('returns empty array when no issues', () => {
    const issues = extractClickableIssues(baseAnalysis, sampleText);
    expect(issues).toHaveLength(0);
  });

  it('handles analysis without settingAnalysis', () => {
    const analysis = {
      ...baseAnalysis,
      settingAnalysis: undefined,
    };

    const issues = extractClickableIssues(analysis as any, sampleText);
    expect(issues).toHaveLength(0);
  });

  it('handles multiple characters with multiple inconsistencies', () => {
    const analysis = {
      ...baseAnalysis,
      characters: [
        {
          name: 'A',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [
            { issue: 'Inc A1', quote: 'First' },
            { issue: 'Inc A2', quote: 'Second' },
          ],
          developmentSuggestion: '',
        },
        {
          name: 'B',
          bio: '',
          arc: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [
            { issue: 'Inc B1', quote: 'line' },
          ],
          developmentSuggestion: '',
        },
      ],
    };

    const issues = extractClickableIssues(analysis, sampleText);

    expect(issues).toHaveLength(3);
    expect(issues[0].issue).toBe('A: Inc A1');
    expect(issues[1].issue).toBe('A: Inc A2');
    expect(issues[2].issue).toBe('B: Inc B1');
  });
});
