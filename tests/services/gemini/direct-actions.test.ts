import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rewriteText, generateContinuation, getContextualHelp } from '@/services/gemini/direct-actions';

// Mock dependencies
vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('@/services/gemini/resilientParser', () => ({
  safeParseJsonWithValidation: vi.fn(),
  validators: {
    isVariationsResponse: vi.fn(),
  },
}));

vi.mock('@/services/gemini/errors', () => ({
  AIError: class AIError extends Error {
    isRetryable: boolean = false;
    constructor(message: string) {
      super(message);
      this.name = 'AIError';
    }
  },
  normalizeAIError: vi.fn((error) => error),
}));

vi.mock('../../config/models', () => ({
  ModelConfig: {
    analysis: 'gemini-pro',
    tools: 'gemini-pro',
  },
}));

import { ai } from '@/services/gemini/client';
import { safeParseJsonWithValidation } from '@/services/gemini/resilientParser';
import { normalizeAIError, AIError } from '@/services/gemini/errors';

describe('direct-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rewriteText', () => {
    it('returns empty result when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await rewriteText('test text', 'clarify', undefined, undefined, controller.signal);
      expect(result).toEqual({ result: [] });
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });

    it('returns variations from successful API call', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '{"variations": ["rewrite 1", "rewrite 2"]}',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      } as any);

      vi.mocked(safeParseJsonWithValidation).mockReturnValueOnce({
        success: true,
        data: { variations: ['rewrite 1', 'rewrite 2'] },
      });

      const result = await rewriteText('original text', 'clarify');

      expect(result.result).toEqual(['rewrite 1', 'rewrite 2']);
      expect(result.usage).toBeDefined();
    });

    it('includes tone in prompt when mode is Tone Tuner', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '{"variations": ["formal version"]}',
        usageMetadata: {},
      } as any);

      vi.mocked(safeParseJsonWithValidation).mockReturnValueOnce({
        success: true,
        data: { variations: ['formal version'] },
      });

      await rewriteText('casual text', 'Tone Tuner', 'formal');

      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('Target Tone: formal'),
        })
      );
    });

    it('includes setting instruction when setting is provided', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '{"variations": ["period text"]}',
        usageMetadata: {},
      } as any);

      vi.mocked(safeParseJsonWithValidation).mockReturnValueOnce({
        success: true,
        data: { variations: ['period text'] },
      });

      await rewriteText('text', 'clarify', undefined, { timePeriod: '1920s', location: 'Paris' });

      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: expect.stringContaining('1920s'),
          }),
        })
      );
    });

    it('logs warning but returns empty array when parse fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: 'invalid json',
        usageMetadata: {},
      } as any);

      vi.mocked(safeParseJsonWithValidation).mockReturnValueOnce({
        success: false,
        error: 'Parse error',
        data: { variations: [] },
      });

      const result = await rewriteText('text', 'clarify');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Parse failed'), expect.anything());
      expect(result.result).toEqual([]);

      consoleSpy.mockRestore();
    });

    it('returns empty result on API error (does not throw)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(ai.models.generateContent).mockRejectedValueOnce(new Error('API error'));

      const result = await rewriteText('text', 'clarify');

      expect(result).toEqual({ result: [] });
      expect(normalizeAIError).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('returns empty result when aborted during API call', async () => {
      const controller = new AbortController();

      vi.mocked(ai.models.generateContent).mockImplementationOnce(async () => {
        controller.abort();
        throw new Error('Aborted');
      });

      const result = await rewriteText('text', 'clarify', undefined, undefined, controller.signal);

      expect(result).toEqual({ result: [] });
    });
  });

  describe('generateContinuation', () => {
    it('generates continuation with context only', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '  The story continues here.  ',
        usageMetadata: { promptTokenCount: 50 },
      } as any);

      const result = await generateContinuation({ context: 'Previous text...' });

      expect(result.result).toBe('The story continues here.');
      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('Manuscript context'),
        })
      );
    });

    it('includes selection in prompt when provided', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: 'Continued from selection',
        usageMetadata: {},
      } as any);

      await generateContinuation({ context: 'Full context', selection: 'Selected portion' });

      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('Selected text'),
        })
      );
    });

    it('throws when model returns empty text', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '',
        usageMetadata: {},
      } as any);

      await expect(generateContinuation({ context: 'context' })).rejects.toThrow();
    });

    it('throws when model returns null text', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: null,
        usageMetadata: {},
      } as any);

      await expect(generateContinuation({ context: 'context' })).rejects.toThrow();
    });

    it('normalizes and throws on API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const apiError = new Error('API failed');

      vi.mocked(ai.models.generateContent).mockRejectedValueOnce(apiError);
      vi.mocked(normalizeAIError).mockReturnValueOnce(apiError as any);

      await expect(generateContinuation({ context: 'context' })).rejects.toThrow('API failed');
      expect(normalizeAIError).toHaveBeenCalledWith(apiError, expect.any(Object));

      consoleSpy.mockRestore();
    });
  });

  describe('getContextualHelp', () => {
    it('returns explanation for Explain type', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: 'This means...',
        usageMetadata: { promptTokenCount: 5 },
      } as any);

      const result = await getContextualHelp('archaic word', 'Explain');

      expect(result.result).toBe('This means...');
      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.stringContaining('Type: Explain'),
        })
      );
    });

    it('returns thesaurus results for Thesaurus type', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: 'Synonyms: happy, joyful, elated',
        usageMetadata: {},
      } as any);

      const result = await getContextualHelp('glad', 'Thesaurus');

      expect(result.result).toContain('Synonyms');
    });

    it('returns fallback when response text is empty', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: '',
        usageMetadata: {},
      } as any);

      const result = await getContextualHelp('word', 'Explain');

      expect(result.result).toBe('No result found.');
    });

    it('returns fallback when response text is undefined', async () => {
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: undefined,
        usageMetadata: {},
      } as any);

      const result = await getContextualHelp('word', 'Thesaurus');

      expect(result.result).toBe('No result found.');
    });

    it('includes usage metadata in result', async () => {
      const mockUsage = { promptTokenCount: 10, candidatesTokenCount: 20 };
      vi.mocked(ai.models.generateContent).mockResolvedValueOnce({
        text: 'Help text',
        usageMetadata: mockUsage,
      } as any);

      const result = await getContextualHelp('word', 'Explain');

      expect(result.usage).toEqual(mockUsage);
    });
  });
});
