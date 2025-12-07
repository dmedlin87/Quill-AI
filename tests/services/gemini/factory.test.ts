import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockChatCreate = vi.hoisted(() => vi.fn());
const mockChatSend = vi.hoisted(() => vi.fn());

const mockAi = {
  chats: {
    create: mockChatCreate,
  },
};

const mockNormalize = vi.hoisted(() =>
  vi.fn((err: Error, ctx: Record<string, unknown>) => new AIError(`normalized:${err.message}`, { cause: ctx })),
);

vi.mock('@/services/gemini/client', () => ({
  ai: mockAi,
}));

vi.mock('@/services/gemini/errors', async () => {
  const actual = await vi.importActual<typeof import('@/services/gemini/errors')>('@/services/gemini/errors');
  return {
    ...actual,
    normalizeAIError: mockNormalize,
  };
});

vi.mock('@/services/gemini/agentTools', () => ({
  ALL_AGENT_TOOLS: [{ name: 'all-tool' }],
  VOICE_SAFE_TOOLS: [{ name: 'voice-tool' }],
  QUICK_TOOLS: [],
  NAVIGATION_TOOLS: [],
  EDITING_TOOLS: [],
  ANALYSIS_TOOLS: [],
  UI_CONTROL_TOOLS: [],
  KNOWLEDGE_TOOLS: [],
  GENERATION_TOOLS: [],
}));

vi.mock('@/services/gemini/serializers', () => {
  class PromptBuilder {
    private system: string;
    private context: Record<string, unknown> = {};
    constructor(systemInstruction: string) {
      this.system = systemInstruction;
    }
    setIntensity(intensity: unknown) {
      this.context.intensity = intensity;
      return this;
    }
    addLore(lore: unknown) {
      this.context.lore = lore;
      return this;
    }
    addAnalysis(analysis: unknown) {
      this.context.analysis = analysis;
      return this;
    }
    addContext(ctx: Record<string, unknown>) {
      this.context = { ...this.context, ...ctx };
      return this;
    }
    build() {
      return `${this.system}|${this.context.intensity ?? 'none'}`;
    }
  }
  return {
    PromptBuilder,
    buildInterviewInstruction: (base: string, target: unknown) => `${base}|interview:${JSON.stringify(target)}`,
    AGENT_SYSTEM_INSTRUCTION: 'SYS',
  };
});

vi.mock('@/services/gemini/critiquePrompts', () => ({
  getIntensityModifier: vi.fn(() => 'intensity-mod'),
}));

vi.mock('@/services/gemini/experiencePrompts', () => ({
  getExperienceModifier: vi.fn(() => 'experience-mod'),
  getAutonomyModifier: vi.fn(() => 'autonomy-mod'),
}));

vi.mock('@/config/models', () => ({
  ModelConfig: {
    get agent() {
      return 'agent-model';
    },
    get liveAudio() {
      return 'live-audio-model';
    },
  },
}));

import { AIError } from '@/services/gemini/errors';
import {
  createAgentSession,
  createAgentSessionLegacy,
  QuillAgent,
} from '@/services/gemini/factory';

describe('createAgentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCreate.mockResolvedValue({ sendMessage: mockChatSend });
  });

  it('builds chat parameters for text mode with history', async () => {
    const history = [{ role: 'user', parts: [{ text: 'hi' }] }];
    const result = await createAgentSession({
      fullManuscriptContext: 'FULL',
      conversationHistory: history as any,
    });

    expect(result).toBeDefined();
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const params = mockChatCreate.mock.calls[0][0];
    expect(params.model).toBe('agent-model');
    expect(params.config.tools[0].functionDeclarations).toEqual([{ name: 'all-tool' }]);
    expect(params.history).toEqual(history);
    expect(String(params.config.systemInstruction)).toContain('SYS');
  });

  it('uses voice-safe toolset and model for voice mode', async () => {
    await createAgentSession({ mode: 'voice' });

    const params = mockChatCreate.mock.calls[0][0];
    expect(params.model).toBe('live-audio-model');
    expect(params.config.tools[0].functionDeclarations).toEqual([{ name: 'voice-tool' }]);
  });

  it('legacy wrapper forwards to createAgentSession', async () => {
    await createAgentSessionLegacy(undefined, undefined, 'CTX');
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
  });
});

describe('QuillAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCreate.mockResolvedValue({ sendMessage: mockChatSend });
    mockChatSend.mockResolvedValue({ text: 'hello' });
  });

  it('initializes once and sends messages', async () => {
    const agent = new QuillAgent({ fullManuscriptContext: 'ctx' });

    await agent.initialize();
    await agent.initialize();

    expect(mockChatCreate).toHaveBeenCalledTimes(1);

    const response = await agent.sendMessage({ message: 'hi' } as any);
    expect(mockChatSend).toHaveBeenCalledWith({ message: 'hi' });
    expect(response).toEqual({ text: 'hello' });

    const text = await agent.sendText('plain');
    expect(text).toBe('hello');
  });

  it('throws AIError when sending before initialization', async () => {
    const agent = new QuillAgent({ fullManuscriptContext: 'ctx' });
    await expect(agent.sendMessage({ message: 'hi' } as any)).rejects.toBeInstanceOf(AIError);
  });

  it('normalizes errors on initialize failure', async () => {
    const agent = new QuillAgent({ fullManuscriptContext: 'ctx' });
    mockChatCreate.mockRejectedValueOnce(new Error('create-fail'));

    await expect(agent.initialize()).rejects.toThrow(/normalized:create-fail/);
    expect(mockNormalize).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ phase: 'initialize' }));
  });

  it('normalizes errors on sendMessage failure', async () => {
    const agent = new QuillAgent({ fullManuscriptContext: 'ctx' });
    mockChatCreate.mockResolvedValueOnce({ sendMessage: vi.fn().mockRejectedValue(new Error('send-fail')) });

    await agent.initialize();
    await expect(agent.sendMessage({ message: 'hi' } as any)).rejects.toThrow(/normalized:send-fail/);
    expect(mockNormalize).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ phase: 'sendMessage' }));
  });
});
