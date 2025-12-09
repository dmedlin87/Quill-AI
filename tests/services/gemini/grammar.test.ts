import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapEditsToSuggestions, LLMGrammarEdit, fetchGrammarSuggestions } from '@/services/gemini/grammar';

// Mock the AI client
vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

import { ai } from '@/services/gemini/client';

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

  it('collapses spelling severity to grammar', () => {
    const text = 'He recieved the package.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'recieved', replacement: 'received', reason: 'spelling', severity: 'spelling' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].severity).toBe('grammar'); // spelling collapses to grammar
  });

  it('preserves style severity', () => {
    const text = 'He smiled.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'smiled', replacement: 'grinned', reason: 'variety', severity: 'style' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].severity).toBe('style');
  });

  it('uses default message when reason is empty', () => {
    const text = 'He smiled.';
    const edits: LLMGrammarEdit[] = [
      { originalText: 'smiled', replacement: 'grinned', reason: '', severity: 'grammar' },
    ];

    const suggestions = mapEditsToSuggestions(text, edits);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].message).toBe('Suggested correction');
  });
});

describe('fetchGrammarSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns suggestions from successful API response', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: JSON.stringify({
        edits: [
          { originalText: 'recieve', replacement: 'receive', reason: 'spelling', severity: 'spelling' },
        ],
      }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    } as any);

    const result = await fetchGrammarSuggestions('I recieve mail.');

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].replacement).toBe('receive');
    expect(result.usage).toBeDefined();
    expect(result.usage?.totalTokenCount).toBe(15);
  });

  it('returns empty suggestions when API returns empty edits', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: JSON.stringify({ edits: [] }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    } as any);

    const result = await fetchGrammarSuggestions('This is correct text.');

    expect(result.suggestions).toHaveLength(0);
  });

  it('throws AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(fetchGrammarSuggestions('Test', controller.signal)).rejects.toThrow('Aborted');
  });

  it('returns empty suggestions when signal is aborted during API call', async () => {
    // Note: The post-call abort check throws inside try/catch, so it returns empty instead of throwing
    const controller = new AbortController();

    vi.mocked(ai.models.generateContent).mockImplementationOnce(async () => {
      controller.abort();
      return {
        text: JSON.stringify({ edits: [] }),
        usageMetadata: {},
      } as any;
    });

    const result = await fetchGrammarSuggestions('Test', controller.signal);
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns empty suggestions on API error', async () => {
    vi.mocked(ai.models.generateContent).mockRejectedValueOnce(new Error('API Error'));

    const result = await fetchGrammarSuggestions('Test text.');

    expect(result.suggestions).toHaveLength(0);
  });

  it('handles malformed JSON response gracefully', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: 'not valid json',
      usageMetadata: {},
    } as any);

    const result = await fetchGrammarSuggestions('Test text.');

    // safeParseJson should return the default value
    expect(result.suggestions).toHaveLength(0);
  });

  it('handles null edits in response', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: JSON.stringify({ edits: null }),
      usageMetadata: {},
    } as any);

    const result = await fetchGrammarSuggestions('Test text.');

    expect(result.suggestions).toHaveLength(0);
  });

  it('maps multiple edits correctly', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
      text: JSON.stringify({
        edits: [
          { originalText: 'recieve', replacement: 'receive', reason: 'spelling', severity: 'spelling' },
          { originalText: 'definately', replacement: 'definitely', reason: 'spelling', severity: 'spelling' },
        ],
      }),
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
    } as any);

    const result = await fetchGrammarSuggestions('I recieve mail definately.');

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0].replacement).toBe('receive');
    expect(result.suggestions[1].replacement).toBe('definitely');
  });
});
