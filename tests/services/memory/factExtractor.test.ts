import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractFacts,
  extractFactsToMemories,
  extractNewFacts,
  findContradictingFacts,
  type ExtractedFact,
} from '@/services/memory/factExtractor';
import type { ManuscriptIntelligence, EntityGraph, Timeline } from '@/types/intelligence';

// Mock memory operations
vi.mock('@/services/memory/index', () => ({
  createMemory: vi.fn(),
  getMemories: vi.fn(),
}));

vi.mock('@/services/memory/semanticDedup', () => ({
  isSemanticDuplicate: vi.fn(),
}));

import { createMemory, getMemories } from '@/services/memory/index';
import { isSemanticDuplicate } from '@/services/memory/semanticDedup';

// Helper to create minimal mock intelligence
const createMockIntelligence = (overrides?: {
  entities?: Partial<EntityGraph>;
  timeline?: Partial<Timeline>;
}): ManuscriptIntelligence => ({
  chapterId: 'ch-1',
  structural: {
    scenes: [],
    paragraphs: [],
    dialogueMap: [],
    stats: { totalWords: 100, totalSentences: 10, totalParagraphs: 5, avgSentenceLength: 10, sentenceLengthVariance: 2, dialogueRatio: 0.3, sceneCount: 1, povShifts: 0, avgSceneLength: 100 },
    processedAt: Date.now(),
  },
  entities: {
    nodes: [],
    edges: [],
    processedAt: Date.now(),
    ...overrides?.entities,
  },
  timeline: {
    events: [],
    causalChains: [],
    promises: [],
    processedAt: Date.now(),
    ...overrides?.timeline,
  },
  style: {
    vocabulary: { uniqueWords: 50, totalWords: 100, avgWordLength: 5, lexicalDiversity: 0.5, topWords: [], overusedWords: [], rareWords: [] },
    syntax: { avgSentenceLength: 10, sentenceLengthVariance: 2, minSentenceLength: 3, maxSentenceLength: 20, paragraphLengthAvg: 50, dialogueToNarrativeRatio: 0.3, questionRatio: 0.1, exclamationRatio: 0.02 },
    rhythm: { syllablePattern: [], punctuationDensity: 5, avgClauseCount: 2 },
    flags: { passiveVoiceRatio: 0.1, passiveVoiceInstances: [], adverbDensity: 0.02, adverbInstances: [], filterWordDensity: 0.01, filterWordInstances: [], clicheCount: 0, clicheInstances: [], repeatedPhrases: [] },
    processedAt: Date.now(),
  },
  voice: { profiles: {}, consistencyAlerts: [] },
  heatmap: { sections: [], hotspots: [], processedAt: Date.now() },
  delta: { changedRanges: [], invalidatedSections: [], affectedEntities: [], newPromises: [], resolvedPromises: [], contentHash: 'hash', processedAt: Date.now() },
  hud: {
    situational: { currentScene: null, currentParagraph: null, narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 }, tensionLevel: 'low', pacing: 'slow' },
    context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
    styleAlerts: [],
    prioritizedIssues: [],
    recentChanges: [],
    stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 10 },
    lastFullProcess: Date.now(),
    processingTier: 'instant',
  },
});

