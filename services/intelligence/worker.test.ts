import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockedStructural = {
  paragraphs: [],
  dialogueMap: {},
  scenes: [],
  stats: {} as any,
  fingerprint: {} as any,
  tension: 0,
};

const parseStructureMock = vi.fn(() => mockedStructural);
const extractEntitiesMock = vi.fn(() => ({ nodes: [], edges: [] } as any));
const buildTimelineMock = vi.fn(() => ({ events: [], promises: [] } as any));
const analyzeStyleMock = vi.fn(() => ({ readability: 0 } as any));
const analyzeVoicesMock = vi.fn(() => ({ voices: [] } as any));
const buildHeatmapMock = vi.fn(() => ({ sections: [] } as any));
const createDeltaMock = vi.fn(() => ({ changes: [] } as any));
const createEmptyDeltaMock = vi.fn(() => ({ changes: [] } as any));
const buildHUDMock = vi.fn(() => ({ hud: true } as any));

vi.mock('./structuralParser', () => ({ parseStructure: parseStructureMock }));
vi.mock('./entityExtractor', () => ({ extractEntities: extractEntitiesMock }));
vi.mock('./timelineTracker', () => ({ buildTimeline: buildTimelineMock }));
vi.mock('./styleAnalyzer', () => ({ analyzeStyle: analyzeStyleMock }));
vi.mock('./voiceProfiler', () => ({ analyzeVoices: analyzeVoicesMock }));
vi.mock('./heatmapBuilder', () => ({ buildHeatmap: buildHeatmapMock }));
vi.mock('./deltaTracker', () => ({
  createDelta: createDeltaMock,
  createEmptyDelta: createEmptyDeltaMock,
}));
vi.mock('./contextBuilder', () => ({ buildHUD: buildHUDMock }));

const basePayload = {
  text: 'Example manuscript text',
  chapterId: 'chapter-1',
};

const sendMessage = (data: any) => {
  const handler = (self as any).onmessage;
  handler?.({ data } as MessageEvent<any>);
};

describe('intelligence worker harness', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    postMessageSpy = vi.fn();
    (globalThis as any).self = { postMessage: postMessageSpy } as any;
    await import('./worker');
    postMessageSpy.mockClear();
  });

  afterEach(() => {
    delete (globalThis as any).self;
  });

  it('does not post a result after cancellation', () => {
    postMessageSpy.mockImplementation((message: any) => {
      if (message.type === 'PROGRESS' && message.progress?.percent === 40) {
        sendMessage({ type: 'CANCEL', id: 'cancel', payload: basePayload });
      }
    });

    sendMessage({ type: 'PROCESS_FULL', id: 'req-1', payload: basePayload });

    const resultMessage = postMessageSpy.mock.calls.find(
      ([call]) => call?.type === 'RESULT'
    );
    expect(resultMessage).toBeUndefined();
  });

  it('emits progress updates in order during full processing', () => {
    sendMessage({ type: 'PROCESS_FULL', id: 'req-2', payload: basePayload });

    const progressPercents = postMessageSpy.mock.calls
      .filter(([message]) => message?.type === 'PROGRESS')
      .map(([message]) => message.progress?.percent);

    expect(progressPercents).toEqual([
      10, 20, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 88, 90, 95, 100,
    ]);
  });

  it('posts structural partials only when the request is current', () => {
    parseStructureMock.mockImplementationOnce(() => {
      sendMessage({ type: 'CANCEL', id: 'cancel', payload: basePayload });
      return mockedStructural;
    });

    sendMessage({ type: 'PROCESS_STRUCTURAL', id: 'req-3', payload: basePayload });

    const partialMessages = postMessageSpy.mock.calls.filter(
      ([message]) => message?.type === 'PARTIAL'
    );

    expect(partialMessages).toHaveLength(0);
  });
});
