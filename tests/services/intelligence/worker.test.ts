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

  it('handles incremental processing (PROCESS_FULL with previous context)', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_FULL',
        id: 'inc-1',
        payload: {
          text: 'New text',
          chapterId: 'ch-1',
          previousText: 'Old text',
          previousIntelligence: { entities: { nodes: [] }, timeline: { events: [] } },
          cursorOffset: 0,
        },
      },
    } as MessageEvent);

    const resultCall = postMessage.mock.calls.find(call => call[0]?.type === 'RESULT');
    expect(resultCall).toBeTruthy();
    // Delta should be computed (mocked above)
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

  it('handles PROCESS_ENTITIES and sends PARTIAL entities payload', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'PROCESS_ENTITIES',
        id: 'ent-1',
        payload: { text: 'Some text', chapterId: 'ch-1' },
      },
    } as MessageEvent);

    const partialCall = postMessage.mock.calls.find(call => call[0]?.type === 'PARTIAL');
    expect(partialCall).toBeTruthy();
    expect(partialCall[0].id).toBe('ent-1');
    expect(partialCall[0].payload).toHaveProperty('entities');
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

  it('does not send response if cancelled during processing', async () => {
    // Mock parseStructure to trigger a cancellation recursively
    const workerSelf = await loadWorker();

    // We need to re-mock the dependency specifically for this test or use the existing mock
    // But modules are cached. We used vi.resetModules in beforeEach, so loadWorker gets fresh mocks.
    // However, we want to inject behavior into the ALREADY loaded module.
    // We can't easily do that because we mocked the module path.
    // BUT loadWorker mocks factories.

    // Let's redefine loadWorker logic inline for this specific test case to inject the cancellation side-effect
    vi.resetModules();

    let triggerCancel: () => void = () => {};

    vi.doMock('../../../services/intelligence/structuralParser', () => ({
      parseStructure: vi.fn(() => {
        // Trigger cancellation!
        triggerCancel();
        return { paragraphs: [], scenes: [], dialogueMap: {}, stats: {}, processedAt: 0 };
      }),
    }));
    // Mock others minimally
    vi.doMock('../../../services/intelligence/entityExtractor', () => ({ extractEntities: vi.fn() }));
    vi.doMock('../../../services/intelligence/styleAnalyzer', () => ({ analyzeStyle: vi.fn() }));
    vi.doMock('../../../services/intelligence/contextBuilder', () => ({ buildHUD: vi.fn() }));

    await import('../../../services/intelligence/worker');
    const self = (globalThis as any).self;
    triggerCancel = () => {
      self.onmessage({ data: { type: 'CANCEL', id: 'cancel-during-process' } } as MessageEvent);
    };

    self.onmessage({
      data: { type: 'PROCESS_STRUCTURAL', id: 'struct-cancel', payload: { text: '' } },
    } as MessageEvent);

    // Should NOT have sent PARTIAL result because ID was cleared
    const postMessage = self.postMessage as ReturnType<typeof vi.fn>;
    const partialCalls = postMessage.mock.calls.filter(c => c[0]?.type === 'PARTIAL');
    expect(partialCalls.length).toBe(0);
  });

  it('ignores unknown message types', async () => {
    const workerSelf = await loadWorker();
    const postMessage = (globalThis as any).self.postMessage as ReturnType<typeof vi.fn>;

    workerSelf.onmessage?.({
      data: {
        type: 'UNKNOWN_TYPE',
        id: 'unknown-1',
        payload: {},
      } as any,
    } as MessageEvent);

    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'unknown-1' }));
  });
});
