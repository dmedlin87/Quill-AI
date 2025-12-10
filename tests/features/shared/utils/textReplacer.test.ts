import { describe, it, expect } from 'vitest';
import {
  replaceTextRange,
  applyReplacementsReversed,
} from '@/features/shared/utils/textReplacer';

describe('textReplacer', () => {
  describe('replaceTextRange', () => {
    it('replaces text in the middle of a string', () => {
      const result = replaceTextRange('Hello world', 6, 11, 'universe');
      expect(result).toBe('Hello universe');
    });

    it('replaces text at the start of a string', () => {
      const result = replaceTextRange('Hello world', 0, 5, 'Hi');
      expect(result).toBe('Hi world');
    });

    it('replaces text at the end of a string', () => {
      const result = replaceTextRange('Hello world', 6, 11, 'there');
      expect(result).toBe('Hello there');
    });

    it('handles empty replacement (deletion)', () => {
      const result = replaceTextRange('Hello world', 5, 11, '');
      expect(result).toBe('Hello');
    });

    it('handles insertion at a point (same start and end)', () => {
      const result = replaceTextRange('Hello world', 5, 5, ' beautiful');
      expect(result).toBe('Hello beautiful world');
    });

    it('handles replacement that spans entire string', () => {
      const result = replaceTextRange('Hello world', 0, 11, 'Goodbye');
      expect(result).toBe('Goodbye');
    });

    it('handles empty input string', () => {
      const result = replaceTextRange('', 0, 0, 'Hello');
      expect(result).toBe('Hello');
    });

    it('preserves text before and after replacement', () => {
      const result = replaceTextRange('The quick brown fox', 4, 9, 'slow');
      expect(result).toBe('The slow brown fox');
    });

    it('handles unicode characters', () => {
      const result = replaceTextRange('Hello 世界', 6, 8, 'World');
      expect(result).toBe('Hello World');
    });

    it('handles special characters', () => {
      const result = replaceTextRange('Hello "world"!', 6, 13, '"universe"');
      expect(result).toBe('Hello "universe"!');
    });

    it('handles newlines in text', () => {
      const result = replaceTextRange('Hello\nworld', 5, 6, ' ');
      expect(result).toBe('Hello world');
    });
  });

  describe('applyReplacementsReversed', () => {
    it('applies single replacement', () => {
      const result = applyReplacementsReversed('Hello world', [
        { start: 6, end: 11, replacement: 'universe' },
      ]);
      expect(result).toBe('Hello universe');
    });

    it('applies multiple replacements in reverse order', () => {
      const result = applyReplacementsReversed('Hello world, hello!', [
        { start: 0, end: 5, replacement: 'Hi' },
        { start: 13, end: 18, replacement: 'hi' },
      ]);
      expect(result).toBe('Hi world, hi!');
    });

    it('handles replacements that would overlap if applied forward', () => {
      // When applied in reverse order, positions remain valid
      const result = applyReplacementsReversed('aaabbbccc', [
        { start: 0, end: 3, replacement: 'X' },
        { start: 3, end: 6, replacement: 'Y' },
        { start: 6, end: 9, replacement: 'Z' },
      ]);
      expect(result).toBe('XYZ');
    });

    it('handles unsorted replacements', () => {
      // Should sort by start position in reverse
      const result = applyReplacementsReversed('Hello world!', [
        { start: 6, end: 11, replacement: 'universe' },
        { start: 0, end: 5, replacement: 'Goodbye' },
      ]);
      expect(result).toBe('Goodbye universe!');
    });

    it('handles empty replacements array', () => {
      const result = applyReplacementsReversed('Hello world', []);
      expect(result).toBe('Hello world');
    });

    it('handles multiple adjacent replacements', () => {
      const result = applyReplacementsReversed('abc', [
        { start: 0, end: 1, replacement: 'A' },
        { start: 1, end: 2, replacement: 'B' },
        { start: 2, end: 3, replacement: 'C' },
      ]);
      expect(result).toBe('ABC');
    });

    it('handles replacements of different sizes', () => {
      const result = applyReplacementsReversed('The quick brown fox', [
        { start: 0, end: 3, replacement: 'A' },
        { start: 4, end: 9, replacement: 'lazy' },
        { start: 16, end: 19, replacement: 'dog' },
      ]);
      expect(result).toBe('A lazy brown dog');
    });
  });
});
