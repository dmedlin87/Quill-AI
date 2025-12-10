import { describe, it, expect } from 'vitest';
import {
  normalizeGrammarSuggestions,
  mapGrammarSeverityToHighlight,
} from '@/features/shared/utils/grammarNormalizer';
import type { GrammarSuggestion } from '@/types';

describe('grammarNormalizer', () => {
  describe('normalizeGrammarSuggestions', () => {
    it('offsets suggestion positions by selection start', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 7,
          replacement: 'receive',
          message: 'Spelling error',
          severity: 'grammar',
        },
      ];

      const { suggestions: normalized } = normalizeGrammarSuggestions(
        suggestions,
        100, // selection starts at position 100
        'recieve some text'
      );

      expect(normalized[0].start).toBe(100);
      expect(normalized[0].end).toBe(107);
    });

    it('preserves originalText when already present', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 7,
          replacement: 'receive',
          message: 'Spelling error',
          severity: 'grammar',
          originalText: 'recieve',
        },
      ];

      const { suggestions: normalized } = normalizeGrammarSuggestions(
        suggestions,
        100,
        'recieve some text'
      );

      expect(normalized[0].originalText).toBe('recieve');
    });

    it('extracts originalText from selection text when not present', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 7,
          replacement: 'receive',
          message: 'Spelling error',
          severity: 'grammar',
        },
      ];

      const { suggestions: normalized } = normalizeGrammarSuggestions(
        suggestions,
        100,
        'recieve some text'
      );

      expect(normalized[0].originalText).toBe('recieve');
    });

    it('generates highlights with correct properties', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 7,
          replacement: 'receive',
          message: 'Spelling error',
          severity: 'grammar',
        },
      ];

      const { highlights } = normalizeGrammarSuggestions(
        suggestions,
        100,
        'recieve some text'
      );

      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toEqual({
        start: 100,
        end: 107,
        color: 'var(--error-500)',
        title: 'Spelling error',
        severity: 'error',
      });
    });

    it('maps style severity to warning highlight', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 4,
          replacement: 'very',
          message: 'Consider removing',
          severity: 'style',
        },
      ];

      const { highlights } = normalizeGrammarSuggestions(
        suggestions,
        0,
        'very nice'
      );

      expect(highlights[0].severity).toBe('warning');
    });

    it('handles multiple suggestions', () => {
      const suggestions: GrammarSuggestion[] = [
        {
          id: 'sug-1',
          start: 0,
          end: 7,
          replacement: 'receive',
          message: 'Spelling error',
          severity: 'grammar',
        },
        {
          id: 'sug-2',
          start: 13,
          end: 23,
          replacement: 'definitely',
          message: 'Spelling error',
          severity: 'grammar',
        },
      ];

      const { suggestions: normalized, highlights } = normalizeGrammarSuggestions(
        suggestions,
        50,
        'recieve mail definately'
      );

      expect(normalized).toHaveLength(2);
      expect(highlights).toHaveLength(2);

      expect(normalized[0].start).toBe(50);
      expect(normalized[0].end).toBe(57);

      expect(normalized[1].start).toBe(63);
      expect(normalized[1].end).toBe(73);
    });

    it('handles empty suggestions array', () => {
      const { suggestions, highlights } = normalizeGrammarSuggestions(
        [],
        100,
        'some text'
      );

      expect(suggestions).toEqual([]);
      expect(highlights).toEqual([]);
    });
  });

  describe('mapGrammarSeverityToHighlight', () => {
    it('maps grammar severity to error', () => {
      expect(mapGrammarSeverityToHighlight('grammar')).toBe('error');
    });

    it('maps style severity to warning', () => {
      expect(mapGrammarSeverityToHighlight('style')).toBe('warning');
    });

    it('defaults to error for undefined severity', () => {
      expect(mapGrammarSeverityToHighlight(undefined)).toBe('error');
    });
  });
});
