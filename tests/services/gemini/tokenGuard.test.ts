import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkTokenLimit, truncateToLimit } from '@/services/gemini/tokenGuard';

// Mock configuration
vi.mock('@/config/models', () => ({
  TokenLimits: {
    'gemini-pro': 1000,
  },
  ModelId: {
    GeminiPro: 'gemini-pro',
  },
}));

vi.mock('@/config/api', () => ({
  ApiDefaults: {
    charsPerToken: 4,
  },
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

describe('tokenGuard', () => {
  const MODEL = 'gemini-pro' as any;
  const LIMIT = 1000;
  const RESERVE = 100; // Let's use 100 for easier math

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTokenLimit', () => {
    it('allows input when exactly at the limit', () => {
      // Limit is 1000, reserve is 100 -> available 900 tokens.
      // 900 tokens * 4 chars/token = 3600 chars.
      const exactText = 'a'.repeat(900 * 4);

      const result = checkTokenLimit(exactText, MODEL, RESERVE);

      expect(result.valid).toBe(true);
      expect(result.overflow).toBe(0);
      expect(result.estimatedTokens).toBe(900);
      expect(result.suggestion).toBeUndefined();
    });

    it('rejects input when 1 token over the limit', () => {
      // Limit 1000, reserve 100 -> available 900.
      // 901 tokens * 4 chars = 3604 chars.
      const overText = 'a'.repeat(901 * 4);

      const result = checkTokenLimit(overText, MODEL, RESERVE);

      expect(result.valid).toBe(false);
      expect(result.overflow).toBe(1);
      expect(result.estimatedTokens).toBe(901);
      expect(result.suggestion).toContain('Input exceeds limit by ~1 tokens');
    });

    it('rejects input significantly over limit', () => {
      const hugeText = 'a'.repeat(2000 * 4);
      const result = checkTokenLimit(hugeText, MODEL, RESERVE);

      expect(result.valid).toBe(false);
      expect(result.overflow).toBe(2000 - 900);
    });

    it('handles zero available tokens gracefully', () => {
      // Reserve > Limit
      const result = checkTokenLimit('text', MODEL, LIMIT + 100);
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBe('Token configuration leaves no room for input.');
    });
  });

  describe('truncateToLimit', () => {
    it('does not truncate if within limit', () => {
      const text = 'short text';
      const result = truncateToLimit(text, MODEL, RESERVE);
      expect(result.truncated).toBe(false);
      expect(result.text).toBe(text);
      expect(result.removedChars).toBe(0);
    });

    it('truncates text to fit limit', () => {
      // Available 900 tokens -> 3600 chars
      const longText = 'a'.repeat(4000);
      const result = truncateToLimit(longText, MODEL, RESERVE);

      expect(result.truncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(3600);
      expect(result.removedChars).toBe(4000 - result.text.length);
    });

    it('attempts to split at paragraph boundary', () => {
      // Limit 1000, Reserve 990 -> 10 tokens -> 40 chars.
      // 80% of 40 is 32. Need break point > 32.

      const prefix = 'a'.repeat(33); // 33 chars
      const text = `${prefix}\n\nSecond para is too long for this limit.`;

      // lastIndexOf('\n\n') will be at index 33. 33 > 32.
      // It should split there.

      const result = truncateToLimit(text, MODEL, 990);

      expect(result.truncated).toBe(true);
      expect(result.text).toBe(prefix);
    });

    it('falls back to sentence boundary if paragraph not found', () => {
      // Limit 1000, Reserve 990 -> 10 tokens -> 40 chars.
      // 90% of 40 is 36. Need break point > 36.

      const prefix = 'a'.repeat(37); // 37 chars
      const text = `${prefix}. Second sentence is very long.`;

      // lastIndexOf('. ') will be at index 37. 37 > 36.
      // breakPoint = 37 + 1 = 38.
      // substring(0, 38) -> "aaaaaaaa...a."

      const result = truncateToLimit(text, MODEL, 990);

      expect(result.truncated).toBe(true);
      expect(result.text).toBe(prefix + '.');
    });

    it('hard truncates if no boundaries found', () => {
      // Limit 1000, Reserve 990 -> 10 tokens -> 40 chars.
      const text = 'A'.repeat(50);

      const result = truncateToLimit(text, MODEL, 990);

      expect(result.truncated).toBe(true);
      expect(result.text.length).toBe(40);
      expect(result.text).toBe('A'.repeat(40));
    });

    it('handles empty text', () => {
       const result = truncateToLimit('', MODEL, RESERVE);
       expect(result.truncated).toBe(false);
       expect(result.text).toBe('');
    });
  });
});
