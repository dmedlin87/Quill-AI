import { describe, it, expect } from 'vitest';
import { mapEditsToSuggestions, LLMGrammarEdit } from '@/services/gemini/grammar';

describe('mapEditsToSuggestions', () => {
  it('maps a single edit to the correct range', () => {
    const text = 'He smiled at her.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'smiled', replacement: 'grinned', reason: 'variety', severity: 'style' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].start).toBe(3);
    expect(suggestions[0].end).toBe(9);
    expect(suggestions[0].replacement).toBe('grinned');
  });

  it('maps multiple edits targeting distinct phrases', () => {
    const text = 'He smiled. She laughed.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'smiled', replacement: 'grinned', reason: 'variety', severity: 'style' },
      { originalText: 'laughed', replacement: 'giggled', reason: 'variety', severity: 'style' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].start).toBe(3);
    expect(suggestions[1].start).toBe(15);
  });

  it('maps multiple edits for the same phrase to distinct occurrences', () => {
    const text = 'He smiled. He smiled again.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'He smiled', replacement: 'He grinned', reason: 'first', severity: 'style' },
      { originalText: 'He smiled', replacement: 'He beamed', reason: 'second', severity: 'style' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(2);
    // First edit -> first occurrence at index 0
    expect(suggestions[0].start).toBe(0);
    expect(suggestions[0].end).toBe(9);
    expect(suggestions[0].replacement).toBe('He grinned');
    // Second edit -> second occurrence at index 11
    expect(suggestions[1].start).toBe(11);
    expect(suggestions[1].end).toBe(20);
    expect(suggestions[1].replacement).toBe('He beamed');
  });

  it('skips edits when no more occurrences are available', () => {
    const text = 'He smiled.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'He smiled', replacement: 'He grinned', reason: 'first', severity: 'style' },
      { originalText: 'He smiled', replacement: 'He beamed', reason: 'second', severity: 'style' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    // Only one occurrence exists, so only one suggestion
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].replacement).toBe('He grinned');
  });

  it('skips edits with empty originalText or replacement', () => {
    const text = 'He smiled.';
    const edits: LLMGrammarEdit[] = [
      { originalText: '', replacement: 'grinned', reason: 'empty original', severity: 'grammar' },
      { originalText: 'smiled', replacement: '', reason: 'empty replacement', severity: 'grammar' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(0);
  });

  it('skips edits where originalText is not found', () => {
    const text = 'He smiled.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'laughed', replacement: 'giggled', reason: 'not found', severity: 'grammar' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(0);
  });
});
