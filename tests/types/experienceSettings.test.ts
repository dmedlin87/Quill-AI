import { describe, it, expect } from 'vitest';
import {
  EXPERIENCE_PRESETS,
  AUTONOMY_PRESETS,
  DEFAULT_EXPERIENCE,
  DEFAULT_AUTONOMY,
  type ExperienceLevel,
  type AutonomyMode,
} from '@/types/experienceSettings';

describe('experienceSettings types', () => {
  describe('EXPERIENCE_PRESETS', () => {
    it('contains novice preset', () => {
      expect(EXPERIENCE_PRESETS.novice).toBeDefined();
      expect(EXPERIENCE_PRESETS.novice.id).toBe('novice');
      expect(EXPERIENCE_PRESETS.novice.label).toBe('Novice');
    });

    it('contains intermediate preset', () => {
      expect(EXPERIENCE_PRESETS.intermediate).toBeDefined();
      expect(EXPERIENCE_PRESETS.intermediate.id).toBe('intermediate');
    });

    it('contains pro preset', () => {
      expect(EXPERIENCE_PRESETS.pro).toBeDefined();
      expect(EXPERIENCE_PRESETS.pro.id).toBe('pro');
    });

    it('each preset has required fields', () => {
      const presets = Object.values(EXPERIENCE_PRESETS);
      
      presets.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(preset.label).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.color).toBeDefined();
      });
    });
  });

  describe('AUTONOMY_PRESETS', () => {
    it('contains teach preset', () => {
      expect(AUTONOMY_PRESETS.teach).toBeDefined();
      expect(AUTONOMY_PRESETS.teach.id).toBe('teach');
      expect(AUTONOMY_PRESETS.teach.label).toBe('Teach Me');
    });

    it('contains copilot preset', () => {
      expect(AUTONOMY_PRESETS.copilot).toBeDefined();
      expect(AUTONOMY_PRESETS.copilot.id).toBe('copilot');
    });

    it('contains auto preset', () => {
      expect(AUTONOMY_PRESETS.auto).toBeDefined();
      expect(AUTONOMY_PRESETS.auto.id).toBe('auto');
      expect(AUTONOMY_PRESETS.auto.label).toBe('Auto-Pilot');
    });

    it('each preset has required fields', () => {
      const presets = Object.values(AUTONOMY_PRESETS);
      
      presets.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(preset.label).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.color).toBeDefined();
      });
    });
  });

  describe('DEFAULT_EXPERIENCE', () => {
    it('is a valid ExperienceLevel', () => {
      const validLevels: ExperienceLevel[] = ['novice', 'intermediate', 'pro'];
      expect(validLevels).toContain(DEFAULT_EXPERIENCE);
    });

    it('defaults to intermediate', () => {
      expect(DEFAULT_EXPERIENCE).toBe('intermediate');
    });
  });

  describe('DEFAULT_AUTONOMY', () => {
    it('is a valid AutonomyMode', () => {
      const validModes: AutonomyMode[] = ['teach', 'copilot', 'auto'];
      expect(validModes).toContain(DEFAULT_AUTONOMY);
    });

    it('defaults to copilot', () => {
      expect(DEFAULT_AUTONOMY).toBe('copilot');
    });
  });
});
