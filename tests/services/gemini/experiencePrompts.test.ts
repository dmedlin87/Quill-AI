import { describe, it, expect } from 'vitest';
import { EXPERIENCE_MODIFIERS, AUTONOMY_MODIFIERS, getExperienceModifier, getAutonomyModifier } from '@/services/gemini/experiencePrompts';

describe('experiencePrompts', () => {
  it('defines modifiers for all experience levels', () => {
    expect(EXPERIENCE_MODIFIERS.novice).toBeDefined();
    expect(EXPERIENCE_MODIFIERS.intermediate).toBeDefined();
    expect(EXPERIENCE_MODIFIERS.pro).toBeDefined();
    expect(EXPERIENCE_MODIFIERS.novice).toContain('NOVICE');
  });

  describe('getExperienceModifier', () => {
    it('returns correct modifier for valid level', () => {
      expect(getExperienceModifier('pro')).toBe(EXPERIENCE_MODIFIERS.pro);
    });

    it('returns intermediate modifier for invalid level', () => {
       expect(getExperienceModifier('expert' as any)).toBe(EXPERIENCE_MODIFIERS.intermediate);
    });
  });

  describe('getAutonomyModifier', () => {
    it('returns correct modifier for valid mode', () => {
      expect(getAutonomyModifier('teach')).toBe(AUTONOMY_MODIFIERS.teach);
    });

    it('returns copilot modifier for invalid mode', () => {
      expect(getAutonomyModifier('rogue' as any)).toBe(AUTONOMY_MODIFIERS.copilot);
    });
  });
});
