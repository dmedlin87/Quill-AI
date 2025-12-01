import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The worker file assumes a Web Worker environment. To test the message handler
// we load the module after stubbing `self` and capture `postMessage` calls.

describe('Intelligence worker message handling', () => {
  const originalSelf = globalThis.self as any;

  beforeEach(() => {
    (globalThis as any).self = {
      postMessage: vi.fn(),
      onmessage: null,
    } as any;

    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as any).self = originalSelf;
  });

  const loadWorker = async () => {
    vi.doMock('../../../services/intelligence/structuralParser', () => ({
      parseStructure: vi.fn(() => ({
        paragraphs: [],
        scenes: [],
        dialogueMap: {},
        stats: { totalWords: 0, dialogueRatio: 0 },
        processedAt: 0,
      })),
      getSceneAtOffset: vi.fn(),
      getParagraphAtOffset: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/entityExtractor', () => ({
      extractEntities: vi.fn(() => ({ nodes: [], edges: [] })),
      getEntitiesInRange: vi.fn(() => []),
      getRelatedEntities: vi.fn(() => []),
    }));

    vi.doMock('../../../services/intelligence/timelineTracker', () => ({
      buildTimeline: vi.fn(() => ({ events: [], promises: [] })),
      getUnresolvedPromises: vi.fn(() => []),
      getEventsInRange: vi.fn(() => []),
    }));

    vi.doMock('../../../services/intelligence/styleAnalyzer', () => ({
      analyzeStyle: vi.fn(() => ({
        flags: {
          passiveVoiceInstances: [],
          adverbInstances: [],
          filterWordInstances: [],
          passiveVoiceRatio: 0,
          adverbDensity: 0,
          clicheCount: 0,
          clicheInstances: [],
        },
        syntax: { avgSentenceLength: 0 },
        vocabulary: { overusedWords: [] },
      })),
    }));

    vi.doMock('../../../services/intelligence/voiceProfiler', () => ({
      analyzeVoices: vi.fn(() => ({ profiles: {}, consistencyAlerts: [] })),
    }));

    vi.doMock('../../../services/intelligence/heatmapBuilder', () => ({
      buildHeatmap: vi.fn(() => ({ sections: [], hotspots: [], processedAt: 0 })),
      getSectionAtOffset: vi.fn(),
    }));

    vi.doMock('../../../services/intelligence/deltaTracker', () => ({
      createDelta: vi.fn(() => ({ changedRanges: [] })),
      createEmptyDelta: vi.fn(() => ({ changedRanges: [] })),
    }));

    vi.doMock('../../../services/intelligence/contextBuilder', () => ({
      buildHUD: vi.fn(() => ({
        situational: {} as any,
        context: {} as any,
        styleAlerts: [],
        prioritizedIssues: [],
        recentChanges: [],
        stats: { wordCount: 0, readingTime: 0, dialoguePercent: 0, avgSentenceLength: 0 },
        lastFullProcess: 0,
        processingTier: 'background',
      })),
    }));

    await import('../../../services/intelligence/worker');
    const workerSelf = (globalThis as any).self as { onmessage: ((event: MessageEvent<any>) => void) | null };
    expect(workerSelf.onmessage).toBeTypeOf('function');
    return workerSelf;
  };

  it('sends READY message on load', async () => {
    await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;
    expect(postMessage).toHaveBeenCalledWith({ type: 'READY', id: 'init' });
  });

  it('handles PROCESS_FULL messages and returns RESULT', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_FULL',
        id: 'req-1',
        payload: {
          text: 'Example text',
          chapterId: 'ch-1',
          previousText: undefined,
          previousIntelligence: undefined,
          cursorOffset: 0,
        },
      },
    } as MessageEvent);

    const resultCall = postMessage.mock.calls.find(call => call[0]?.type === 'RESULT');
    expect(resultCall).toBeTruthy();
    expect(resultCall[0].id).toBe('req-1');
    expect(resultCall[0].payload).toMatchObject({ chapterId: 'ch-1' });
  });

  it('handles CANCEL messages by clearing currentRequestId and not sending RESULT', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: { type: 'CANCEL', id: 'cancel-1', payload: { text: '', chapterId: 'c', previousText: '', previousIntelligence: undefined } },
    } as MessageEvent);

    const callTypes = postMessage.mock.calls.map(call => call[0]?.type);
    expect(callTypes).not.toContain('RESULT');
  });

  it('handles PROCESS_STRUCTURAL and sends PARTIAL payload', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_STRUCTURAL',
        id: 'struct-1',
        payload: { text: 'Some text', chapterId: 'ch-1' },
      },
    } as MessageEvent);

    const partialCall = postMessage.mock.calls.find(call => call[0]?.type === 'PARTIAL');
    expect(partialCall).toBeTruthy();
    expect(partialCall[0].id).toBe('struct-1');
    expect(partialCall[0].payload).toHaveProperty('structural');
  });

  it('handles PROCESS_STYLE and sends PARTIAL style payload', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_STYLE',
        id: 'style-1',
        payload: { text: 'Some text', chapterId: 'ch-1' },
      },
    } as MessageEvent);

    const partialCall = postMessage.mock.calls.find(call => call[0]?.type === 'PARTIAL');
    expect(partialCall).toBeTruthy();
    expect(partialCall[0].id).toBe('style-1');
    expect(partialCall[0].payload).toHaveProperty('style');
  });

  it('sends ERROR response when handler throws', async () => {
    vi.doMock('../../../services/intelligence/structuralParser', () => ({
      parseStructure: vi.fn(() => {
        throw new Error('boom');
      }),
    }));

    (globalThis as any).self = {
      postMessage: vi.fn(),
      onmessage: null,
    } as any;

    await import('../../../services/intelligence/worker');
    const workerSelf = (globalThis as any).self as { onmessage: ((event: MessageEvent<any>) => void) | null };
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_STRUCTURAL',
        id: 'err-1',
        payload: { text: 'x', chapterId: 'ch' },
      },
    } as MessageEvent);

    const errorCall = postMessage.mock.calls.find(call => call[0]?.type === 'ERROR');
    expect(errorCall).toBeTruthy();
    expect(errorCall[0].id).toBe('err-1');
    expect(errorCall[0].error).toBe('boom');
  });
});
