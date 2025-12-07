import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NavigateToTextCommand,
  JumpToChapterCommand,
  JumpToSceneCommand,
} from '@/services/commands/navigation';
import type { NavigationDependencies } from '@/services/commands/types';
import type { Chapter } from '@/types/schema';
import type {
  ManuscriptIntelligence,
  Scene,
  StructuralFingerprint,
} from '@/types/intelligence';

const baseChapters: Chapter[] = [
  {
    id: 'c1',
    projectId: 'p1',
    title: 'Prologue',
    content: 'Once upon a time in a far land',
    order: 0,
    updatedAt: 0,
  },
  {
    id: 'c2',
    projectId: 'p1',
    title: 'Conversation',
    content: `"Hello there," said Alice. Bob replied "Goodbye" loudly.`,
    order: 1,
    updatedAt: 0,
  },
];

const structuralFingerprint: StructuralFingerprint = {
  scenes: [
    {
      id: 's1',
      startOffset: 5,
      endOffset: 15,
      type: 'dialogue',
      pov: null,
      location: null,
      timeMarker: null,
      tension: 0.2,
      dialogueRatio: 0.5,
    },
    {
      id: 's2',
      startOffset: 30,
      endOffset: 40,
      type: 'action',
      pov: null,
      location: null,
      timeMarker: null,
      tension: 0.6,
      dialogueRatio: 0.3,
    },
  ],
  paragraphs: [],
  dialogueMap: [],
  stats: {
    totalWords: 0,
    totalSentences: 0,
    totalParagraphs: 0,
    avgSentenceLength: 0,
    sentenceLengthVariance: 0,
    dialogueRatio: 0,
    sceneCount: 2,
    povShifts: 0,
    avgSceneLength: 0,
  },
  processedAt: Date.now(),
};

const makeIntelligence = (
  structural: StructuralFingerprint = structuralFingerprint,
): ManuscriptIntelligence => ({
  chapterId: baseChapters[0].id,
  structural,
  entities: { nodes: [], edges: [], processedAt: 0 },
  timeline: { events: [], causalChains: [], promises: [], processedAt: 0 },
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
    rhythm: {
      syllablePattern: [],
      punctuationDensity: 0,
      avgClauseCount: 0,
    },
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
    processedAt: 0,
  },
  voice: { profiles: {}, consistencyAlerts: [] },
  heatmap: { sections: [], hotspots: [], processedAt: 0 },
  delta: {
    changedRanges: [],
    invalidatedSections: [],
    affectedEntities: [],
    newPromises: [],
    resolvedPromises: [],
    contentHash: '',
    processedAt: 0,
  },
  hud: {
    situational: {
      currentScene: null,
      currentParagraph: null,
      narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
      tensionLevel: 'low',
      pacing: 'slow',
    },
    context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
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
    processingTier: 'instant',
  },
});

const makeDeps = (overrides: Partial<NavigationDependencies> = {}): NavigationDependencies => ({
  currentText: baseChapters[0].content,
  activeChapterId: 'c1',
  chapters: baseChapters,
  selectChapter: vi.fn<(chapterId: string) => void>(),
  cursorPosition: 0,
  scrollToPosition: vi.fn(),
  navigateToRange: vi.fn(),
  intelligence: makeIntelligence(),
  ...overrides,
});

describe('NavigateToTextCommand', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('uses fuzzy search by default and navigates to range', async () => {
    const cmd = new NavigateToTextCommand();
    const res = await cmd.execute({ query: 'upon' }, deps);
    expect(res).toContain('Found at position');
    expect(deps.navigateToRange).toHaveBeenCalledWith(5, 9);
    expect(deps.selectChapter).not.toHaveBeenCalled();
  });

  it('switches chapter when chapter hint matches and searches within it', async () => {
    const cmd = new NavigateToTextCommand();
    const res = await cmd.execute({ query: 'Hello', chapter: 'Conversation' }, deps);
    expect(res).toContain('Found at position');
    expect(deps.selectChapter).toHaveBeenCalledWith('c2');
    expect(deps.navigateToRange).toHaveBeenCalled();
  });

  it('supports dialogue and character mention search types', async () => {
    const cmd = new NavigateToTextCommand();
    const dialogueDeps = makeDeps({
      currentText: baseChapters[1].content,
      activeChapterId: 'c2',
    });
    const dialogueRes = await cmd.execute(
      { query: 'Hello', searchType: 'dialogue', character: 'Alice' },
      dialogueDeps,
    );
    expect(dialogueRes).toContain('Found at position');

    const mentionRes = await cmd.execute(
      { query: 'Bob', searchType: 'character_mention', character: 'Bob' },
      { ...deps, currentText: deps.chapters[1].content },
    );
    expect(mentionRes).toContain('Found at position');
  });

  it('returns not-found message when no match exists', async () => {
    const cmd = new NavigateToTextCommand();
    const res = await cmd.execute({ query: 'Missing' }, deps);
    expect(res).toContain('Could not find "Missing"');
    expect(deps.navigateToRange).not.toHaveBeenCalled();
  });
});

