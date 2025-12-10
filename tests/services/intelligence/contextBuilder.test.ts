import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ManuscriptHUD,
  ManuscriptIntelligence,
  Scene,
  ClassifiedParagraph,
  EntityNode,
  TimelineEvent,
  PlotPromise,
  RiskFlag,
} from '../../../types/intelligence';

const makeBaseIntelligence = (): ManuscriptIntelligence => ({
  chapterId: 'ch-1',
  structural: {
    scenes: [],
    paragraphs: [],
    dialogueMap: [],
    stats: {
      totalWords: 1000,
      totalSentences: 100,
      totalParagraphs: 10,
      avgSentenceLength: 10,
      sentenceLengthVariance: 0,
      dialogueRatio: 0.4,
      sceneCount: 1,
      povShifts: 0,
      avgSceneLength: 400,
    },
    processedAt: 42,
  } as any,
  entities: {
    nodes: [],
    edges: [],
    processedAt: 0,
  } as any,
  timeline: {
    events: [],
    promises: [],
    causalChains: [],
    processedAt: 0,
  } as any,
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
      avgSentenceLength: 12,
      sentenceLengthVariance: 0,
      minSentenceLength: 0,
      maxSentenceLength: 0,
      paragraphLengthAvg: 0,
      dialogueToNarrativeRatio: 0,
      questionRatio: 0,
      exclamationRatio: 0,
    },
    rhythm: {
      syllablePattern: [],
      punctuationDensity: 0,
      avgClauseCount: 0,
    },
    flags: {
      passiveVoiceInstances: [],
      adverbInstances: [],
      filterWordInstances: [],
      clicheInstances: [],
      repeatedPhrases: [],
      passiveVoiceRatio: 0,
      adverbDensity: 0,
      clicheCount: 0,
    },
    processedAt: 0,
  } as any,
  voice: {
    profiles: {},
    consistencyAlerts: [],
  } as any,
  heatmap: {
    sections: [],
    hotspots: [],
    processedAt: 0,
  } as any,
  delta: {
    changedRanges: [],
    invalidatedSections: [],
    affectedEntities: [],
    newPromises: [],
    resolvedPromises: [],
    contentHash: '',
    processedAt: 0,
  } as any,
  hud: null as any,
});

const makeScene = (): Scene => ({
  id: 's-1',
  startOffset: 0,
  endOffset: 200,
  type: 'action',
  pov: 'Alice',
  location: 'Bridge',
  timeMarker: null,
  tension: 0.8,
  dialogueRatio: 0.3,
});

const makeParagraph = (): ClassifiedParagraph => ({
  offset: 0,
  length: 100,
  type: 'dialogue',
  speakerId: 'alice',
  sentiment: 0,
  tension: 0.8,
  sentenceCount: 3,
  avgSentenceLength: 30,
});

const makeEntities = (): EntityNode[] => [
  {
    id: 'c1',
    name: 'Alice',
    type: 'character',
    aliases: [],
    firstMention: 0 as any,
    mentionCount: 5,
    mentions: [],
    attributes: {},
  } as EntityNode,
  {
    id: 'loc1',
    name: 'Castle',
    type: 'location',
    aliases: [],
    firstMention: 10 as any,
    mentionCount: 2,
    mentions: [],
    attributes: {},
  } as EntityNode,
];

const makeEvent = (): TimelineEvent => ({
  id: 'e1',
  description: 'Important event',
  offset: 50,
  chapterId: 'ch-1',
  temporalMarker: null,
  relativePosition: 'unknown',
  dependsOn: [],
});

const makePromise = (): PlotPromise => ({
  id: 'p1',
  type: 'foreshadowing',
  description: 'Chekhov gun on the mantle',
  quote: 'The gun glinted on the mantle.',
  offset: 20,
  chapterId: 'ch-1',
  resolved: false,
});

