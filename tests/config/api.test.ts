import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  validateApiKey, 
  estimateTokens, 
  ApiDefaults,
  getActiveApiKey, 
  markFreeQuotaExhausted, 
  resetQuotaState, 
  isUsingPaidKey, 
  isAnyApiKeyConfigured,
  getApiKey,
  resetWarningState
} from '@/config/api';

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
    resetWarningState();
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
    const key = getApiKey();
    expect(key).toBe('from-env');
  });

  it('logs warning only once for missing key', () => {
    const consoleSpy = vi.spyOn(console, 'warn');
    process.env.TEST_API_KEY_OVERRIDE = ' '; // trigger warning path

    getApiKey();
    getApiKey();

    const warningCalls = consoleSpy.mock.calls.filter(c =>
      String(c[0]).includes('No API key configured')
    );
    expect(warningCalls.length).toBeLessThanOrEqual(1);
    consoleSpy.mockRestore();
  });

  it('prefers API_KEY over GEMINI_API_KEY and trims whitespace', () => {
    process.env.API_KEY = '  primary-key  ';
    process.env.GEMINI_API_KEY = 'secondary-key';

    const key = getApiKey();

    expect(key).toBe('primary-key');
  });

  it('falls back to GEMINI_API_KEY without warning when API_KEY missing', () => {
    delete process.env.API_KEY;
    process.env.GEMINI_API_KEY = 'gem-key';
    const warnSpy = vi.spyOn(console, 'warn');

    const key = getApiKey();

    expect(key).toBe('gem-key');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses VITE_GEMINI_API_KEY when other env keys are missing', () => {
    process.env.VITE_GEMINI_API_KEY = 'vite-key';

    const key = getApiKey();

    expect(key).toBe('vite-key');
  });

  it('warns once and returns empty string when no keys are set', () => {
    process.env.TEST_API_KEY_OVERRIDE = ' ';
    const warnSpy = vi.spyOn(console, 'warn');

    const key = getApiKey();
    expect(key).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('No API key configured');
  });
});

describe('Dual API Key Management', () => {
    // We need to reload module to reset module-level state (freeQuotaExhausted) if possible,
    // or we just test the public API side effects.
    // Since `freeQuotaExhausted` is a module-level variable, we might need to use `resetQuotaState` if available,
    // or rely on isolation.
    // `resetQuotaState` is exported, so we should use it in beforeEach.

    const originalGetItem = Storage.prototype.getItem;
    const originalImportMeta = (globalThis as any).import?.meta;

    beforeEach(() => {
        vi.resetModules();
        resetQuotaState();
        resetWarningState();
        delete process.env.API_KEY;
        delete process.env.GEMINI_API_KEY;
        delete process.env.VITE_GEMINI_API_KEY;
        delete process.env.TEST_API_KEY_OVERRIDE;
        Storage.prototype.getItem = vi.fn(() => null);
        (globalThis as any).import = { meta: { env: {} } };
    });

    afterEach(() => {
        Storage.prototype.getItem = originalGetItem;
        if (originalImportMeta) {
          (globalThis as any).import = { meta: { ...originalImportMeta } };
        } else {
          delete (globalThis as any).import;
        }
    });

    it('returns env key when no store keys configured', () => {
        process.env.API_KEY = 'env-key';
        expect(getActiveApiKey()).toBe('env-key');
        expect(isUsingPaidKey()).toBe(false);
        expect(isAnyApiKeyConfigured()).toBe(true);
    });

    it('prioritizes free key when valid', () => {
        process.env.API_KEY = 'env-key';
        const mockState = JSON.stringify({
            state: { freeApiKey: 'a'.repeat(30), paidApiKey: '' }
        });
        Storage.prototype.getItem = vi.fn(() => mockState);

        expect(getActiveApiKey()).toBe('a'.repeat(30));
        expect(isUsingPaidKey()).toBe(false);
    });

    it('falls back to paid key if free key invalid/missing', () => {
        const mockState = JSON.stringify({
            state: { freeApiKey: '', paidApiKey: 'b'.repeat(30) }
        });
        Storage.prototype.getItem = vi.fn(() => mockState);

        expect(getActiveApiKey()).toBe('b'.repeat(30));
        expect(isUsingPaidKey()).toBe(true);
    });

    it('switches to paid key if free quota exhausted', () => {
        const freeKey = 'a'.repeat(30);
        const paidKey = 'b'.repeat(30);
        const mockState = JSON.stringify({
            state: { freeApiKey: freeKey, paidApiKey: paidKey }
        });
        Storage.prototype.getItem = vi.fn(() => mockState);

        // Initially uses free key
        expect(getActiveApiKey()).toBe(freeKey);
        expect(isUsingPaidKey()).toBe(false);

        // Exhaust quota
        markFreeQuotaExhausted();

        // Should switch to paid key
        expect(getActiveApiKey()).toBe(paidKey);
        expect(isUsingPaidKey()).toBe(true);
    });

    it('falls back to env key if both store keys missing', () => {
         process.env.API_KEY = 'env-key';
         const mockState = JSON.stringify({
            state: { freeApiKey: '', paidApiKey: '' }
        });
        Storage.prototype.getItem = vi.fn(() => mockState);
        
        expect(getActiveApiKey()).toBe('env-key');
    });

    it('correctly identifies if any key is configured', () => {
        Storage.prototype.getItem = vi.fn(() => null);
        delete process.env.API_KEY;
        expect(isAnyApiKeyConfigured()).toBe(false);

        process.env.API_KEY = 'env-key';
        expect(isAnyApiKeyConfigured()).toBe(true);

        delete process.env.API_KEY;
        Storage.prototype.getItem = vi.fn(() => JSON.stringify({ state: { freeApiKey: 'a'.repeat(25) }}));
        expect(isAnyApiKeyConfigured()).toBe(true);
    });
});
