import { describe, it, expect } from 'vitest';
import { INTENSITY_MODIFIERS, getIntensityModifier } from '@/services/gemini/critiquePrompts';

describe('critiquePrompts', () => {
  it('defines modifiers for all intensity levels', () => {
    expect(INTENSITY_MODIFIERS.developmental).toBeDefined();
    expect(INTENSITY_MODIFIERS.standard).toBeDefined();
    expect(INTENSITY_MODIFIERS.intensive).toBeDefined();
    expect(INTENSITY_MODIFIERS.developmental).toContain('DEVELOPMENTAL');
  });

  it('returns correct modifier for valid intensity', () => {
    expect(getIntensityModifier('intensive')).toBe(INTENSITY_MODIFIERS.intensive);
  });

  it('returns standard modifier for invalid intensity', () => {
    expect(getIntensityModifier('unknown' as any)).toBe(INTENSITY_MODIFIERS.standard);
  });
});
