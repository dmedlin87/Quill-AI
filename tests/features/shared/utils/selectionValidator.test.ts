import { describe, it, expect } from 'vitest';
import {
  validateSelectionFreshness,
  validateGrammarSelectionFreshness,
} from '@/features/shared/utils/selectionValidator';

describe('selectionValidator', () => {
  describe('validateSelectionFreshness', () => {
    it('returns valid when selection text matches current text', () => {
      const currentText = 'Hello world, this is a test.';
      const selection = { start: 6, end: 11, text: 'world' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('returns invalid when selection text does not match current text', () => {
      const currentText = 'Hello earth, this is a test.';
      const selection = { start: 6, end: 11, text: 'world' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe(
        'Text has changed since selection. Please re-select and try again.'
      );
    });

    it('handles empty selections', () => {
      const currentText = 'Hello world';
      const selection = { start: 5, end: 5, text: '' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('handles selection at start of text', () => {
      const currentText = 'Hello world';
      const selection = { start: 0, end: 5, text: 'Hello' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('handles selection at end of text', () => {
      const currentText = 'Hello world';
      const selection = { start: 6, end: 11, text: 'world' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('handles selection spanning entire text', () => {
      const currentText = 'Hello world';
      const selection = { start: 0, end: 11, text: 'Hello world' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('handles selection with special characters', () => {
      const currentText = 'Hello "world"!';
      const selection = { start: 6, end: 13, text: '"world"' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('handles unicode characters', () => {
      const currentText = 'Hello 世界';
      const selection = { start: 6, end: 8, text: '世界' };

      const result = validateSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateGrammarSelectionFreshness', () => {
    it('returns valid when selection text matches', () => {
      const currentText = 'I recieve mail.';
      const selection = { start: 2, end: 9, text: 'recieve' };

      const result = validateGrammarSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(true);
    });

    it('returns grammar-specific error message when text changed', () => {
      const currentText = 'I receive mail.';
      const selection = { start: 2, end: 9, text: 'recieve' };

      const result = validateGrammarSelectionFreshness(currentText, selection);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe(
        'Text has changed since grammar check. Please re-run.'
      );
    });
  });
});
