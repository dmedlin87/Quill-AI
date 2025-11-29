import { describe, it, expect } from 'vitest';
import * as Config from '@/config';
import { getApiKey, ApiDefaults, ModelConfig, TokenLimits, ThinkingBudgets } from '@/config';

describe('config barrel index', () => {
  it('re-exports api helpers and model config', () => {
    expect(typeof Config.getApiKey).toBe('function');
    expect(Config.ApiDefaults).toBe(ApiDefaults);
    expect(Config.ModelConfig).toBe(ModelConfig);

    expect(Config.TokenLimits).toBe(TokenLimits);
    expect(Config.ThinkingBudgets).toBe(ThinkingBudgets);
  });

  it('keeps named exports in sync with direct imports', () => {
    expect(Config.getApiKey).toBe(getApiKey);
    expect(Config.ApiDefaults).toBe(ApiDefaults);
    expect(Config.ModelConfig).toBe(ModelConfig);
  });
});
