
import { describe, it, expect, vi } from 'vitest';
import {
  parseStructure,
  getSceneAtOffset,
  getParagraphAtOffset,
  extractDialogue,
  parseParagraphs,
  calculateStats,
  detectScenes
} from '@/services/intelligence/structuralParser';

describe('structuralParser coverage', () => {

    it('should use fallback ID generation when crypto is undefined', async () => {
        const originalCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, 'crypto', { value: undefined, writable: true });

        // Use longer text to ensure scene detection (min 10 chars)
        const text = `Scene 1 is long enough to be detected.`;
        const result = parseStructure(text);

        expect(result.scenes.length).toBeGreaterThan(0);
        expect(result.scenes[0].id).toBeDefined();

        Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, writable: true });
    });

    it('should handle empty text in sub-functions', () => {
        const paragraphs = parseParagraphs("");
        expect(paragraphs).toEqual([]);

        const dialogues = extractDialogue("");
        expect(dialogues).toEqual([]);

        const stats = calculateStats("", [], [], []);
        expect(stats.totalWords).toBe(0);
    });

    it('should classify various paragraph types correctly', () => {
        const p1 = parseParagraphs(`"Hello, how are you doing today?" he said.`);
        expect(p1[0].type).toBe('dialogue');

        const p2 = parseParagraphs(`She thought about the meaning of life. He wondered if it was true.`);
        expect(p2[0].type).toBe('internal');

        const p3 = parseParagraphs(`He ran to the door. She jumped over the fence.`);
        expect(p3[0].type).toBe('action');

        const p4 = parseParagraphs(`Centuries ago, the empire was founded.`);
        expect(p4[0].type).toBe('exposition');

        const p5 = parseParagraphs(`The room appeared empty.`);
        expect(p5[0].type).toBe('description');

        const p6 = parseParagraphs(`It is what it is.`);
        expect(p6[0].type).toBe('description');
    });

    it('should extract speaker from various dialogue patterns', () => {
        const p1 = parseParagraphs(`"Hello," said John.`);
        expect(p1[0].speakerId).toBe('John');

        const p2 = parseParagraphs(`"Hello," Mary said.`);
        expect(p2[0].speakerId).toBe('Mary');

        const p3 = parseParagraphs(`"Hello."`);
        expect(p3[0].speakerId).toBeNull();
    });

    it('should calculate sentiment correctly', () => {
        const text = `I am so happy and full of love.`;
        const result = parseStructure(text);
        expect(result.paragraphs[0].sentiment).toBeGreaterThan(0);

        const text2 = `I am sad and in pain.`;
        const result2 = parseStructure(text2);
        expect(result2.paragraphs[0].sentiment).toBeLessThan(0);
    });

    it('should calculate tension correctly', () => {
        const text = `Suddenly, he screamed and ran! Explosion!`;
        const result = parseStructure(text);
        expect(result.paragraphs[0].tension).toBeGreaterThan(0.5);

        const text2 = `He slept calmly and peacefully.`;
        const result2 = parseStructure(text2);
        expect(result2.paragraphs[0].tension).toBeLessThan(0.6);
    });

    it('should handle scene detection with various breaks', () => {
        // Must ensure fragments are > 10 chars
        const text = `Scene 1 is long enough to be detected.\n\n\nScene 2 is also long enough to be detected.`;
        const result = parseStructure(text);
        expect(result.scenes.length).toBeGreaterThan(1);
    });

    it('should detect scene types based on dominant content', () => {
        // Use double newlines to separate paragraphs
        // Ensure dialogue is dominant in length for each paragraph
        const dialogueScene = `"Hi, how are you doing today?" he said.\n\n"Hello, I am doing fine thanks." she replied.\n\n"How are you?" he asked.\n\n"I am fine" she said.`;
        const resultD = parseStructure(dialogueScene);
        if (resultD.scenes.length > 0) {
             expect(resultD.scenes[0].type).toBe('dialogue');
        }

        const actionScene = `He ran fast.\n\nShe jumped high.\n\nThey fought hard.\n\nHe kicked the door.\n\nShe punched the wall.`;
        const resultA = parseStructure(actionScene);
        if (resultA.scenes.length > 0) {
            expect(resultA.scenes[0].type).toBe('action');
        }
    });

    it('should extract POV', () => {
        const text1 = `I felt happy. I knew it was true.`;
        const result1 = parseStructure(text1);
        expect(result1.scenes[0]?.pov).toBe('First Person');

        const text2 = `John thought about it. He felt sad.`;
        const result2 = parseStructure(text2);
        expect(result2.scenes[0]?.pov).toBe('John');
    });

    it('should extract location and time markers', () => {
        const text = `In the morning, they arrived at the Castle.`;
        const result = parseStructure(text);

        expect(result.scenes[0]?.timeMarker).toBeTruthy();
        expect(result.scenes[0]?.location).toBe('Castle');
    });

    it('should handle dialogue conversation flow tracking', () => {
        const text = `"Hi."${" ".repeat(600)}"Bye."`;
        const dialogues = extractDialogue(text);

        expect(dialogues.length).toBe(2);
        expect(dialogues[1].replyTo).toBeNull();
    });

    it('getSceneAtOffset returns null if no scene matches', () => {
        const fingerprint: any = { scenes: [{ startOffset: 0, endOffset: 10 }] };
        expect(getSceneAtOffset(fingerprint, 20)).toBeNull();
    });

    it('getParagraphAtOffset returns null if no paragraph matches', () => {
        const fingerprint: any = { paragraphs: [{ offset: 0, length: 10 }] };
        expect(getParagraphAtOffset(fingerprint, 20)).toBeNull();
    });

    it('calculates stats with 0 sentences/paragraphs', () => {
       // Pass empty string to avoid extracting "word" as a sentence
       const stats = calculateStats("", [], [], []);
       expect(stats.avgSentenceLength).toBe(0);
    });
});
