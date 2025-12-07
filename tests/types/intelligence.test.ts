import { describe, it, expect } from 'vitest';
import type {
  SceneType,
  ParagraphType,
  Scene,
  ClassifiedParagraph,
  DialogueLine,
  StructuralStats,
  StructuralFingerprint,
  EntityType,
  RelationshipType,
  EntityNode,
  EntityEdge,
  EntityGraph,
  TemporalRelation,
  TimelineEvent,
  CausalChain,
  PlotPromise,
  Timeline,
  VocabularyMetrics,
  SyntaxMetrics,
  RhythmMetrics,
  StyleFlags,
  StyleFingerprint,
  VoiceMetrics,
  VoiceProfile,
  VoiceFingerprint,
  RiskFlag,
  HeatmapSection,
  AttentionHeatmap,
  ChangeType,
  TextChange,
  ManuscriptDelta,
  SituationalAwareness,
  RelevantContext,
  ManuscriptHUD,
  ManuscriptIntelligence,
  ChunkId,
  ChunkStatus,
  ChunkLevel,
  ChunkRecord,
  ChunkAnalysis,
  AggregateSummary,
  ChunkEdit,
  ChunkJob,
  ChunkIndexState,
  ProcessingTier,
  ProcessingConfig,
} from '@/types/intelligence';
import { DEFAULT_PROCESSING_CONFIG } from '@/types/intelligence';

