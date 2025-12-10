import { renderHook, act } from '@testing-library/react';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';

import useManuscriptIntelligence, {
  useCurrentScene,
  useStyleAlerts,
  useOpenPromises,
  useHighRiskSections,
} from '@/features/shared/hooks/useManuscriptIntelligence';
import type {
  ManuscriptIntelligence,
  ManuscriptHUD,
  InstantMetrics,
  DebouncedMetrics,
} from '@/services/intelligence';

type ProcessInstantFn = (
  text: string,
  cursorOffset: number,
  structural?: unknown
) => InstantMetrics;
type ProcessDebouncedFn = (text: string, cursorOffset: number) => DebouncedMetrics;
type ProcessManuscriptFn = (
  text: string,
  chapterId: string,
  previousText?: string,
  previousIntelligence?: ManuscriptIntelligence
) => ManuscriptIntelligence;
type UpdateHUDFn = (intelligence: ManuscriptIntelligence, cursorOffset: number) => ManuscriptHUD;
type GenerateAIContextFn = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number,
  compressed?: boolean
) => string;

const {
  processInstantMock,
  processDebouncedMock,
  processManuscriptMock,
  updateHUDForCursorMock,
  generateAIContextMock,
} = vi.hoisted(() => ({
  processInstantMock: vi.fn<InstantMetrics, Parameters<ProcessInstantFn>>(),
  processDebouncedMock: vi.fn<DebouncedMetrics, Parameters<ProcessDebouncedFn>>(),
  processManuscriptMock: vi.fn<ManuscriptIntelligence, Parameters<ProcessManuscriptFn>>(),
  updateHUDForCursorMock: vi.fn<ManuscriptHUD, Parameters<UpdateHUDFn>>(),
  generateAIContextMock: vi.fn<string, Parameters<GenerateAIContextFn>>(),
}));

vi.mock('@/services/intelligence', async () => {
  const actual = await vi.importActual('@/services/intelligence');
  return {
    ...actual,
    processInstant: processInstantMock,
    processDebounced: processDebouncedMock,
    processManuscript: processManuscriptMock,
    updateHUDForCursor: updateHUDForCursorMock,
    generateAIContext: generateAIContextMock,
  };
});

let actualIntelligenceModule: typeof import('@/services/intelligence');

beforeAll(async () => {
  actualIntelligenceModule = await vi.importActual('@/services/intelligence');
});

const getActualServices = () => {
  if (!actualIntelligenceModule) {
    throw new Error('Intelligence services not initialized');
  }
  return actualIntelligenceModule;
};

const createRichIntelligence = (chapterId = 'chapter-1'): ManuscriptIntelligence => {
  const services = getActualServices();
  const intelligence = services.createEmptyIntelligence(chapterId);

  intelligence.structural.scenes = [
    {
      id: 'scene-1',
      startOffset: 0,
      endOffset: 25,
      type: 'action',
      pov: 'Hero',
      location: 'Citadel',
      timeMarker: 'Morning',
      tension: 0.75,
      dialogueRatio: 0.4,
    },
  ];

  intelligence.structural.stats = {
    ...intelligence.structural.stats,
    totalWords: 120,
    totalSentences: 11,
    totalParagraphs: 4,
    avgSentenceLength: 9,
    sentenceLengthVariance: 1.2,
    dialogueRatio: 0.4,
    sceneCount: 1,
    povShifts: 1,
    avgSceneLength: 25,
  };

  intelligence.entities.nodes = [
    {
      id: 'entity-1',
      name: 'Hero',
      type: 'character',
      aliases: ['Protagonist'],
      firstMention: 0,
      mentionCount: 2,
      mentions: [
        { offset: 5, chapterId },
        { offset: 12, chapterId },
      ],
      attributes: { role: ['protagonist'] },
    },
  ];

  intelligence.timeline.promises = [
    {
      id: 'promise-1',
      type: 'goal',
      description: 'Rescue the village',
      quote: 'We must save them',
      offset: 5,
      chapterId,
      resolved: false,
    },
    {
      id: 'promise-2',
      type: 'setup',
      description: 'Forge the sword',
      quote: 'Metal rings true',
      offset: 45,
      chapterId,
      resolved: true,
    },
  ];

  intelligence.heatmap.sections = [
    {
      offset: 0,
      length: 20,
      scores: {
        plotRisk: 0.8,
        pacingRisk: 0.6,
        characterRisk: 0.3,
        settingRisk: 0.1,
        styleRisk: 0.4,
      },
      overallRisk: 0.92,
      flags: ['unresolved_promise'],
      suggestions: ['Clarify stakes'],
    },
    {
      offset: 50,
      length: 15,
      scores: {
        plotRisk: 0.3,
        pacingRisk: 0.2,
        characterRisk: 0.1,
        settingRisk: 0.2,
        styleRisk: 0.1,
      },
      overallRisk: 0.35,
      flags: ['pacing_slow'],
      suggestions: ['Trim exposition'],
    },
  ];

  intelligence.style.flags = {
    passiveVoiceRatio: 5,
    passiveVoiceInstances: [],
    adverbDensity: 5,
    adverbInstances: [],
    filterWordDensity: 4,
    filterWordInstances: [],
    clicheCount: 1,
    clicheInstances: [],
    repeatedPhrases: [],
  };

  return intelligence;
};

const DEBOUNCE_DELAY = 150;
const BACKGROUND_DELAY = 2000;

