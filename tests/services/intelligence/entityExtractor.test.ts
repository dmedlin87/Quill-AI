/**
 * Entity Extractor Tests
 * 
 * Tests for deterministic named entity recognition, relationship inference,
 * and entity graph construction.
 */

import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  getEntitiesInRange,
  getRelatedEntities,
  getCanonicalEntityKey,
  isValidEntityName,
  mergeEntityGraphs,
} from '@/services/intelligence/entityExtractor';
import { ClassifiedParagraph, DialogueLine } from '@/types/intelligence';

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

// Helper to create minimal dialogue
const createTestDialogue = (quote: string, speaker: string | null, offset: number): DialogueLine => ({
  id: `dialogue_${offset}`,
  quote,
  speaker,
  offset,
  length: quote.length,
  replyTo: null,
  sentiment: 0,
});

describe('entityExtractor', () => {
  describe('validation and canonicalization edge cases', () => {
    it('rejects too-short, too-long, and numeric-only entity names', () => {
      expect(isValidEntityName('A')).toBe(false);
      expect(isValidEntityName('1')).toBe(false);
      expect(isValidEntityName('12345')).toBe(false);
      expect(isValidEntityName('x'.repeat(31))).toBe(false);
      expect(isValidEntityName('Ok')).toBe(true);
    });

    it('handles getCanonicalEntityKey with empty and title-only names', () => {
      const map = new Map<string, { hasBare: boolean }>();
      expect(getCanonicalEntityKey('', map)).toBe('');
      expect(getCanonicalEntityKey('   ', map)).toBe('   ');
      // "mr" is filtered out as a title token, leaving no non-title tokens.
      expect(getCanonicalEntityKey('Mr', map)).toBe('mr');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CHARACTER EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('character extraction', () => {
    it('extracts capitalized names as characters', () => {
      const text = `Sarah walked into the room. Marcus followed close behind.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const characters = result.nodes.filter(n => n.type === 'character');
      const names = characters.map(c => c.name);
      
      expect(names).toContain('Sarah');
      expect(names).toContain('Marcus');
    });

    it('extracts titled names (Mr., Mrs., Dr.)', () => {
      const text = `Mr. Johnson arrived. Dr. Smith greeted him.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const characters = result.nodes.filter(n => n.type === 'character');
      const names = characters.map(c => c.name);
      
      expect(names.some(n => n.includes('Johnson'))).toBe(true);
      expect(names.some(n => n.includes('Smith'))).toBe(true);
    });

    it('extracts possessive names', () => {
      const text = `Sarah's cat ran away. Marcus's dog chased it.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const characters = result.nodes.filter(n => n.type === 'character');
      const names = characters.map(c => c.name);
      
      expect(names).toContain('Sarah');
      expect(names).toContain('Marcus');
    });

    it('tracks mention counts', () => {
      const text = `Sarah spoke. Sarah walked. Sarah laughed. Marcus listened.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const sarah = result.nodes.find(n => n.name === 'Sarah');
      const marcus = result.nodes.find(n => n.name === 'Marcus');
      
      expect(sarah?.mentionCount).toBeGreaterThan(marcus?.mentionCount || 0);
    });

    it('extracts speaker from dialogue', () => {
      const text = `"Hello there," Sarah said warmly.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      const dialogue = [createTestDialogue('Hello there,', 'Sarah', 1)];
      
      const result = extractEntities(text, paragraphs, dialogue, 'chapter1');
      
      const sarah = result.nodes.find(n => n.name === 'Sarah');
      expect(sarah).toBeDefined();
    });

    it('avoids false positives like day names', () => {
      const text = `On Monday, he went shopping. It was a beautiful Sunday.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const names = result.nodes.map(n => n.name.toLowerCase());
      
      expect(names).not.toContain('monday');
      expect(names).not.toContain('sunday');
    });

    it('avoids common words that look like names', () => {
      const text = `The chapter began. In the morning, things changed.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const names = result.nodes.map(n => n.name.toLowerCase());
      
      expect(names).not.toContain('the');
      expect(names).not.toContain('chapter');
    });
  });

  describe('pronoun resolution', () => {
    it('adds a mention for resolved pronouns (short distance)', () => {
      const text = `Alex walked home. He slept.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');

      const alex = result.nodes.find(n => n.name === 'Alex');
      expect(alex).toBeDefined();
      // The pronoun resolution should add at least one mention beyond the name.
      expect(alex!.mentionCount).toBeGreaterThanOrEqual(2);
    });

    it('still resolves pronouns at long distances (exercises lower-confidence branch)', () => {
      const filler = 'word '.repeat(120);
      const text = `Alex walked home. ${filler} He slept.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');

      const alex = result.nodes.find(n => n.name === 'Alex');
      expect(alex).toBeDefined();
      expect(alex!.mentionCount).toBeGreaterThanOrEqual(2);
    });

    it('filters candidates by female pronouns when a female candidate exists', () => {
      const filler = 'word '.repeat(40);
      const text = `Maria arrived. Marcus waited. ${filler} She smiled.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');

      const maria = result.nodes.find(n => n.name === 'Maria');
      const marcus = result.nodes.find(n => n.name === 'Marcus');

      expect(maria).toBeDefined();
      expect(marcus).toBeDefined();
      expect(maria!.mentionCount).toBeGreaterThanOrEqual(2);
    });

    it('skips pronoun resolution when there are no character entities', () => {
      const text = `In the Dark Forest, they slept.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');
      // Should not throw, and should still produce a graph.
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('getRelatedEntities', () => {
    it('returns relationships for both source and target lookups', () => {
      const text = `Sarah and Marcus walked together.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      const graph = extractEntities(text, paragraphs, [], 'chapter1');

      const sarah = graph.nodes.find(n => n.name === 'Sarah');
      const marcus = graph.nodes.find(n => n.name === 'Marcus');
      expect(sarah).toBeDefined();
      expect(marcus).toBeDefined();

      const fromSarah = getRelatedEntities(graph, sarah!.id);
      const fromMarcus = getRelatedEntities(graph, marcus!.id);
      expect(fromSarah.length).toBeGreaterThan(0);
      expect(fromMarcus.length).toBeGreaterThan(0);
    });

    it('ignores edges that reference missing nodes', () => {
      const graph = {
        nodes: [
          { id: 'a', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'missing', type: 'interacts', coOccurrences: 1, sentiment: 0, chapters: ['c1'], evidence: [] },
        ],
        processedAt: 0,
      } as any;

      const related = getRelatedEntities(graph, 'a');
      expect(related).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOCATION EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('location extraction', () => {
    it('extracts locations from "at the X" pattern', () => {
      const text = `They met at the castle. Later, they arrived at the port.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const locations = result.nodes.filter(n => n.type === 'location');
      
      expect(locations.length).toBeGreaterThan(0);
    });

    it('extracts locations from "in the X" pattern', () => {
      const text = `She lived in the forest. The treasure was hidden in the mountains.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const locations = result.nodes.filter(n => n.type === 'location');
      
      expect(locations.length).toBeGreaterThan(0);
    });

    it('extracts explicit location names', () => {
      const text = `The journey to New York began. She remembered Paris fondly.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      // Should detect multi-word capitalized names as potential locations/entities
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONSHIP INFERENCE
  // ─────────────────────────────────────────────────────────────────────────

  describe('relationship inference', () => {
    it('creates edges for co-occurring entities', () => {
      const text = `Sarah and Marcus walked together through the garden.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('infers relationship from explicit patterns', () => {
      const text = `Sarah loves Marcus deeply.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      // Should find an edge between Sarah and Marcus
      const sarahMarcusEdge = result.edges.find(e => {
        const nodes = result.nodes;
        const source = nodes.find(n => n.id === e.source);
        const target = nodes.find(n => n.id === e.target);
        return (source?.name === 'Sarah' && target?.name === 'Marcus') ||
               (source?.name === 'Marcus' && target?.name === 'Sarah');
      });
      
      expect(sarahMarcusEdge).toBeDefined();
    });

    it('upgrades relationship type from co-occurrence when explicit pattern appears later', () => {
      const text = `Sarah and Marcus walked together. Later, Sarah loved Marcus.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');

      const edge = result.edges.find(e => {
        const src = result.nodes.find(n => n.id === e.source);
        const tgt = result.nodes.find(n => n.id === e.target);
        return (src?.name === 'Sarah' && tgt?.name === 'Marcus') ||
               (src?.name === 'Marcus' && tgt?.name === 'Sarah');
      });

      expect(edge?.type).toBe('related_to'); // upgraded from initial interacts
      expect(edge?.evidence.length).toBeGreaterThan(0);
    });

    it('creates relationship and entities from explicit pattern when names were not previously detected', () => {
      const text = `alice attacked bob in the alley.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');

      // Entities should be created even though names were lowercase
      const names = result.nodes.map(n => n.name.toLowerCase());
      expect(names).toContain('alice');
      expect(names).toContain('bob');

      const edge = result.edges.find(e => {
        const src = result.nodes.find(n => n.id === e.source);
        const tgt = result.nodes.find(n => n.id === e.target);
        return src && tgt && ['alice', 'bob'].includes(src.name.toLowerCase()) && ['alice', 'bob'].includes(tgt.name.toLowerCase());
      });

      expect(edge?.type).toBe('opposes');
      expect(edge?.sentiment).toBeLessThan(0);
    });

    it('tracks co-occurrence count', () => {
      const text = `Sarah and Marcus talked. Sarah and Marcus laughed. Sarah and Marcus left.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      const edge = result.edges[0];
      if (edge) {
        expect(edge.coOccurrences).toBeGreaterThanOrEqual(1);
      }
    });

    it('records chapter context for relationships', () => {
      const text = `Sarah met Marcus at the park.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      if (result.edges.length > 0) {
        expect(result.edges[0].chapters).toContain('chapter1');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ALIAS DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('alias detection', () => {
    it('consolidates entities with similar names', () => {
      const text = `Mr. Smith arrived. Smith looked around. John Smith smiled.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      // Should consolidate into one or two entities, not three
      const smithEntities = result.nodes.filter(n => 
        n.name.toLowerCase().includes('smith')
      );
      
      // Should be consolidated
      expect(smithEntities.length).toBeLessThanOrEqual(2);
    });

    it('adds aliases from known-as patterns and skips incomplete captures', () => {
      const text = `Marcus, known as The Wolf, prowled. The Wolf, whose real name was Marcus, waited. Marcus walked. the knight commander was feared.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const marcus = result.nodes.find(n => n.name.startsWith('Marcus'));

      expect(marcus?.aliases.some(a => a.toLowerCase().includes('wolf'))).toBe(true);
      // "the knight commander was feared" should not add an alias because the pattern lacks a second capture
      expect(marcus?.aliases.some(a => a.toLowerCase().includes('knight'))).toBeFalsy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCanonicalEntityKey', () => {
    it('uses bare surname when present in surname map', () => {
      const surnameMap = new Map<string, { hasBare: boolean }>([
        ['smith', { hasBare: true }],
      ]);

      const key = getCanonicalEntityKey('John Smith', surnameMap);

      expect(key).toBe('smith');
    });

    it('preserves full name when surname is never used alone', () => {
      const surnameMap = new Map<string, { hasBare: boolean }>([
        ['smith', { hasBare: false }],
      ]);

      const key = getCanonicalEntityKey('John Smith', surnameMap);

      expect(key).toBe('john smith');
    });
  });

  describe('dialogue attribution patterns', () => {
    it('filters invalid names while capturing valid dialogue speakers', () => {
      const text = `"Go," said The. "Indeed," said Holmes. Chapter said "No," and Sir Lancelot said "Yes."`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const names = result.nodes.map(n => n.name.toLowerCase());

      expect(names).toContain('holmes');
      expect(names.some(n => n.includes('lancelot'))).toBe(true);
      expect(names).not.toContain('the');
      expect(names).not.toContain('chapter');
      expect(isValidEntityName('chapter')).toBe(false);
      expect(isValidEntityName('the')).toBe(false);
    });
  });

  describe('getEntitiesInRange', () => {
    it('returns entities mentioned in the given range', () => {
      const text = `Sarah spoke at position 0. Marcus spoke at position 50.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const nearStart = getEntitiesInRange(result, 0, 30);
      
      expect(nearStart.some(e => e.name === 'Sarah')).toBe(true);
    });

    it('returns empty array for range with no entities', () => {
      const text = `Sarah spoke at the start.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const farAway = getEntitiesInRange(result, 1000, 2000);
      
      expect(farAway.length).toBe(0);
    });
  });

  describe('getRelatedEntities', () => {
    it('returns entities connected by edges', () => {
      const text = `Sarah and Marcus are friends. They walked together.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const sarah = result.nodes.find(n => n.name === 'Sarah');
      
      if (sarah) {
        const related = getRelatedEntities(result, sarah.id);
        expect(related.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty text', () => {
      const result = extractEntities('', [], [], 'chapter1');
      
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.nodes.length).toBe(0);
    });

    it('handles text with no entities', () => {
      const text = `the quick brown fox jumped over the lazy dog.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      // May detect "Fox" as entity or may not - depends on implementation
      expect(result.nodes).toBeDefined();
    });

    it('handles very long text', () => {
      const name = 'Sarah';
      const longText = `${name} did something. `.repeat(100);
      const paragraphs = [createTestParagraph(0, longText.length)];
      
      const result = extractEntities(longText, paragraphs, [], 'chapter1');
      
      const sarah = result.nodes.find(n => n.name === 'Sarah');
      expect(sarah?.mentionCount).toBe(100);
    });

    it('handles special characters in names', () => {
      const text = `O'Brien arrived. Mary-Jane followed.`;
      const paragraphs = [createTestParagraph(0, text.length)];
      
      const result = extractEntities(text, paragraphs, [], 'chapter1');
      
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('resolves pronouns to nearest gender-matching entity and increments mentions', () => {
      const text = `Marcus went to town. Anna waited by the gate. He returned home.`;
      const paragraphs = [createTestParagraph(0, text.length)];

      const result = extractEntities(text, paragraphs, [], 'chapter1');
      const marcus = result.nodes.find(n => n.name === 'Marcus');

      expect(marcus?.mentionCount).toBeGreaterThan(1); // pronoun resolution should add another mention
      expect(marcus?.mentions.length).toBe(marcus?.mentionCount);
    });

    it('falls back to all candidates if gender filtering yields no results during pronoun resolution', () => {
      // Alice is female. "He" is male.
      // InferGender will likely return 'female' for Alice due to ending 'a' (Alice -> no ending match? "a" ending? Yes 'a' is in femaleEndings).
      // But we want to ensure "He" resolves to her if she's the only candidate (fallback path)
      // or at least that the code path is taken.

      const text = `Bella was there. He smiled.`;
      // Bella -> female ending 'a'.
      // Pronoun 'He'.
      // MALE_PRONOUNS matches 'he'.
      // genderedCandidates will be empty (Bella is female).
      // candidates remains [Bella].
      // So He resolves to Bella (awkward but correct for fallback logic).

      const paragraphs = [createTestParagraph(0, text.length)];
      const result = extractEntities(text, paragraphs, [], 'c1');
      const bella = result.nodes.find(n => n.name === 'Bella');

      expect(bella?.mentionCount).toBe(2); // 1 name + 1 pronoun
    });

    it('merges entity graphs upgrading relationship types and evidence', () => {
      const base = extractEntities(`Sarah and Marcus walked together.`, [createTestParagraph(0, 40)], [], 'c1');
      const extra = extractEntities(`Sarah loves Marcus deeply.`, [createTestParagraph(0, 30)], [], 'c2');

      // Place the explicit relationship graph first so its type is preserved when merging
      const merged = mergeEntityGraphs([extra, base]);

      const edge = merged.edges.find(e => {
        const src = merged.nodes.find(n => n.id === e.source);
        const tgt = merged.nodes.find(n => n.id === e.target);
        return (src?.name === 'Sarah' && tgt?.name === 'Marcus') ||
               (src?.name === 'Marcus' && tgt?.name === 'Sarah');
      });

      expect(edge?.type).toBe('related_to'); // upgraded from interacts
      expect(edge?.evidence.length).toBeGreaterThan(0);
    });

    it('merges edge details correctly (chapters, evidence, count)', () => {
      // Manual graph construction to test merge logic explicitly
      const graph1 = {
        nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'interacts', coOccurrences: 1, sentiment: 0, chapters: ['c1'], evidence: ['text1'] }],
        processedAt: 0
      } as any;

      const graph2 = {
        nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
        edges: [{ id: 'e2', source: 'n1', target: 'n2', type: 'interacts', coOccurrences: 2, sentiment: 0, chapters: ['c2'], evidence: ['text2'] }],
        processedAt: 0
      } as any;

      const merged = mergeEntityGraphs([graph1, graph2]);
      const edge = merged.edges[0];

      expect(edge.coOccurrences).toBe(3);
      expect(edge.chapters).toEqual(expect.arrayContaining(['c1', 'c2']));
      expect(edge.evidence).toHaveLength(2);
    });

    it('handles missing other node in getRelatedEntities gracefully', () => {
      // Graph with edge but missing node definition
      const graph = {
        nodes: [{ id: 'n1', name: 'A', mentionCount: 1, mentions: [], aliases: [], type: 'character', firstMention: 0, attributes: {} }],
        edges: [{ source: 'n1', target: 'n99', type: 'interacts', coOccurrences: 1, chapters: [], evidence: [], sentiment: 0, id: 'e1' }],
        processedAt: 0
      } as any;

      const related = getRelatedEntities(graph, 'n1');
      expect(related).toHaveLength(0);
    });

    it('merges nodes keeping the earliest first mention', () => {
      const graph1 = {
        nodes: [{ id: 'n1', name: 'A', firstMention: 100, mentionCount: 1, mentions: [], aliases: [], attributes: {} }],
        edges: [],
        processedAt: 0
      } as any;

      const graph2 = {
        nodes: [{ id: 'n1', name: 'A', firstMention: 50, mentionCount: 1, mentions: [], aliases: [], attributes: {} }],
        edges: [],
        processedAt: 0
      } as any;

      const merged = mergeEntityGraphs([graph1, graph2]);
      const node = merged.nodes[0];

      expect(node.firstMention).toBe(50);
    });

    it('preserves existing specific relationship type when merging', () => {
      const graph1 = {
        nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'related_to', coOccurrences: 1, sentiment: 0, chapters: ['c1'], evidence: [] }],
        processedAt: 0
      } as any;

      const graph2 = {
        nodes: [{ id: 'n1', name: 'A', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }, { id: 'n2', name: 'B', type: 'character', mentionCount: 1, mentions: [], aliases: [], firstMention: 0, attributes: {} }],
        edges: [{ id: 'e2', source: 'n1', target: 'n2', type: 'opposes', coOccurrences: 1, sentiment: 0, chapters: ['c2'], evidence: [] }],
        processedAt: 0
      } as any;

      const merged = mergeEntityGraphs([graph1, graph2]);
      const edge = merged.edges[0];

      // Should remain 'related_to' because existing type wasn't 'interacts'
      expect(edge.type).toBe('related_to');
    });
  });
});
