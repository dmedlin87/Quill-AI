import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateApiKey, estimateTokens, ApiDefaults } from '@/config/api';

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
  const originalEnv = { ...process.env };
  const originalImportMeta = (globalThis as any).import?.meta;

  beforeEach(() => {
    vi.resetModules();
    // Start from a clean env to avoid leaking real keys into tests
    for (const key of Object.keys(process.env)) {
      delete (process.env as any)[key];
    }
    delete (process.env as any).TEST_API_KEY_OVERRIDE;
    (globalThis as any).import = { meta: { env: {} } };
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as any)[key];
    }
    Object.assign(process.env, originalEnv);
    if (originalImportMeta) {
      (globalThis as any).import = { meta: { ...originalImportMeta } };
    } else {
      delete (globalThis as any).import;
    }
  });

  it('returns key from environment when available', () => {
    process.env.API_KEY = 'from-env';
    return import('@/config/api').then(({ getApiKey }) => {
      const key = getApiKey();
      expect(key).toBe('from-env');
    });
  });

  it('logs warning only once for missing key', () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    process.env.TEST_API_KEY_OVERRIDE = ' '; // trigger warning path

    return import('@/config/api').then(({ getApiKey }) => {
      getApiKey();
      getApiKey();

      const warningCalls = consoleSpy.mock.calls.filter(c =>
        String(c[0]).includes('No API key configured')
      );
      expect(warningCalls.length).toBeLessThanOrEqual(1);
      consoleSpy.mockRestore();
    });
  });

  it('prefers API_KEY over GEMINI_API_KEY and trims whitespace', async () => {
    process.env.API_KEY = '  primary-key  ';
    process.env.GEMINI_API_KEY = 'secondary-key';

    const { getApiKey } = await import('@/config/api');
    const key = getApiKey();

    expect(key).toBe('primary-key');
  });

  it('falls back to GEMINI_API_KEY without warning when API_KEY missing', async () => {
    delete process.env.API_KEY;
    process.env.GEMINI_API_KEY = 'gem-key';
    const warnSpy = vi.spyOn(console, 'warn');

    const { getApiKey: freshGetApiKey } = await import('@/config/api');
    const key = freshGetApiKey();

    expect(key).toBe('gem-key');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses VITE_GEMINI_API_KEY when other env keys are missing', async () => {
    process.env.VITE_GEMINI_API_KEY = 'vite-key';

    const { getApiKey } = await import('@/config/api');
    const key = getApiKey();

    expect(key).toBe('vite-key');
  });

  it('warns once and returns empty string when no keys are set', async () => {
    process.env.TEST_API_KEY_OVERRIDE = ' ';
    const warnSpy = vi.spyOn(console, 'warn');

    const { getApiKey } = await import('@/config/api');
    const key = getApiKey();
    expect(key).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('No API key configured');
  });
});