describe('useManuscriptIntelligence', () => {
  beforeEach(() => {
    vi.useRealTimers();
    processInstantMock.mockClear().mockImplementation((text: string, cursorOffset: number) => ({
      wordCount: text.trim().length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length,
      sentenceCount: 1,
      paragraphCount: 1,
      cursorScene: null,
      cursorTension: cursorOffset / 10 + 0.5,
    }));
    processDebouncedMock.mockClear().mockReturnValue({
      wordCount: 100,
      sentenceCount: 5,
      paragraphCount: 2,
      cursorScene: 'action',
      cursorTension: 0.7,
      dialogueRatio: 0.3,
      avgSentenceLength: 8,
      currentParagraphType: 'action',
    });

    processManuscriptMock.mockClear().mockImplementation(() => createRichIntelligence('chapter-1'));
    updateHUDForCursorMock.mockClear().mockImplementation((intelligence) => intelligence.hud);
    generateAIContextMock.mockClear().mockImplementation((_, cursor, compressed) => `context:${cursor}:${compressed ? 'c' : 'f'}`);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('throttles instant metrics on fast typing', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useManuscriptIntelligence({ chapterId: 'chapter-1' }));

    act(() => {
      result.current.updateText('first', 0);
      result.current.updateText('second', 0);
    });

    expect(processInstantMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runOnlyPendingTimers();
    });

    vi.useRealTimers();
  });

  it('runs debounced and background processing and notifies callback', () => {
    vi.useFakeTimers();

    const onReady = vi.fn();
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'chapter-1', onIntelligenceReady: onReady })
    );

    act(() => {
      result.current.updateText('hello world', 0);
    });

    expect(processInstantMock).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_DELAY);
    });

    expect(processDebouncedMock).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(BACKGROUND_DELAY);
      vi.runOnlyPendingTimers();
    });

    expect(processManuscriptMock).toHaveBeenCalled();
    const backgroundIntelligence = processManuscriptMock.mock.results[0]?.value;
    expect(backgroundIntelligence).toBeDefined();
    expect(onReady).toHaveBeenCalledWith(backgroundIntelligence);
    expect(result.current.processingTier).toBe('idle');
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.hud).toBe(updateHUDForCursorMock.mock.results[0]?.value);
    expect(result.current.lastProcessedAt).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('forces a background process immediately', () => {
    vi.useFakeTimers();

    const onReady = vi.fn();
    const { result } = renderHook(() =>
      useManuscriptIntelligence({ chapterId: 'chapter-1', onIntelligenceReady: onReady })
    );

    act(() => {
      result.current.forceFullProcess();
      vi.runOnlyPendingTimers();
    });

    expect(processManuscriptMock).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('exposes AI context in both modes', () => {
    const { result } = renderHook(() => useManuscriptIntelligence({ chapterId: 'chapter-1' }));

    const full = result.current.getAIContext();
    const compressed = result.current.getAIContext(true);

    expect(full).toBe('context:0:f');
    expect(compressed).toBe('context:0:c');
    expect(generateAIContextMock).toHaveBeenCalledTimes(2);
  });

  it('builds section context for scenes and entities', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useManuscriptIntelligence({ chapterId: 'chapter-1' }));

    act(() => {
      result.current.forceFullProcess();
      vi.runOnlyPendingTimers();
    });

    const contextText = result.current.getSectionContext(0, 30);
    expect(contextText).toContain('[SCENES]');
    expect(contextText).toContain('tension');
    expect(contextText).toContain('[ENTITIES]');
    expect(contextText).toContain('Hero (character)');

    vi.useRealTimers();
  });

  it('updates HUD when cursor moves inside a scene', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useManuscriptIntelligence({ chapterId: 'chapter-1' }));

    act(() => {
      result.current.forceFullProcess();
      vi.runOnlyPendingTimers();
    });

    updateHUDForCursorMock.mockClear();

    act(() => {
      result.current.updateCursor(5);
    });

    expect(updateHUDForCursorMock).toHaveBeenCalledWith(result.current.intelligence, 5);
    vi.useRealTimers();
  });

  it('uses requestIdleCallback when available for background processing', () => {
    const idleSpy = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });

    vi.stubGlobal('requestIdleCallback', idleSpy);
    const { result } = renderHook(() => useManuscriptIntelligence({ chapterId: 'chapter-1' }));

    act(() => {
      result.current.forceFullProcess();
    });

    expect(idleSpy).toHaveBeenCalled();
    expect(processManuscriptMock).toHaveBeenCalled();
  });
});

describe('selector hooks', () => {
  it('selects the current scene at the cursor', () => {
    const intelligence = createRichIntelligence();
    const { result } = renderHook(() => useCurrentScene(intelligence, 10));
    expect(result.current?.type).toBe('action');
  });

  it('emits style alerts when thresholds are exceeded', () => {
    const intelligence = createRichIntelligence();
    const { result } = renderHook(() => useStyleAlerts(intelligence));
    expect(result.current).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Passive voice'),
        expect.stringContaining('Adverb density'),
        expect.stringContaining('clich'),
        expect.stringContaining('Filter words'),
      ])
    );
  });

  it('returns only unresolved promises', () => {
    const intelligence = createRichIntelligence();
    const { result } = renderHook(() => useOpenPromises(intelligence));
    expect(result.current.every(p => !p.resolved)).toBe(true);
    expect(result.current.length).toBe(1);
  });

  it('sorts high-risk sections above threshold', () => {
    const intelligence = createRichIntelligence();
    const { result } = renderHook(() => useHighRiskSections(intelligence, 0.2));
    expect(result.current[0].overallRisk).toBeGreaterThanOrEqual(result.current[1].overallRisk);
    expect(result.current.every(section => section.overallRisk >= 0.2)).toBe(true);
  });
});
