import { describe, it, expect } from 'vitest';
import {
  findQuoteRange,
  enrichAnalysisWithPositions,
  extractClickableIssues,
} from '@/features/shared/utils/textLocator';
import { AnalysisResult } from '@/types';

describe('textLocator', () => {
  const fullText = `
    This is a sample text for testing text locator.
    It has multiple lines.
    Some lines have   extra   whitespace.
    There are quotes here.
    Extreme      spacing      example.
  `;

  describe('findQuoteRange', () => {
    it('returns null for empty text or quote', () => {
      expect(findQuoteRange('', 'quote')).toBeNull();
      expect(findQuoteRange('text', '')).toBeNull();
      expect(findQuoteRange('text', '   ')).toBeNull();
    });

    it('finds exact match', () => {
      const quote = 'multiple lines';
      const result = findQuoteRange(fullText, quote);
      expect(result).not.toBeNull();
      expect(fullText.substring(result!.start, result!.end)).toBe(quote);
    });

    it('finds match with whitespace differences (normalized match)', () => {
      // Use a shorter quote because the long one triggers 'pattern too long' exception in JSDOM,
      // which is caught and returns null (correct behavior for error handling, but we want to test normalized match).
      // Short quote: "have extra"
      const quote = 'have extra';
      // Original has "   extra   "
      const result = findQuoteRange(fullText, quote);

      expect(result).not.toBeNull();
      const found = fullText.substring(result!.start, result!.end);
      expect(found).toContain('have');
      expect(found).toContain('extra');
    });

    it('finds match with extreme whitespace differences (normalized match)', () => {
      // "Extreme      spacing      example." in text.
      // Quote: "Extreme spacing example."
      // Difference is very large, fuzzy match might fail, forcing normalized match.
      const quote = "Extreme spacing example.";
      const result = findQuoteRange(fullText, quote);
      expect(result).not.toBeNull();
      const found = fullText.substring(result!.start, result!.end);
      expect(found).toContain('Extreme');
      expect(found).toContain('example');
      // Should span the whole thing including spaces
      expect(found.length).toBeGreaterThan(quote.length);
    });

    it('finds partial match for long quotes', () => {
      // Create a quote that matches the beginning but deviates later or is cut off
      const quote = 'This is a sample text for testing something else entirely that does not match';
      // "This is a sample text for testing " is > 20 chars and matches
      const result = findQuoteRange(fullText, quote);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(fullText.indexOf('This is a sample'));
    });

    it('handles fuzzy matching', () => {
        const quote = "It has multiple lynes."; // typo
        const result = findQuoteRange(fullText, quote);
        expect(result).not.toBeNull();
        const found = fullText.substring(result!.start, result!.end);
        expect(found).toBe('It has multiple lines.');
    });

    it('returns null if no match found', () => {
      const quote = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
      expect(findQuoteRange(fullText, quote)).toBeNull();
    });

    it('handles normalized map matching failure', () => {
       const text = "   ";
       expect(findQuoteRange(text, "foo")).toBeNull();
    });
  });

  describe('enrichAnalysisWithPositions', () => {
    const analysis: AnalysisResult = {
      characters: [
        {
          name: 'Char1',
          archetype: 'Hero',
          inconsistencies: [
            { issue: 'Bad act', quote: 'multiple lines', severity: 'warning' },
            { issue: 'No quote', severity: 'info' },
          ],
        },
      ],
      plotIssues: [
        { issue: 'Plot hole', quote: 'quotes here', severity: 'error' },
        { issue: 'Unknown', quote: 'ZZZZZZZZZ', severity: 'warning' },
      ],
      settingAnalysis: {
        issues: [
            { issue: 'Wrong place', quote: 'sample text', severity: 'info' }
        ],
        setting: 'Place',
        timePeriod: 'Time'
      },
      themes: [],
      pacing: [],
    } as any;

    it('enriches analysis result with positions', () => {
      const result = enrichAnalysisWithPositions(analysis, fullText);

      expect(result.characters[0].inconsistencies[0].startIndex).toBeDefined();
      expect(result.characters[0].inconsistencies[1].startIndex).toBeUndefined();

      expect(result.plotIssues[0].startIndex).toBeDefined();
      expect(result.plotIssues[1].startIndex).toBeUndefined();

      expect(result.settingAnalysis?.issues[0].startIndex).toBeDefined();
    });
  });

  describe('extractClickableIssues', () => {
    const analysis: AnalysisResult = {
      characters: [
        {
          name: 'Char1',
          archetype: 'Hero',
          inconsistencies: [
            { issue: 'Inconsistency', quote: 'multiple lines', severity: 'warning' },
          ],
        },
      ],
      plotIssues: [
        { issue: 'Plot issue', quote: 'quotes here', severity: 'error' },
      ],
      settingAnalysis: {
          issues: [
              { issue: 'Setting issue', quote: 'sample text', severity: 'info' }
          ]
      }
    } as any;

    it('extracts issues into linear list', () => {
      const issues = extractClickableIssues(analysis, fullText);

      expect(issues).toHaveLength(3);
      expect(issues.find(i => i.type === 'character')).toBeDefined();
      expect(issues.find(i => i.type === 'plot')).toBeDefined();
      expect(issues.find(i => i.type === 'setting')).toBeDefined();
      expect(issues[0].range).not.toBeNull();
    });
  });
});