const loadContextBuilderWithRichMocks = async () => {
  vi.doMock('../../../services/intelligence/structuralParser', () => ({
    getSceneAtOffset: vi.fn(() => makeScene()),
    getParagraphAtOffset: vi.fn(() => makeParagraph()),
  }));

  vi.doMock('../../../services/intelligence/entityExtractor', () => ({
    getEntitiesInRange: vi.fn(() => makeEntities()),
    getRelatedEntities: vi.fn(() => [
      {
        entity: makeEntities()[1],
        relationship: {
          id: 'rel1',
          source: 'c1',
          target: 'loc1',
          type: 'located_at',
          coOccurrences: 3,
          sentiment: 0,
          chapters: [],
          evidence: [],
        },
      },
    ]),
  }));

  vi.doMock('../../../services/intelligence/timelineTracker', () => ({
    getUnresolvedPromises: vi.fn(() => [makePromise()]),
    getEventsInRange: vi.fn(() => [makeEvent()]),
  }));

  vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
    getSectionAtOffset: vi.fn(() => ({
      offset: 0,
      length: 100,
      scores: {
        plotRisk: 0.5,
        pacingRisk: 0.4,
        characterRisk: 0.3,
        settingRisk: 0.2,
        styleRisk: 0.9,
      },
      overallRisk: 0.8,
      flags: [
        'passive_voice_heavy',
        'adverb_overuse',
        'filter_words',
        'long_sentences',
        'exposition_dump',
      ],
      suggestions: [
        'Reduce passive voice for stronger prose',
        'Consider stronger verbs instead of adverbs',
      ],
    })),
  }));

  const module = await import('../../../services/intelligence/contextBuilder');
  return module;
};

const loadContextBuilderForGlobalStyleAlerts = async () => {
  vi.doMock('../../../services/intelligence/structuralParser', () => ({
    getSceneAtOffset: vi.fn(() => null),
    getParagraphAtOffset: vi.fn(() => ({
      avgSentenceLength: 30,
    })),
  }));

  vi.doMock('../../../services/intelligence/entityExtractor', () => ({
    getEntitiesInRange: vi.fn(() => []),
    getRelatedEntities: vi.fn(() => []),
  }));

  vi.doMock('../../../services/intelligence/timelineTracker', () => ({
    getUnresolvedPromises: vi.fn(() => []),
    getEventsInRange: vi.fn(() => []),
  }));

  vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
    getSectionAtOffset: vi.fn(() => null),
  }));

  return import('../../../services/intelligence/contextBuilder');
};

const loadContextBuilderForIssues = async () => {
  const section = {
    offset: 100,
    length: 120,
    scores: {
      plotRisk: 0.6,
      pacingRisk: 0.7,
      characterRisk: 0.3,
      settingRisk: 0.2,
      styleRisk: 0.4,
    },
    overallRisk: 0.8,
    flags: ['pacing_slow'],
    suggestions: ['Tighten the pacing'],
  };

  vi.doMock('../../../services/intelligence/structuralParser', () => ({
    getSceneAtOffset: vi.fn(() => ({
      ...makeScene(),
      tension: 0.2,
    })),
    getParagraphAtOffset: vi.fn(() => ({
      ...makeParagraph(),
      avgSentenceLength: 32,
    })),
  }));

  vi.doMock('../../../services/intelligence/entityExtractor', () => ({
    getEntitiesInRange: vi.fn(() => makeEntities()),
    getRelatedEntities: vi.fn(() => []),
  }));

  vi.doMock('../../../services/intelligence/timelineTracker', () => ({
    getUnresolvedPromises: vi.fn(() => [makePromise()]),
    getEventsInRange: vi.fn(() => [makeEvent()]),
  }));

  vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
    getSectionAtOffset: vi.fn(() => section),
  }));

  return import('../../../services/intelligence/contextBuilder');
};

