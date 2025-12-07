import { describe, it, expect } from 'vitest';
import {
  CRITIQUE_PRESETS,
  DEFAULT_CRITIQUE_INTENSITY,
  type CritiqueIntensity,
  type CritiquePreset,
} from '@/types/critiqueSettings';

describe('critiqueSettings types', () => {
  describe('CRITIQUE_PRESETS', () => {
    it('contains developmental preset', () => {
      expect(CRITIQUE_PRESETS.developmental).toBeDefined();
      expect(CRITIQUE_PRESETS.developmental.id).toBe('developmental');
      expect(CRITIQUE_PRESETS.developmental.label).toBe('Developmental');
    });

    it('contains standard preset', () => {
      expect(CRITIQUE_PRESETS.standard).toBeDefined();
      expect(CRITIQUE_PRESETS.standard.id).toBe('standard');
      expect(CRITIQUE_PRESETS.standard.label).toBe('Standard');
    });

    it('contains intensive preset', () => {
      expect(CRITIQUE_PRESETS.intensive).toBeDefined();
      expect(CRITIQUE_PRESETS.intensive.id).toBe('intensive');
      expect(CRITIQUE_PRESETS.intensive.label).toBe('Intensive');
    });

    it('each preset has required fields', () => {
      const presets = Object.values(CRITIQUE_PRESETS);
      
      presets.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(preset.label).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.color).toBeDefined();
      });
    });

    it('each preset has valid hex color', () => {
      const presets = Object.values(CRITIQUE_PRESETS);
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      presets.forEach((preset) => {
        expect(preset.color).toMatch(hexColorRegex);
      });
    });
  });

  describe('DEFAULT_CRITIQUE_INTENSITY', () => {
    it('is a valid CritiqueIntensity', () => {
      const validIntensities: CritiqueIntensity[] = ['developmental', 'standard', 'intensive'];
      
      expect(validIntensities).toContain(DEFAULT_CRITIQUE_INTENSITY);
    });

    it('defaults to standard', () => {
      expect(DEFAULT_CRITIQUE_INTENSITY).toBe('standard');
    });

    it('corresponds to an existing preset', () => {
      expect(CRITIQUE_PRESETS[DEFAULT_CRITIQUE_INTENSITY]).toBeDefined();
    });
  });
});