describe('JumpToChapterCommand', () => {
  it('selects chapter by title fragment and by numeric order', async () => {
    const depsTitle = makeDeps({ selectChapter: vi.fn() });
    const cmd = new JumpToChapterCommand();

    const byTitle = await cmd.execute('logue', depsTitle);
    expect(byTitle).toContain('Switched');
    expect(depsTitle.selectChapter).toHaveBeenCalledWith('c1');

    const depsNumber = makeDeps({ selectChapter: vi.fn() });
    const byNumber = await cmd.execute('2', depsNumber);
    expect(byNumber).toContain('Switched');
    expect(depsNumber.selectChapter).toHaveBeenCalledWith('c2');
  });

  it('reports available chapters when not found', async () => {
    const deps = makeDeps({ selectChapter: vi.fn() });
    const cmd = new JumpToChapterCommand();
    const res = await cmd.execute('Nonexistent', deps);
    expect(res).toContain('Could not find chapter');
    expect(res).toContain('Prologue');
    expect(deps.selectChapter).not.toHaveBeenCalled();
  });
});

describe('JumpToSceneCommand', () => {
  it('requires scene data', async () => {
    const cmd = new JumpToSceneCommand();
    const res = await cmd.execute(
      { sceneType: 'dialogue', direction: 'next' },
      makeDeps({ intelligence: null }),
    );
    expect(res).toContain('No scene data available');
  });

  it('jumps to next scene of a given type and scrolls', async () => {
    const deps = makeDeps({ cursorPosition: 0, scrollToPosition: vi.fn() });
    const cmd = new JumpToSceneCommand();
    const res = await cmd.execute({ sceneType: 'action', direction: 'next' }, deps);
    expect(res).toContain('Jumped to action scene');
    expect(deps.scrollToPosition).toHaveBeenCalledWith(30);
  });

  it('jumps to previous matching scene when direction is previous', async () => {
    const deps = makeDeps({
      cursorPosition: 35,
      scrollToPosition: vi.fn(),
      intelligence: makeIntelligence({
        scenes: [
          {
            id: 's1',
            startOffset: 5,
            endOffset: 15,
            type: 'dialogue',
            pov: null,
            location: null,
            timeMarker: null,
            tension: 0.2,
            dialogueRatio: 0.5,
          },
          {
            id: 's2',
            startOffset: 18,
            endOffset: 28,
            type: 'action',
            pov: null,
            location: null,
            timeMarker: null,
            tension: 0.4,
            dialogueRatio: 0.2,
          },
        ],
        paragraphs: [],
        dialogueMap: [],
        stats: {
          totalWords: 0,
          totalSentences: 0,
          totalParagraphs: 0,
          avgSentenceLength: 0,
          sentenceLengthVariance: 0,
          dialogueRatio: 0,
          sceneCount: 2,
          povShifts: 0,
          avgSceneLength: 0,
        },
        processedAt: Date.now(),
      }),
    });
    const cmd = new JumpToSceneCommand();
    const res = await cmd.execute({ sceneType: 'any', direction: 'previous' }, deps);
    expect(res).toContain('Jumped to');
    expect(deps.scrollToPosition).toHaveBeenCalledWith(18);
  });

  it('reports when no scene found in requested direction', async () => {
    const deps = makeDeps({ cursorPosition: 50 });
    const cmd = new JumpToSceneCommand();
    const res = await cmd.execute({ sceneType: 'dialogue', direction: 'next' }, deps);
    expect(res).toContain('No next dialogue scene found.');
  });
});