const loadContextBuilderWithEmptyMocks = async () => {
  vi.doMock('../../../services/intelligence/structuralParser', () => ({
    getSceneAtOffset: vi.fn(() => null),
    getParagraphAtOffset: vi.fn(() => null),
  }));

  vi.doMock('../../../services/intelligence/entityExtractor', () => ({
    getEntitiesInRange: vi.fn(() => []),
    getRelatedEntities: vi.fn(() => []),
  }));

  vi.doMock('../../../services/intelligence/timelineTracker', () => ({
    getUnresolvedPromises: vi.fn(() => []),
    getEventsInRange: vi.fn(() => []),
  }));

  vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
    getSectionAtOffset: vi.fn(() => null),
  }));

  const module = await import('../../../services/intelligence/contextBuilder');
  return module;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('contextBuilder - buildHUD', () => {
  it('builds a rich HUD with situational awareness, context, alerts, and issues', async () => {
    const { buildHUD } = await loadContextBuilderWithRichMocks();
    const intelligence = makeBaseIntelligence();
    intelligence.delta.changedRanges = [
      { start: 0, end: 10, changeType: 'insert', timestamp: 1 } as any,
      { start: 10, end: 20, changeType: 'modify', timestamp: 2 } as any,
    ];

    const hud = buildHUD(intelligence, 50);

    expect(hud.situational.currentScene?.id).toBe('s-1');
    expect(hud.situational.tensionLevel).toBe('high');
    expect(hud.situational.pacing).toBe('slow');

    expect(hud.context.activeEntities.length).toBeGreaterThan(0);
    expect(hud.context.openPromises.length).toBe(1);
    expect(hud.context.recentEvents.length).toBe(1);

    expect(hud.styleAlerts.length).toBeGreaterThan(0);
    expect(hud.prioritizedIssues.length).toBeGreaterThan(0);

    expect(hud.recentChanges.length).toBeLessThanOrEqual(5);
    expect(hud.stats.wordCount).toBe(1000);
    expect(hud.lastFullProcess).toBe(intelligence.structural.processedAt);
    expect(hud.processingTier).toBe('background');
  });

  it('handles empty intelligence data without throwing and returns safe defaults', async () => {
    const { buildHUD } = await loadContextBuilderWithEmptyMocks();
    const intelligence = makeBaseIntelligence();

    const hud = buildHUD(intelligence, 0);

    expect(hud.situational.currentScene).toBeNull();
    expect(hud.context.activeEntities).toEqual([]);
    expect(hud.context.openPromises).toEqual([]);
    expect(hud.context.recentEvents).toEqual([]);
    expect(hud.styleAlerts).toEqual([]);
    expect(hud.prioritizedIssues).toEqual([]);
  });

  it('surfaces global style alerts even when no section data is available', async () => {
    const { buildHUD } = await loadContextBuilderForGlobalStyleAlerts();
    const intelligence = makeBaseIntelligence();

    intelligence.style.flags.passiveVoiceRatio = 4.12;
    intelligence.style.flags.adverbDensity = 5.01;
    intelligence.style.flags.clicheCount = 2;
    intelligence.style.vocabulary.overusedWords = ['really', 'just', 'actually'];

    const hud = buildHUD(intelligence, 25);

    expect(hud.styleAlerts).toEqual(
      expect.arrayContaining([
        'Overall passive voice: 4.1 per 100 words',
        'Adverb density: 5.0 per 100 words',
        '2 cliché(s) detected',
        'Overused words: really, just, actually',
      ])
    );
  });

  it('deduplicates prioritized issues across heatmap, promises, and clichés', async () => {
    const { buildHUD } = await loadContextBuilderForIssues();
    const intelligence = makeBaseIntelligence();
    const duplicatedSection = {
      offset: 100,
      length: 120,
      flags: ['pacing_slow'],
      suggestions: ['Tighten the pacing'],
      scores: intelligence.heatmap.sections[0]?.scores ?? {
        plotRisk: 0.6,
        pacingRisk: 0.7,
        characterRisk: 0.3,
        settingRisk: 0.2,
        styleRisk: 0.4,
      },
      overallRisk: 0.75,
    };

    intelligence.heatmap.sections = [
      duplicatedSection as any,
      { ...duplicatedSection, overallRisk: 0.6 } as any,
    ];
    intelligence.timeline.promises = [
      makePromise(),
      { ...makePromise(), id: 'resolved', resolved: true },
    ] as any;
    intelligence.style.flags.clicheInstances = [
      { phrase: 'it was all a dream', offset: 140 },
    ] as any;

    const hud = buildHUD(intelligence, 105);

    const pacingIssues = hud.prioritizedIssues.filter(
      issue => issue.type === 'pacing_slow'
    );
    expect(pacingIssues).toHaveLength(1);
    expect(
      hud.prioritizedIssues.some(issue => issue.type === 'unresolved_promise')
    ).toBe(true);
    expect(
      hud.prioritizedIssues.some(issue => issue.description.includes('Cliché'))
    ).toBe(true);
    expect(hud.situational.tensionLevel).toBe('low');
    expect(hud.situational.pacing).toBe('slow');
  });
});

