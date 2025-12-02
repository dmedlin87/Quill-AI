import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clearModelModules = () => vi.resetModules();

describe('config/models', () => {
  beforeEach(() => {
    clearModelModules();
  });

  afterEach(() => {
    clearModelModules();
  });

  it('selects active model build based on environment variable', async () => {
    process.env.VITE_MODEL_BUILD = 'cheap';
    const { ModelConfig } = await import('@/config/models');

    expect(ModelConfig.analysis).toBe('gemini-2.5-flash');
    expect(ModelConfig.tools).toBe('gemini-2.5-flash');
  });

  it('falls back to default build for unknown environment', async () => {
    process.env.VITE_MODEL_BUILD = 'unknown-key';
    const { ModelConfig } = await import('@/config/models');

    expect(ModelConfig.analysis).toBe('gemini-3-pro-preview');
  });

  it('exposes pricing for known and legacy models', async () => {
    delete process.env.VITE_MODEL_BUILD;
    const { getModelPricing } = await import('@/config/models');

    expect(getModelPricing('gemini-3-pro-preview')).toEqual({ inputPrice: 1.25, outputPrice: 5 });
    expect(getModelPricing('gemini-1.5-pro')).toEqual({ inputPrice: 1.25, outputPrice: 5.0 });
    expect(getModelPricing('missing-model')).toBeNull();
  });
});
