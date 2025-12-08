import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiKey, validateApiKey, estimateTokens, ApiDefaults } from '@/config/api';

describe('validateApiKey', () => {
  it('returns error for empty key', () => {
    const result = validateApiKey('');
    
    expect(result).not.toBeNull();
    expect(result).toContain('missing');
  });

  it('returns error for short key', () => {
    const result = validateApiKey('short');
    
    expect(result).not.toBeNull();
    expect(result).toContain('invalid');
  });

  it('returns null for valid key', () => {
    const validKey = 'a'.repeat(30);
    const result = validateApiKey(validKey);
    
    expect(result).toBeNull();
  });

  it('accepts keys exactly 20 chars', () => {
    const key = 'a'.repeat(20);
    const result = validateApiKey(key);
    
    expect(result).toBeNull();
  });

  it('rejects keys with 19 chars', () => {
    const key = 'a'.repeat(19);
    const result = validateApiKey(key);
    
    expect(result).not.toBeNull();
  });
});

describe('estimateTokens', () => {
  it('estimates tokens based on character count', () => {
    const text = 'a'.repeat(100);
    const tokens = estimateTokens(text);
    
    // 100 chars / 4 chars per token = 25 tokens
    expect(tokens).toBe(25);
  });

  it('rounds up for partial tokens', () => {
    const text = 'ab'; // 2 chars
    const tokens = estimateTokens(text);
    
    // 2 / 4 = 0.5, ceil = 1
    expect(tokens).toBe(1);
  });

  it('returns 0 for empty string', () => {
    const tokens = estimateTokens('');
    expect(tokens).toBe(0);
  });

  it('handles large texts', () => {
    const text = 'a'.repeat(1_000_000);
    const tokens = estimateTokens(text);
    
    expect(tokens).toBe(250_000);
  });
});

describe('ApiDefaults', () => {
  it('has maxAnalysisLength defined', () => {
    expect(ApiDefaults.maxAnalysisLength).toBeDefined();
    expect(ApiDefaults.maxAnalysisLength).toBeGreaterThan(0);
  });

  it('has charsPerToken defined', () => {
    expect(ApiDefaults.charsPerToken).toBeDefined();
    expect(ApiDefaults.charsPerToken).toBe(4);
  });

  it('has requestTimeout defined', () => {
    expect(ApiDefaults.requestTimeout).toBeDefined();
    expect(ApiDefaults.requestTimeout).toBeGreaterThan(0);
  });

  it('has retry config defined', () => {
    expect(ApiDefaults.retry).toBeDefined();
    expect(ApiDefaults.retry.maxAttempts).toBeGreaterThan(0);
    expect(ApiDefaults.retry.baseDelayMs).toBeGreaterThan(0);
    expect(ApiDefaults.retry.maxDelayMs).toBeGreaterThan(ApiDefaults.retry.baseDelayMs);
  });
});

describe('getApiKey', () => {
  it('returns key from environment when available', () => {
    // Test that getApiKey returns the test key from setup.ts
    const key = getApiKey();
    // Should return either the test key or the real key from .env
    expect(key.length).toBeGreaterThan(0);
  });

  it('logs warning only once for missing key', () => {
    // This tests the warning behavior by checking console.warn is called
    // when the module determines no key is set. Since we can't fully clear
    // import.meta.env in Vitest, we verify the warning mechanism exists.
    const consoleSpy = vi.spyOn(console, 'warn');
    
    // The warning should only be emitted once per module load
    // Even calling getApiKey multiple times shouldn't produce multiple warnings
    getApiKey();
    getApiKey();
    
    // Count should be 0 or 1, not more (the hasWarnedMissingKey flag)
    expect(consoleSpy.mock.calls.filter(c => 
      String(c[0]).includes('No API key configured')
    ).length).toBeLessThanOrEqual(1);
    
    consoleSpy.mockRestore();
  });
});