const makeSampleHud = (): ManuscriptHUD => ({
  situational: {
    currentScene: makeScene(),
    currentParagraph: makeParagraph(),
    narrativePosition: {
      sceneIndex: 1,
      totalScenes: 3,
      percentComplete: 33,
    },
    tensionLevel: 'high',
    pacing: 'moderate',
  },
  context: {
    activeEntities: makeEntities(),
    activeRelationships: [
      {
        id: 'rel1',
        source: 'c1',
        target: 'loc1',
        type: 'located_at',
        coOccurrences: 3,
        sentiment: 0,
        chapters: [],
        evidence: [],
      } as any,
    ],
    openPromises: [makePromise()],
    recentEvents: [makeEvent()],
  },
  styleAlerts: ['Passive voice detected (0.9 risk)'],
  prioritizedIssues: [
    {
      type: 'pacing_slow' as RiskFlag,
      description: 'Consider adding tension or conflict',
      offset: 0,
      severity: 0.8,
    },
  ],
  recentChanges: [],
  stats: {
    wordCount: 1000,
    readingTime: 5,
    dialoguePercent: 40,
    avgSentenceLength: 12,
  },
  lastFullProcess: 42,
  processingTier: 'background',
});

const makeMinimalHud = (): ManuscriptHUD => ({
  situational: {
    currentScene: null,
    currentParagraph: null,
    narrativePosition: {
      sceneIndex: 0,
      totalScenes: 0,
      percentComplete: 0,
    },
    tensionLevel: 'medium',
    pacing: 'moderate',
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
    wordCount: 0,
    readingTime: 0,
    dialoguePercent: 0,
    avgSentenceLength: 0,
  },
  lastFullProcess: 0,
  processingTier: 'background',
});

describe('contextBuilder - buildAIContextString', () => {
  it('serializes a rich HUD into a human-readable context string', async () => {
    const { buildAIContextString } = await import('../../../services/intelligence/contextBuilder');
    const hud = makeSampleHud();

    const result = buildAIContextString(hud);

    expect(result).toContain('[SITUATIONAL AWARENESS]');
    expect(result).toContain('Current Scene: action scene');
    expect(result).toContain('Tension Level: HIGH');
    expect(result).toContain('[ACTIVE ENTITIES IN SCENE]');
    expect(result).toContain('[OPEN PLOT THREADS]');
    expect(result).toContain('[STYLE ALERTS]');
    expect(result).toContain('[PRIORITY ISSUES]');
    expect(result).toContain('[MANUSCRIPT STATS]');
  });

  it('handles minimal HUD without optional sections', async () => {
    const { buildAIContextString } = await import('../../../services/intelligence/contextBuilder');
    const hud = makeMinimalHud();

    const result = buildAIContextString(hud);

    expect(result).toContain('[SITUATIONAL AWARENESS]');
    expect(result).not.toContain('[ACTIVE ENTITIES IN SCENE]');
    expect(result).not.toContain('[OPEN PLOT THREADS]');
    expect(result).toContain('[MANUSCRIPT STATS]');
  });
});

describe('contextBuilder - buildCompressedContext', () => {
  it('emits a compact summary including scene, entities, issues, and stats', async () => {
    const { buildCompressedContext } = await import('../../../services/intelligence/contextBuilder');
    const hud = makeSampleHud();

    const ctx = buildCompressedContext(hud);

    expect(ctx).toContain('Scene:action');
    expect(ctx).toContain('chars:Alice,Castle');
    expect(ctx).toContain('open_threads:1');
    expect(ctx).toContain('issue:pacing_slow');
    expect(ctx).toContain('words:1000');
    expect(ctx).toContain('dialogue:40%');
  });

  it('omits optional segments when data is missing but keeps stats', async () => {
    const { buildCompressedContext } = await import('../../../services/intelligence/contextBuilder');
    const hud = makeMinimalHud();

    const ctx = buildCompressedContext(hud);

    expect(ctx).not.toContain('Scene:');
    expect(ctx).not.toContain('chars:');
    expect(ctx).not.toContain('open_threads:');
    expect(ctx).not.toContain('issue:');
    expect(ctx).toContain('words:0');
    expect(ctx).toContain('dialogue:0%');
  });
});