describe('factExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFacts', () => {
    it('returns empty array for intelligence with no entities or timeline', () => {
      const intelligence = createMockIntelligence();
      const facts = extractFacts(intelligence);

      expect(facts).toEqual([]);
    });

    it('extracts facts from entity attributes', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            {
              id: 'ent-1',
              name: 'Sarah',
              type: 'character',
              aliases: [],
              firstMention: 10,
              mentionCount: 5,
              mentions: [],
              attributes: { hair: ['blonde'], eyes: ['blue'] },
            },
          ],
          edges: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.subject === 'Sarah' && f.predicate === 'has hair')).toBe(true);
      expect(facts.some((f) => f.subject === 'Sarah' && f.predicate === 'has eyes')).toBe(true);
    });

    it('skips non-character entities and empty attribute values', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            {
              id: 'loc-1',
              name: 'Paris',
              type: 'location',
              aliases: ['The City of Light'],
              firstMention: 5,
              mentionCount: 2,
              mentions: [],
              attributes: { setting: ['urban'] },
            },
            {
              id: 'char-1',
              name: 'Sarah',
              type: 'character',
              aliases: [],
              firstMention: 10,
              mentionCount: 5,
              mentions: [],
              attributes: { hair: [] },
            },
          ],
          edges: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.subject === 'Paris')).toBe(false);
      expect(facts.some((f) => f.subject === 'Sarah' && f.predicate === 'has hair')).toBe(false);
    });

    it('extracts facts from entity aliases', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            {
              id: 'ent-1',
              name: 'Sarah',
              type: 'character',
              aliases: ['the detective', 'S'],
              firstMention: 10,
              mentionCount: 5,
              mentions: [],
              attributes: {},
            },
          ],
          edges: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'is also known as' && f.object === 'the detective')).toBe(true);
    });

    it('extracts facts from entity relationships', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
            { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            { id: 'edge-1', source: 'e1', target: 'e2', type: 'interacts', coOccurrences: 5, sentiment: 0.5, chapters: [], evidence: ['They talked'] },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.subject === 'Sarah' && f.object === 'Marcus')).toBe(true);
    });

    it('skips relationship edges when source or target node is missing', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            { id: 'edge-1', source: 'e1', target: 'missing', type: 'interacts', coOccurrences: 5, sentiment: 0.5, chapters: [], evidence: ['They talked'] },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.sourceType === 'relationship')).toBe(false);
    });

    it('uses edge.type as predicate when not in relationship map and omits evidence when none provided', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Lady Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
            { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            { id: 'edge-1', source: 'e1', target: 'e2', type: 'mysterious', coOccurrences: 1, sentiment: 0.8, chapters: [] } as any,
          ],
        },
      });

      const facts = extractFacts(intelligence);

      const baseRel = facts.find((f) => f.sourceType === 'relationship' && f.predicate === 'mysterious');
      expect(baseRel).toBeDefined();
      expect(baseRel?.evidence).toBeUndefined();

      // Positive sentiment should add an inferred relationship fact
      expect(facts.some((f) => f.predicate === 'has positive relationship with')).toBe(true);
    });

    it('extracts positive/negative relationship facts based on sentiment', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
            { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            { id: 'edge-1', source: 'e1', target: 'e2', type: 'interacts', coOccurrences: 5, sentiment: -0.5, chapters: [], evidence: [] },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate.includes('conflict'))).toBe(true);
    });

    it('does not add sentiment-derived facts when sentiment is neutral', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
            { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            // sentiment within [-0.3, 0.3] should not produce extra relationship/conflict facts
            { id: 'edge-1', source: 'e1', target: 'e2', type: 'interacts', coOccurrences: 1, sentiment: 0, chapters: [], evidence: [] },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'has positive relationship with')).toBe(false);
      expect(facts.some((f) => f.predicate === 'has conflict with')).toBe(false);
    });

    it('extracts facts from timeline events', () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [
            { id: 'evt-1', description: 'The meeting occurred', offset: 100, chapterId: 'ch-1', temporalMarker: 'that morning', relativePosition: 'before', dependsOn: [] },
          ],
          causalChains: [],
          promises: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'occurs')).toBe(true);
    });

    it('does not create timeline facts for events without temporalMarker', () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [
            { id: 'evt-1', description: 'Something happened', offset: 100, chapterId: 'ch-1', temporalMarker: undefined, relativePosition: 'before', dependsOn: [] },
          ],
          causalChains: [],
          promises: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.sourceType === 'timeline' && f.predicate === 'occurs')).toBe(false);
    });

    it('extracts facts from causal chains', () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [
            {
              id: 'chain-1',
              cause: { eventId: 'e1', quote: 'He lied to her', offset: 50 },
              effect: { eventId: 'e2', quote: 'She left town', offset: 100 },
              confidence: 0.8,
              marker: 'because',
            },
          ],
          promises: [],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'causes')).toBe(true);
    });

    it('extracts facts from plot promises', () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [],
          promises: [
            { id: 'p1', type: 'foreshadowing', description: 'The locked door', quote: 'The door remained locked', offset: 50, chapterId: 'ch-1', resolved: false },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'remains unresolved')).toBe(true);
    });

    it('marks resolved plot promises correctly', () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [],
          promises: [
            { id: 'p1', type: 'setup', description: 'The broken sword', quote: 'The sword finally mended', offset: 80, chapterId: 'ch-2', resolved: true },
          ],
        },
      });

      const facts = extractFacts(intelligence);

      expect(facts.some((f) => f.predicate === 'was resolved')).toBe(true);
    });

    it('sorts facts by confidence descending', () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: ['S'], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const facts = extractFacts(intelligence);

      for (let i = 1; i < facts.length; i++) {
        expect(facts[i - 1].confidence).toBeGreaterThanOrEqual(facts[i].confidence);
      }
    });
  });

  describe('extractFactsToMemories', () => {
    beforeEach(() => {
      vi.mocked(createMemory).mockResolvedValue({ id: 'new-mem' } as any);
      vi.mocked(isSemanticDuplicate).mockResolvedValue({ isDuplicate: false, similarity: 0 });
    });

    it('extracts facts without creating memories when createMemories is false', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        createMemories: false,
      });

      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.memoriesCreated).toBe(0);
      expect(createMemory).not.toHaveBeenCalled();
    });

    it('creates memories for extracted facts', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        createMemories: true,
      });

      expect(result.memoriesCreated).toBeGreaterThan(0);
      expect(createMemory).toHaveBeenCalled();
    });

    it('skips duplicates when skipDuplicates is true', async () => {
      vi.mocked(isSemanticDuplicate).mockResolvedValue({ isDuplicate: true, similarity: 0.9 });

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        skipDuplicates: true,
      });

      expect(result.memoriesSkipped).toBeGreaterThan(0);
      expect(result.memoriesCreated).toBe(0);
    });

    it('respects minConfidence filter', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        minConfidence: 0.99, // Very high - should filter most facts
      });

      expect(result.facts.every((f) => f.confidence >= 0.99)).toBe(true);
    });

    it('respects maxFacts limit', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: ['S', 'Detective'], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'], hair: ['blonde'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        maxFacts: 2,
      });

      expect(result.facts.length).toBeLessThanOrEqual(2);
    });

    it('handles errors gracefully and records them', async () => {
      vi.mocked(createMemory).mockRejectedValue(new Error('DB error'));

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
      });

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('generates relationship and conflict tags for relationship-based facts', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
            { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'e1',
              target: 'e2',
              type: 'opposes',
              coOccurrences: 3,
              sentiment: -0.8,
              chapters: [],
              evidence: ['They fought in the alley'],
            },
          ],
        },
      });

      await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        createMemories: true,
      });

      expect(createMemory).toHaveBeenCalled();
      const createdPayloads = vi.mocked(createMemory).mock.calls.map((call) => call[0]);
      const relationshipMemory = createdPayloads.find((m) => m.topicTags?.includes('relationship'));

      expect(relationshipMemory).toBeDefined();
      // For a strong opposing relationship we should also tag it as a conflict
      expect(relationshipMemory!.topicTags).toContain('conflict');
      // Character tags should be derived from subject/object names
      expect(relationshipMemory!.topicTags).toEqual(
        expect.arrayContaining([
          'source:relationship',
          'character:sarah',
          'character:marcus',
        ]),
      );
    });

    it('adds timeline tag when timeline facts are extracted', async () => {
      const intelligence = createMockIntelligence({
        timeline: {
          events: [
            {
              id: 'evt-1',
              description: 'The meeting occurred',
              offset: 100,
              chapterId: 'ch-1',
              temporalMarker: 'that morning',
              relativePosition: 'before',
              dependsOn: [],
            },
          ],
          causalChains: [],
          promises: [],
        },
      });

      const result = await extractFactsToMemories(intelligence, {
        projectId: 'proj-1',
        createMemories: true,
        skipDuplicates: false,
        maxFacts: 1,
        minConfidence: 0,
      });

      expect(result.memoriesCreated).toBe(1);
      expect(createMemory).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(createMemory).mock.calls[0]?.[0];
      expect(payload.topicTags).toEqual(expect.arrayContaining(['source:timeline', 'timeline']));
      expect(payload.type).toBe('fact');
    });
  });

  describe('extractNewFacts', () => {
    it('filters out facts that already exist as memories', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        { id: 'mem-1', text: 'sarah has eyes blue', type: 'fact' } as any,
      ]);

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'], hair: ['blonde'] } },
          ],
          edges: [],
        },
      });

      const newFacts = await extractNewFacts(intelligence, 'proj-1');

      // Should not include the eyes fact since it exists
      expect(newFacts.some((f) => f.predicate === 'has eyes' && f.object === 'blue')).toBe(false);
    });

    it('returns all facts when no existing memories', async () => {
      vi.mocked(getMemories).mockResolvedValue([]);

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const newFacts = await extractNewFacts(intelligence, 'proj-1');

      expect(newFacts.length).toBeGreaterThan(0);
    });
  });

  describe('findContradictingFacts', () => {
    it('finds contradictions between new facts and existing memories', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        { id: 'mem-1', text: 'Sarah has eyes green', type: 'fact' } as any,
      ]);

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const contradictions = await findContradictingFacts(intelligence, 'proj-1');

      // Should find contradiction: existing says green, new says blue
      expect(contradictions.some((c) => c.existingMemory.includes('green') && c.newFact.object === 'blue')).toBe(true);
    });

    it('returns empty array when no contradictions', async () => {
      vi.mocked(getMemories).mockResolvedValue([
        { id: 'mem-1', text: 'Marcus lives in Paris', type: 'fact' } as any,
      ]);

      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: { eyes: ['blue'] } },
          ],
          edges: [],
        },
      });

      const contradictions = await findContradictingFacts(intelligence, 'proj-1');

      expect(contradictions).toHaveLength(0);
    });
  });
});
