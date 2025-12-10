import { describe, it, expect } from 'vitest';
import { ActiveModels, ModelConfig, ModelPricing, getModelPricing } from '../../config/models';

describe('Model configuration', () => {
  it('exposes active model identifiers', () => {
    expect(ModelConfig.analysis).toBe(ActiveModels.analysis.id);
    expect(ModelConfig.agent).toBe(ActiveModels.agent.id);
    expect(ModelConfig.tts).toBe(ActiveModels.tts.id);
    expect(ModelConfig.liveAudio).toBe(ActiveModels.liveAudio.id);
    expect(ModelConfig.tools).toBe(ActiveModels.tools.id);
    expect(ModelConfig.pro).toBe(ModelConfig.analysis);
    expect(ModelConfig.flash).toBe(ModelConfig.agent);
  });

  it('returns pricing information or null', () => {
    expect(getModelPricing('gemini-1.5-pro')).toEqual({ inputPrice: 1.25, outputPrice: 5.0 });
    expect(getModelPricing('nonexistent-model')).toBeNull();
    expect(Object.isFrozen(ModelPricing)).toBe(true);
  });
});
