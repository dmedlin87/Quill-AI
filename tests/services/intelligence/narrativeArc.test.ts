import { describe, it, expect } from 'vitest';
import {
  analyzeNarrativeArc,
  getArcPhaseLabel,
  getCurrentArcPhase,
  getStructureDescription,
} from '@/services/intelligence/narrativeArc';
import { StructuralFingerprint, Scene } from '@/types/intelligence';

describe('Narrative Arc Analyzer', () => {
  // Helper to create mock scenes with specific tension
  const createMockScenes = (tensions: number[]): Scene[] => {
    return tensions.map((tension, index) => ({
      id: `scene-${index}`,
      content: `Scene ${index}`,
      startOffset: index * 100,
      endOffset: (index + 1) * 100,
      tension,
      importance: 0.5,
      entities: [],
      summary: `Summary ${index}`,
      timestamp: Date.now(),
      type: 'action',
      pov: '3rd person',
      location: 'Location',
      timeMarker: 'Day 1',
      dialogueRatio: 0.5
    }));
  };

  const createMockFingerprint = (tensions: number[]): StructuralFingerprint => ({
    scenes: createMockScenes(tensions),
    paragraphs: [],
    dialogueMap: [],
    stats: {
      totalWords: 0,
      totalSentences: 0,
      totalParagraphs: 0,
      avgSentenceLength: 0,
      sentenceLengthVariance: 0,
      dialogueRatio: 0,
      sceneCount: tensions.length,
      povShifts: 0,
      avgSceneLength: 100
    },
    processedAt: Date.now()
  });

  describe('analyzeNarrativeArc', () => {
    it('should identify phases in a standard arc', () => {
      // Create a classic arc: low start, rise, climax, fall
      const tensions = [0.1, 0.2, 0.4, 0.6, 0.8, 0.95, 0.7, 0.3, 0.1];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);

      expect(result.tensionCurve).toEqual(tensions);
      expect(result.climaxSceneIndex).toBe(5); // 0.95 is at index 5
      
      // Check phases
      const phases = result.arcs.map(a => a.phase);
      expect(phases).toContain('setup');
      expect(phases).toContain('rising_action');
      expect(phases).toContain('climax');
      expect(phases).toContain('falling_action');
      expect(phases).toContain('resolution');

      // Verify climax arc
      const climaxArc = result.arcs.find(a => a.phase === 'climax');
      expect(climaxArc).toBeDefined();
      expect(climaxArc?.startScene).toBe(5);
    });

    it('should detect 3-act structure', () => {
      const tensions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9, 0.5, 0.3, 0.2]; // Climax at ~70%
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);
      expect(result.structureType).toBe('three_act');
    });

    it('should detect in medias res structure', () => {
      // High tension at start
      const tensions = [0.9, 0.8, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.5, 0.3];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);
      expect(result.structureType).toBe('in_medias_res');
    });

    it('should detect episodic structure', () => {
      // Multiple peaks
      const tensions = [0.2, 0.8, 0.3, 0.8, 0.2, 0.8, 0.3];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);
      expect(result.structureType).toBe('episodic');
    });

    it('should handle empty scenes', () => {
      const structural = createMockFingerprint([]);

      const result = analyzeNarrativeArc(structural);
      expect(result.arcs).toEqual([]);
      expect(result.climaxSceneIndex).toBe(0);
      expect(result.suggestions).toEqual([]);
    });

    it('should generate suggestions for poor pacing', () => {
      // Flat line - terrible pacing
      const tensions = [0.5, 0.5, 0.5, 0.5, 0.5];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);
      expect(result.pacingScore).toBeLessThan(0.6);
      expect(result.suggestions.some(s => s.includes('pacing'))).toBe(true);
    });

    it('should generate suggestions for late climax', () => {
      const tensions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]; // Climax at very end
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);
      expect(result.suggestions.some(s => s.includes('climax is very close to the end'))).toBe(true);
    });
  });

  describe('helper utilities', () => {
    it('handles a single-scene manuscript with appropriate suggestions', () => {
      const tensions = [0.5];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);

      expect(result.arcs).toHaveLength(1);
      expect(result.arcs[0].phase).toBe('setup');
      expect(result.structureType).toBe('unknown');

      const suggestionsText = result.suggestions.join(' ');
      expect(suggestionsText).toContain('setup/exposition phase is quite long');
      expect(suggestionsText).toContain('may end abruptly');
      expect(suggestionsText).toContain('climax occurs quite early');
    });

    it('returns unknown structure type for very short manuscripts', () => {
      const tensions = [0.2, 0.9];
      const structural = createMockFingerprint(tensions);

      const result = analyzeNarrativeArc(structural);

      expect(result.arcs.length).toBeGreaterThan(0);
      expect(result.structureType).toBe('unknown');
    });

    it('gets current arc phase for a cursor offset and returns null when outside all arcs', () => {
      const tensions = [0.1, 0.2, 0.4, 0.6, 0.8, 0.95, 0.7, 0.3, 0.1];
      const structural = createMockFingerprint(tensions);

      const analysis = analyzeNarrativeArc(structural);
      const climaxArc = analysis.arcs.find(a => a.phase === 'climax');
      expect(climaxArc).toBeDefined();

      if (!climaxArc) return;

      const inside = getCurrentArcPhase(analysis, climaxArc.startOffset + 1);
      expect(inside).not.toBeNull();
      expect(inside?.phase).toBe('climax');

      const outside = getCurrentArcPhase(analysis, 999999);
      expect(outside).toBeNull();
    });

    it('maps arc phases to human-readable labels', () => {
      expect(getArcPhaseLabel('setup')).toContain('Setup');
      expect(getArcPhaseLabel('rising_action')).toContain('Rising');
      expect(getArcPhaseLabel('climax')).toContain('Climax');
      expect(getArcPhaseLabel('falling_action')).toContain('Falling');
      expect(getArcPhaseLabel('resolution')).toContain('Resolution');
      // @ts-expect-error intentional invalid phase to exercise default branch
      expect(getArcPhaseLabel('unknown_phase')).toBe('Unknown');
    });

    it('describes narrative structure types', () => {
      expect(getStructureDescription('three_act')).toContain('three-act');
      expect(getStructureDescription('hero_journey')).toContain("Hero's Journey");
      expect(getStructureDescription('in_medias_res')).toContain('In Medias Res');
      expect(getStructureDescription('episodic')).toContain('Episodic');
      expect(getStructureDescription('frame_story')).toContain('Frame narrative');
      expect(getStructureDescription('nonlinear')).toContain('Non-linear');
      expect(getStructureDescription('unknown')).toContain('not clearly identifiable');
    });
  });
});
