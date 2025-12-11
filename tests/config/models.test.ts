import { describe, it, expect, vi, afterEach } from 'vitest';
import { ActiveModels, ModelConfig, ModelPricing, getModelPricing, getActiveModelBuild, getActiveModels } from '../../config/models';

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

  describe('getActiveModelBuild', () => {
    const originalGetItem = Storage.prototype.getItem;

    afterEach(() => {
      Storage.prototype.getItem = originalGetItem;
    });

    it('returns default when no settings exist', () => {
      Storage.prototype.getItem = vi.fn(() => null);
      expect(getActiveModelBuild()).toBe('default');
    });

    it('returns stored build when valid', () => {
      const mockState = JSON.stringify({
        state: { modelBuild: 'cheap' },
        version: 0
      });
      Storage.prototype.getItem = vi.fn(() => mockState);
      expect(getActiveModelBuild()).toBe('cheap');
    });

    it('falls back to default on invalid JSON', () => {
      Storage.prototype.getItem = vi.fn(() => '{ invalid json');
      expect(getActiveModelBuild()).toBe('default');
    });

    it('falls back to default on invalid build key', () => {
       const mockState = JSON.stringify({
        state: { modelBuild: 'super-expensive-non-existent' },
        version: 0
      });
      Storage.prototype.getItem = vi.fn(() => mockState);
      expect(getActiveModelBuild()).toBe('default');
    });
    
    it('returns correct model set for active build', () => {
       // Mock cheap build
       const mockState = JSON.stringify({
        state: { modelBuild: 'cheap' },
        version: 0
      });
      Storage.prototype.getItem = vi.fn(() => mockState);
      
      const models = getActiveModels();
      // Cheap build has flash for analysis
      expect(models.analysis.id).toContain('flash');
    });
  });
});
