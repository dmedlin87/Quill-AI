import { describe, it, expect } from 'vitest';
import { createCharacter, createAnalysisResult } from '@/tests/factories/analysisResultFactory';

describe('analysisResultFactory', () => {
  describe('createCharacter', () => {
    it('creates character with default values', () => {
      const character = createCharacter();
      
      expect(character.name).toBe('Aria');
      expect(character.bio).toBe('A determined protagonist.');
      expect(character.arcStages).toHaveLength(3);
    });

    it('allows overriding specific fields', () => {
      const character = createCharacter({ name: 'Custom Name', bio: 'Custom bio' });
      
      expect(character.name).toBe('Custom Name');
      expect(character.bio).toBe('Custom bio');
      expect(character.arc).toBe('Learns to trust others.');
    });

    it('merges overrides with defaults', () => {
      const character = createCharacter({ plotThreads: ['New thread'] });
      
      expect(character.plotThreads).toEqual(['New thread']);
      expect(character.relationships).toHaveLength(1);
    });
  });

  describe('createAnalysisResult', () => {
    it('creates analysis result with default values', () => {
      const result = createAnalysisResult();
      
      expect(result.summary).toContain('strong character work');
      expect(result.strengths).toHaveLength(2);
      expect(result.pacing.score).toBe(7);
      expect(result.characters).toHaveLength(1);
    });

    it('allows overriding top-level fields', () => {
      const result = createAnalysisResult({
        summary: 'Custom summary',
        strengths: ['One strength'],
      });
      
      expect(result.summary).toBe('Custom summary');
      expect(result.strengths).toEqual(['One strength']);
    });

    it('merges pacing overrides with defaults', () => {
      const result = createAnalysisResult({
        pacing: { score: 9, analysis: 'Excellent pacing', slowSections: [], fastSections: [] },
      });
      
      expect(result.pacing.score).toBe(9);
      expect(result.pacing.analysis).toBe('Excellent pacing');
    });

    it('merges settingAnalysis overrides when provided', () => {
      const result = createAnalysisResult({
        settingAnalysis: { score: 10, analysis: 'Perfect setting', issues: [] },
      });
      
      expect(result.settingAnalysis?.score).toBe(10);
      expect(result.settingAnalysis?.analysis).toBe('Perfect setting');
    });

    it('uses base settingAnalysis when override is undefined', () => {
      const result = createAnalysisResult({ summary: 'No setting override' });
      
      expect(result.settingAnalysis?.score).toBe(6);
    });

    it('handles null settingAnalysis override', () => {
      const result = createAnalysisResult({ settingAnalysis: undefined });
      
      expect(result.settingAnalysis).toBeDefined();
    });
  });
});
