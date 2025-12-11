
import { describe, it, expect, vi } from 'vitest';
import {
  processInstant,
  processDebounced,
  generateAIContext,
  generateSectionContext,
  mergeChapterIntelligence,
  createEmptyIntelligence
} from '@/services/intelligence/index';
import { ManuscriptIntelligence, StructuralFingerprint } from '@/types/intelligence';

describe('intelligence/index coverage', () => {

    it('processInstant should use cached structural if recent', () => {
        const cached: StructuralFingerprint = {
            stats: { totalWords: 100, totalSentences: 5, totalParagraphs: 2, avgSentenceLength: 0, sentenceLengthVariance: 0, dialogueRatio: 0, sceneCount: 0, povShifts: 0, avgSceneLength: 0 },
            scenes: [{ startOffset: 0, endOffset: 50, type: 'action', tension: 0.8, id: 's1' }],
            paragraphs: [],
            dialogueMap: [],
            processedAt: Date.now()
        } as any;

        const result = processInstant('New Text', 10, cached);

        expect(result.wordCount).toBe(100);
        expect(result.cursorScene).toBe('action');
        expect(result.cursorTension).toBe(0.8);
    });

    it('processInstant should recalculate if cache old or missing', () => {
        const cached: StructuralFingerprint = {
            stats: { totalWords: 100, totalSentences: 5, totalParagraphs: 2, avgSentenceLength: 0, sentenceLengthVariance: 0, dialogueRatio: 0, sceneCount: 0, povShifts: 0, avgSceneLength: 0 },
            scenes: [],
            paragraphs: [],
            dialogueMap: [],
            processedAt: Date.now() - 10000 // Old
        } as any;

        const text = "Word1 word2.";
        const result = processInstant(text, 0, cached);

        expect(result.wordCount).toBe(2);
    });

    it('processDebounced should analyze structure', () => {
        const text = `"Hello" he said.`;
        const result = processDebounced(text, 0);

        // It uses parseStructure internally.
        expect(result.wordCount).toBeGreaterThan(0);
        expect(result.cursorTension).toBeDefined();
    });

    it('mergeChapterIntelligence should merge correctly', () => {
        const chapter1 = createEmptyIntelligence('ch1');
        chapter1.structural.stats.totalWords = 100;
        chapter1.structural.scenes = [{ tension: 0.5 } as any];

        const chapter2 = createEmptyIntelligence('ch2');
        chapter2.structural.stats.totalWords = 200;
        chapter2.structural.scenes = [{ tension: 0.7 } as any];

        const merged = mergeChapterIntelligence([chapter1, chapter2]);

        expect(merged.projectStats.totalWords).toBe(300);
        expect(merged.projectStats.totalScenes).toBe(2);
        expect(merged.projectStats.avgTension).toBeCloseTo(0.6);
    });

    it('generateAIContext should generate string', () => {
        const intel = createEmptyIntelligence('ch1');
        const context = generateAIContext(intel, 0, false);
        // Expect output containing common sections
        expect(context).toContain('SITUATIONAL AWARENESS');
        expect(context).toContain('Position: Scene');
    });

    it('generateAIContext compressed should differ', () => {
        const intel = createEmptyIntelligence('ch1');
        const context = generateAIContext(intel, 0, true);
        expect(context).not.toBe(generateAIContext(intel, 0, false));
    });

    it('generateSectionContext should filter by range', () => {
        const intel = createEmptyIntelligence('ch1');
        intel.structural.scenes = [
            { startOffset: 0, endOffset: 10, type: 'action', tension: 0.5 } as any,
            { startOffset: 20, endOffset: 30, type: 'dialogue', tension: 0.2 } as any
        ];

        const context = generateSectionContext(intel, 0, 15);
        expect(context).toContain('action scene');
        expect(context).not.toContain('dialogue scene');
    });

    it('generateSectionContext should include entities and issues', () => {
        const intel = createEmptyIntelligence('ch1');
        intel.entities.nodes = [
            { name: 'Hero', type: 'character', mentions: [{ offset: 5 }] } as any
        ];
        intel.heatmap.sections = [
            { offset: 5, length: 5, flags: ['passive_voice'] } as any
        ];

        const context = generateSectionContext(intel, 0, 10);
        expect(context).toContain('Hero');
        expect(context).toContain('passive_voice');
    });
});