describe('types/intelligence', () => {
  describe('Scene types', () => {
    it('SceneType accepts valid values', () => {
      const types: SceneType[] = ['action', 'dialogue', 'description', 'introspection', 'transition'];
      expect(types).toHaveLength(5);
    });

    it('can construct a Scene', () => {
      const scene: Scene = {
        id: 'scene-1',
        startOffset: 0,
        endOffset: 500,
        type: 'dialogue',
        pov: 'Sarah',
        location: 'Cafe',
        timeMarker: 'morning',
        tension: 0.6,
        dialogueRatio: 0.7,
      };
      expect(scene.type).toBe('dialogue');
      expect(scene.tension).toBe(0.6);
    });
  });

  describe('Paragraph types', () => {
    it('ParagraphType accepts valid values', () => {
      const types: ParagraphType[] = ['dialogue', 'action', 'description', 'internal', 'exposition'];
      expect(types).toHaveLength(5);
    });

    it('can construct a ClassifiedParagraph', () => {
      const para: ClassifiedParagraph = {
        offset: 100,
        length: 200,
        type: 'action',
        speakerId: null,
        sentiment: 0.3,
        tension: 0.5,
        sentenceCount: 4,
        avgSentenceLength: 15,
      };
      expect(para.type).toBe('action');
    });
  });

  describe('DialogueLine', () => {
    it('can construct a DialogueLine', () => {
      const line: DialogueLine = {
        id: 'dl-1',
        quote: 'Hello there!',
        speaker: 'Marcus',
        offset: 50,
        length: 12,
        replyTo: null,
        sentiment: 0.2,
      };
      expect(line.speaker).toBe('Marcus');
    });
  });

  describe('StructuralFingerprint', () => {
    it('can construct StructuralStats', () => {
      const stats: StructuralStats = {
        totalWords: 5000,
        totalSentences: 250,
        totalParagraphs: 50,
        avgSentenceLength: 20,
        sentenceLengthVariance: 5,
        dialogueRatio: 0.4,
        sceneCount: 10,
        povShifts: 2,
        avgSceneLength: 500,
      };
      expect(stats.totalWords).toBe(5000);
    });

    it('can construct a StructuralFingerprint', () => {
      const fp: StructuralFingerprint = {
        scenes: [],
        paragraphs: [],
        dialogueMap: [],
        stats: {
          totalWords: 1000,
          totalSentences: 50,
          totalParagraphs: 10,
          avgSentenceLength: 20,
          sentenceLengthVariance: 3,
          dialogueRatio: 0.3,
          sceneCount: 2,
          povShifts: 0,
          avgSceneLength: 500,
        },
        processedAt: Date.now(),
      };
      expect(fp.scenes).toEqual([]);
    });
  });

  describe('Entity types', () => {
    it('EntityType accepts valid values', () => {
      const types: EntityType[] = ['character', 'location', 'object', 'faction', 'concept'];
      expect(types).toHaveLength(5);
    });

    it('RelationshipType accepts valid values', () => {
      const types: RelationshipType[] = ['interacts', 'located_at', 'possesses', 'related_to', 'opposes', 'allied_with'];
      expect(types).toHaveLength(6);
    });

    it('can construct EntityNode', () => {
      const node: EntityNode = {
        id: 'ent-1',
        name: 'Sarah',
        type: 'character',
        aliases: ['the detective'],
        firstMention: 10,
        mentionCount: 25,
        mentions: [{ offset: 10, chapterId: 'ch-1' }],
        attributes: { hair: ['blonde'], eyes: ['blue'] },
      };
      expect(node.aliases).toContain('the detective');
    });

    it('can construct EntityEdge', () => {
      const edge: EntityEdge = {
        id: 'edge-1',
        source: 'ent-1',
        target: 'ent-2',
        type: 'interacts',
        coOccurrences: 5,
        sentiment: 0.3,
        chapters: ['ch-1', 'ch-2'],
        evidence: ['They spoke quietly'],
      };
      expect(edge.type).toBe('interacts');
    });

    it('can construct EntityGraph', () => {
      const graph: EntityGraph = {
        nodes: [],
        edges: [],
        processedAt: Date.now(),
      };
      expect(graph.nodes).toEqual([]);
    });
  });

  describe('Timeline types', () => {
    it('TemporalRelation accepts valid values', () => {
      const relations: TemporalRelation[] = ['before', 'after', 'concurrent', 'unknown'];
      expect(relations).toHaveLength(4);
    });

    it('can construct TimelineEvent', () => {
      const event: TimelineEvent = {
        id: 'evt-1',
        description: 'The meeting began',
        offset: 100,
        chapterId: 'ch-1',
        temporalMarker: 'that morning',
        relativePosition: 'before',
        dependsOn: [],
      };
      expect(event.temporalMarker).toBe('that morning');
    });

    it('can construct CausalChain', () => {
      const chain: CausalChain = {
        id: 'chain-1',
        cause: { eventId: 'evt-1', quote: 'He lied', offset: 50 },
        effect: { eventId: 'evt-2', quote: 'She left', offset: 100 },
        confidence: 0.8,
        marker: 'because',
      };
      expect(chain.confidence).toBe(0.8);
    });

    it('can construct PlotPromise', () => {
      const promise: PlotPromise = {
        id: 'promise-1',
        type: 'foreshadowing',
        description: 'The locked door',
        quote: 'The door remained locked',
        offset: 200,
        chapterId: 'ch-1',
        resolved: false,
      };
      expect(promise.resolved).toBe(false);
    });

    it('can construct Timeline', () => {
      const timeline: Timeline = {
        events: [],
        causalChains: [],
        promises: [],
        processedAt: Date.now(),
      };
      expect(timeline.events).toEqual([]);
    });
  });

  describe('Style types', () => {
    it('can construct VocabularyMetrics', () => {
      const metrics: VocabularyMetrics = {
        uniqueWords: 500,
        totalWords: 2000,
        avgWordLength: 5,
        lexicalDiversity: 0.25,
        topWords: [{ word: 'the', count: 100 }],
        overusedWords: ['very'],
        rareWords: ['mellifluous'],
      };
      expect(metrics.lexicalDiversity).toBe(0.25);
    });

    it('can construct SyntaxMetrics', () => {
      const metrics: SyntaxMetrics = {
        avgSentenceLength: 18,
        sentenceLengthVariance: 5,
        minSentenceLength: 3,
        maxSentenceLength: 45,
        paragraphLengthAvg: 80,
        dialogueToNarrativeRatio: 0.4,
        questionRatio: 0.1,
        exclamationRatio: 0.05,
      };
      expect(metrics.avgSentenceLength).toBe(18);
    });

    it('can construct RhythmMetrics', () => {
      const metrics: RhythmMetrics = {
        syllablePattern: [3, 4, 3, 5],
        punctuationDensity: 8,
        avgClauseCount: 2.5,
      };
      expect(metrics.punctuationDensity).toBe(8);
    });

    it('can construct StyleFlags', () => {
      const flags: StyleFlags = {
        passiveVoiceRatio: 0.15,
        passiveVoiceInstances: [{ quote: 'was seen', offset: 100 }],
        adverbDensity: 0.03,
        adverbInstances: [{ word: 'quickly', offset: 50 }],
        filterWordDensity: 0.02,
        filterWordInstances: [{ word: 'seemed', offset: 75 }],
        clicheCount: 2,
        clicheInstances: [{ phrase: 'dark and stormy', offset: 10 }],
        repeatedPhrases: [{ phrase: 'he said', count: 5, offsets: [10, 20, 30, 40, 50] }],
      };
      expect(flags.clicheCount).toBe(2);
    });

    it('can construct StyleFingerprint', () => {
      const fp: StyleFingerprint = {
        vocabulary: {
          uniqueWords: 100,
          totalWords: 500,
          avgWordLength: 5,
          lexicalDiversity: 0.2,
          topWords: [],
          overusedWords: [],
          rareWords: [],
        },
        syntax: {
          avgSentenceLength: 15,
          sentenceLengthVariance: 4,
          minSentenceLength: 2,
          maxSentenceLength: 40,
          paragraphLengthAvg: 60,
          dialogueToNarrativeRatio: 0.5,
          questionRatio: 0.1,
          exclamationRatio: 0.02,
        },
        rhythm: {
          syllablePattern: [],
          punctuationDensity: 5,
          avgClauseCount: 2,
        },
        flags: {
          passiveVoiceRatio: 0.1,
          passiveVoiceInstances: [],
          adverbDensity: 0.02,
          adverbInstances: [],
          filterWordDensity: 0.01,
          filterWordInstances: [],
          clicheCount: 0,
          clicheInstances: [],
          repeatedPhrases: [],
        },
        processedAt: Date.now(),
      };
      expect(fp.vocabulary.uniqueWords).toBe(100);
    });
  });

  describe('Voice types', () => {
    it('can construct VoiceMetrics', () => {
      const metrics: VoiceMetrics = {
        avgSentenceLength: 12,
        sentenceVariance: 3,
        contractionRatio: 0.3,
        questionRatio: 0.15,
        exclamationRatio: 0.05,
        latinateRatio: 0.2,
        uniqueWordCount: 50,
      };
      expect(metrics.contractionRatio).toBe(0.3);
    });

    it('can construct VoiceProfile', () => {
      const profile: VoiceProfile = {
        speakerName: 'Sarah',
        metrics: {
          avgSentenceLength: 10,
          sentenceVariance: 2,
          contractionRatio: 0.4,
          questionRatio: 0.2,
          exclamationRatio: 0.1,
          latinateRatio: 0.15,
          uniqueWordCount: 30,
        },
        signatureWords: ['indeed', 'quite'],
        impression: 'Formal and measured',
        lineCount: 25,
      };
      expect(profile.signatureWords).toContain('indeed');
    });

    it('can construct VoiceFingerprint', () => {
      const fp: VoiceFingerprint = {
        profiles: {},
        consistencyAlerts: ['Sarah uses contractions inconsistently'],
      };
      expect(fp.consistencyAlerts).toHaveLength(1);
    });
  });

  describe('Heatmap types', () => {
    it('RiskFlag accepts valid values', () => {
      const flags: RiskFlag[] = [
        'unresolved_promise',
        'contradiction_detected',
        'passive_voice_heavy',
        'pacing_slow',
        'pacing_rushed',
        'dialogue_heavy',
        'exposition_dump',
        'filter_words',
        'adverb_overuse',
        'long_sentences',
        'short_sentences',
        'low_tension',
        'character_absent',
        'setting_unclear',
      ];
      expect(flags).toHaveLength(14);
    });

    it('can construct HeatmapSection', () => {
      const section: HeatmapSection = {
        offset: 0,
        length: 500,
        scores: {
          plotRisk: 0.3,
          pacingRisk: 0.2,
          characterRisk: 0.1,
          settingRisk: 0.05,
          styleRisk: 0.15,
        },
        overallRisk: 0.16,
        flags: ['pacing_slow'],
        suggestions: ['Consider adding more action'],
      };
      expect(section.flags).toContain('pacing_slow');
    });

    it('can construct AttentionHeatmap', () => {
      const heatmap: AttentionHeatmap = {
        sections: [],
        hotspots: [{ offset: 100, reason: 'Plot hole', severity: 0.8 }],
        processedAt: Date.now(),
      };
      expect(heatmap.hotspots).toHaveLength(1);
    });
  });

  describe('Delta types', () => {
    it('ChangeType accepts valid values', () => {
      const types: ChangeType[] = ['insert', 'delete', 'modify'];
      expect(types).toHaveLength(3);
    });

    it('can construct TextChange', () => {
      const change: TextChange = {
        start: 100,
        end: 150,
        changeType: 'modify',
        oldText: 'old content',
        newText: 'new content',
        timestamp: Date.now(),
      };
      expect(change.changeType).toBe('modify');
    });

    it('can construct ManuscriptDelta', () => {
      const delta: ManuscriptDelta = {
        changedRanges: [],
        invalidatedSections: ['sec-1'],
        affectedEntities: ['ent-1'],
        newPromises: ['promise-1'],
        resolvedPromises: [],
        contentHash: 'abc123',
        processedAt: Date.now(),
      };
      expect(delta.contentHash).toBe('abc123');
    });
  });

  describe('HUD types', () => {
    it('can construct SituationalAwareness', () => {
      const awareness: SituationalAwareness = {
        currentScene: null,
        currentParagraph: null,
        narrativePosition: {
          sceneIndex: 3,
          totalScenes: 10,
          percentComplete: 30,
        },
        tensionLevel: 'medium',
        pacing: 'moderate',
      };
      expect(awareness.tensionLevel).toBe('medium');
    });

    it('can construct RelevantContext', () => {
      const context: RelevantContext = {
        activeEntities: [],
        activeRelationships: [],
        openPromises: [],
        recentEvents: [],
      };
      expect(context.activeEntities).toEqual([]);
    });

    it('can construct ManuscriptHUD', () => {
      const hud: ManuscriptHUD = {
        situational: {
          currentScene: null,
          currentParagraph: null,
          narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
          tensionLevel: 'low',
          pacing: 'slow',
        },
        context: {
          activeEntities: [],
          activeRelationships: [],
          openPromises: [],
          recentEvents: [],
        },
        styleAlerts: [],
        prioritizedIssues: [],
        recentChanges: [],
        stats: {
          wordCount: 1000,
          readingTime: 5,
          dialoguePercent: 30,
          avgSentenceLength: 15,
        },
        lastFullProcess: Date.now(),
        processingTier: 'debounced',
      };
      expect(hud.stats.wordCount).toBe(1000);
    });
  });

  describe('Chunk types', () => {
    it('ChunkStatus accepts valid values', () => {
      const statuses: ChunkStatus[] = ['fresh', 'dirty', 'processing', 'error'];
      expect(statuses).toHaveLength(4);
    });

    it('ChunkLevel accepts valid values', () => {
      const levels: ChunkLevel[] = ['scene', 'chapter', 'act', 'book'];
      expect(levels).toHaveLength(4);
    });

    it('can construct ChunkRecord', () => {
      const record: ChunkRecord = {
        id: 'chapter-1' as ChunkId,
        level: 'chapter',
        startIndex: 0,
        endIndex: 5000,
        hash: 'hash123',
        status: 'fresh',
        lastProcessedAt: Date.now(),
        analysis: null,
        parentId: null,
        childIds: ['chapter-1-scene-0', 'chapter-1-scene-1'],
      };
      expect(record.level).toBe('chapter');
    });

    it('can construct ChunkAnalysis', () => {
      const analysis: ChunkAnalysis = {
        summary: 'Chapter introduces Sarah',
        wordCount: 2000,
        dialogueRatio: 0.4,
        avgTension: 0.5,
        characterNames: ['Sarah', 'Marcus'],
        locationNames: ['Paris'],
        timeMarkers: ['morning'],
        openPromises: ['The locked door'],
        styleFlags: ['dialogue_heavy'],
        riskScore: 0.3,
        processedAt: Date.now(),
      };
      expect(analysis.characterNames).toContain('Sarah');
    });

    it('can construct AggregateSummary', () => {
      const summary: AggregateSummary = {
        chunkId: 'act-1',
        level: 'act',
        totalWordCount: 20000,
        avgDialogueRatio: 0.35,
        avgTension: 0.45,
        allCharacters: ['Sarah', 'Marcus', 'Elena'],
        allLocations: ['Paris', 'London'],
        unresolvedPromises: ['The secret'],
        hotspots: [{ chunkId: 'chapter-3', riskScore: 0.7, reason: 'Pacing issues' }],
        narrativeSummary: 'Act 1 establishes the main conflict',
        generatedAt: Date.now(),
      };
      expect(summary.level).toBe('act');
    });

    it('can construct ChunkEdit', () => {
      const edit: ChunkEdit = {
        start: 100,
        end: 150,
        newLength: 75,
        chapterId: 'ch-1',
        timestamp: Date.now(),
      };
      expect(edit.newLength).toBe(75);
    });

    it('can construct ChunkJob', () => {
      const job: ChunkJob = {
        chunkId: 'chapter-1',
        priority: 'high',
        addedAt: Date.now(),
        text: 'Chapter content',
      };
      expect(job.priority).toBe('high');
    });

    it('can construct ChunkIndexState', () => {
      const state: ChunkIndexState = {
        chunks: {},
        aggregates: {},
        dirtyQueue: ['chapter-1'],
        lastFullRebuild: null,
        totalChunks: 5,
        dirtyCount: 1,
      };
      expect(state.dirtyCount).toBe(1);
    });
  });

  describe('Processing config', () => {
    it('ProcessingTier accepts valid values', () => {
      const tiers: ProcessingTier[] = ['instant', 'debounced', 'background', 'on-demand'];
      expect(tiers).toHaveLength(4);
    });

    it('DEFAULT_PROCESSING_CONFIG has expected values', () => {
      expect(DEFAULT_PROCESSING_CONFIG.instantDebounceMs).toBe(0);
      expect(DEFAULT_PROCESSING_CONFIG.debouncedDelayMs).toBe(100);
      expect(DEFAULT_PROCESSING_CONFIG.backgroundDelayMs).toBe(2000);
      expect(DEFAULT_PROCESSING_CONFIG.maxBackgroundTimeMs).toBe(5000);
      expect(DEFAULT_PROCESSING_CONFIG.enableWebWorker).toBe(true);
    });
  });

  describe('ManuscriptIntelligence', () => {
    it('can construct a minimal ManuscriptIntelligence', () => {
      const intelligence: ManuscriptIntelligence = {
        chapterId: 'ch-1',
        structural: {
          scenes: [],
          paragraphs: [],
          dialogueMap: [],
          stats: {
            totalWords: 0,
            totalSentences: 0,
            totalParagraphs: 0,
            avgSentenceLength: 0,
            sentenceLengthVariance: 0,
            dialogueRatio: 0,
            sceneCount: 0,
            povShifts: 0,
            avgSceneLength: 0,
          },
          processedAt: Date.now(),
        },
        entities: { nodes: [], edges: [], processedAt: Date.now() },
        timeline: { events: [], causalChains: [], promises: [], processedAt: Date.now() },
        style: {
          vocabulary: {
            uniqueWords: 0,
            totalWords: 0,
            avgWordLength: 0,
            lexicalDiversity: 0,
            topWords: [],
            overusedWords: [],
            rareWords: [],
          },
          syntax: {
            avgSentenceLength: 0,
            sentenceLengthVariance: 0,
            minSentenceLength: 0,
            maxSentenceLength: 0,
            paragraphLengthAvg: 0,
            dialogueToNarrativeRatio: 0,
            questionRatio: 0,
            exclamationRatio: 0,
          },
          rhythm: { syllablePattern: [], punctuationDensity: 0, avgClauseCount: 0 },
          flags: {
            passiveVoiceRatio: 0,
            passiveVoiceInstances: [],
            adverbDensity: 0,
            adverbInstances: [],
            filterWordDensity: 0,
            filterWordInstances: [],
            clicheCount: 0,
            clicheInstances: [],
            repeatedPhrases: [],
          },
          processedAt: Date.now(),
        },
        voice: { profiles: {}, consistencyAlerts: [] },
        heatmap: { sections: [], hotspots: [], processedAt: Date.now() },
        delta: {
          changedRanges: [],
          invalidatedSections: [],
          affectedEntities: [],
          newPromises: [],
          resolvedPromises: [],
          contentHash: '',
          processedAt: Date.now(),
        },
        hud: {
          situational: {
            currentScene: null,
            currentParagraph: null,
            narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
            tensionLevel: 'low',
            pacing: 'slow',
          },
          context: {
            activeEntities: [],
            activeRelationships: [],
            openPromises: [],
            recentEvents: [],
          },
          styleAlerts: [],
          prioritizedIssues: [],
          recentChanges: [],
          stats: { wordCount: 0, readingTime: 0, dialoguePercent: 0, avgSentenceLength: 0 },
          lastFullProcess: Date.now(),
          processingTier: 'instant',
        },
      };
      expect(intelligence.chapterId).toBe('ch-1');
    });
  });
});
