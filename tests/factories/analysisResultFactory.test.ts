import { describe, it, expect } from 'vitest';
import { createAnalysisResult } from '@/tests/factories/analysisResultFactory';

describe('createAnalysisResult', () => {
  it('keeps base settingAnalysis when no override is provided', () => {
    const result = createAnalysisResult();

    expect(result.settingAnalysis).toBeDefined();
    expect(result.settingAnalysis?.issues?.[0]?.quote).toBe(
      'She checked her wristwatch under the gaslight.',
    );
  });

  it('merges settingAnalysis when override is provided', () => {
    const result = createAnalysisResult({
      settingAnalysis: {
        score: 10,
        analysis: 'Perfect setting continuity.',
        issues: [],
      },
    });

    expect(result.settingAnalysis?.score).toBe(10);
    expect(result.settingAnalysis?.analysis).toBe('Perfect setting continuity.');
    expect(result.settingAnalysis?.issues).toEqual([]);
  });
});
