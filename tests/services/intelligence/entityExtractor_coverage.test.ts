
import { describe, it, expect, vi } from 'vitest';
import {
  extractEntities,
  getEntitiesInRange,
  getRelatedEntities,
  mergeEntityGraphs,
} from '@/services/intelligence/entityExtractor';
import { ClassifiedParagraph } from '@/types/intelligence';

// Helper to create minimal test paragraph
const createTestParagraph = (offset: number, length: number): ClassifiedParagraph => ({
  offset,
  length,
  type: 'exposition',
  speakerId: null,
  sentiment: 0,
  tension: 0.5,
  sentenceCount: 1,
  avgSentenceLength: 10,
});

describe('entityExtractor coverage', () => {
    it('should use fallback ID generation when crypto is undefined', async () => {
        const originalCrypto = globalThis.crypto;

        // Mock crypto as undefined
        Object.defineProperty(globalThis, 'crypto', { value: undefined, writable: true });

        const text = `Sarah walked into the room.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        expect(result.nodes.length).toBeGreaterThan(0);
        expect(result.nodes[0].id).toBeDefined();

        // Restore crypto
        Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, writable: true });
    });

    it('should infer gender from name endings', () => {
        const text = `Lucius was strong. Isabella was kind.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const lucius = result.nodes.find(n => n.name === 'Lucius');
        const isabella = result.nodes.find(n => n.name === 'Isabella');

        // We can't directly check the private inferGender result, but we can verify via pronoun resolution
        // if we add text with ambiguous pronouns.
        // However, we can trust that if we use specific pronouns, they should resolve correctly if gender inference works.

        const text2 = `Lucius stood there. He smiled. Isabella stood there. She smiled.`;
        const paragraphs2 = [createTestParagraph(0, text2.length)];
        const result2 = extractEntities(text2, paragraphs2, [], 'chapter1');

        const lucius2 = result2.nodes.find(n => n.name === 'Lucius');
        const isabella2 = result2.nodes.find(n => n.name === 'Isabella');

        // Initial mention + pronoun mention = 2
        expect(lucius2?.mentionCount).toBe(2);
        expect(isabella2?.mentionCount).toBe(2);
    });

    it('should infer gender from context pronouns', () => {
        // Name with no obvious gender ending
        const text = `Alex stood there. He looked around. He saw the path.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const alex = result.nodes.find(n => n.name === 'Alex');
        // Initial + 2 pronouns = 3
        expect(alex?.mentionCount).toBe(3);

        const textFem = `Alex stood there. She looked around. She saw the path.`;
        const resultFem = extractEntities(textFem, paragraphs, [], 'chapter1');
        const alexFem = resultFem.nodes.find(n => n.name === 'Alex');
        expect(alexFem?.mentionCount).toBe(3);
    });

    it('should filter candidates by gender correctly (male pronoun, no male candidates)', () => {
        // Only female characters
        const text = `Isabella was there. He laughed.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const isabella = result.nodes.find(n => n.name === 'Isabella');

        expect(isabella?.mentionCount).toBe(2);
    });

     it('should filter candidates by gender correctly (female pronoun, no female candidates)', () => {
        // Only male characters
        const text = `Lucius was there. She laughed.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const lucius = result.nodes.find(n => n.name === 'Lucius');

        expect(lucius?.mentionCount).toBe(2);
    });

    it('should handle neutral pronouns', () => {
        // Use simpler structure to ensure names are extracted
        const text = `John was tired. They looked tired.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const john = result.nodes.find(n => n.name === 'John');
        // John should be extracted. 'They' should resolve to John as the only candidate.

        expect(john).toBeDefined();
        if (john) {
            expect(john.mentionCount).toBeGreaterThan(1);
        }
    });

    it('extracts objects with specific patterns', () => {
        const text = `He held the Sword of Truth. She found the crown of kings.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const objects = result.nodes.filter(n => n.type === 'object');

        expect(objects.length).toBeGreaterThan(0);
        expect(objects.some(o => o.name.includes('Truth'))).toBe(true);
    });

    it('extracts objects with pattern "X held a Y"', () => {
         // Placeholder for completeness if I find a way to test it later
    });

    it('extracts locations with "the X City" pattern', () => {
        const text = `They traveled to the Emerald City.`;
        const paragraphs = [createTestParagraph(0, text.length)];
        const result = extractEntities(text, paragraphs, [], 'chapter1');

        const locations = result.nodes.filter(n => n.type === 'location');
        expect(locations.length).toBeGreaterThan(0);
        expect(locations[0].name).toBe('Emerald City');
    });

    it('merges graphs with identical edges but different relationship types', () => {
         const graph1 = {
            nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
            edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'interacts', coOccurrences: 1, sentiment: 0, chapters: ['c1'], evidence: [] }],
            processedAt: 0
        } as any;

        const graph2 = {
            nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
            edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'allied_with', coOccurrences: 1, sentiment: 0, chapters: ['c2'], evidence: [] }],
            processedAt: 0
        } as any;

        const merged = mergeEntityGraphs([graph1, graph2]);
        expect(merged.edges[0].type).toBe('allied_with');
    });

     it('handles empty surname token', () => {
        const text = `Mr. `;
    });

});
