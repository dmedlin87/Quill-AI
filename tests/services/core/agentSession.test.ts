import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildManuscriptContext,
  buildMemoryContext,
  buildInitializationMessage,
  createChatSessionFromContext,
  fetchMemoryContext,
} from '@/services/core/agentSession';

const mockChat = { sendMessage: vi.fn() };

const mockCreateAgentSession = vi.hoisted(() =>
  vi.fn(() => mockChat),
);

const {
  mockGetMemoriesForContext,
  mockGetActiveGoals,
  mockFormatMemoriesForPrompt,
  mockFormatGoalsForPrompt,
  mockSearchBedsideHistory,
} = vi.hoisted(() => ({
  mockGetMemoriesForContext: vi.fn(),
  mockGetActiveGoals: vi.fn(),
  mockFormatMemoriesForPrompt: vi.fn(),
  mockFormatGoalsForPrompt: vi.fn(),
  mockSearchBedsideHistory: vi.fn(),
}));

vi.mock('@/services/gemini/agent', () => ({
  createAgentSession: mockCreateAgentSession,
}));

vi.mock('@/services/memory/memoryQueries', () => ({
  getMemoriesForContext: mockGetMemoriesForContext,
}));

vi.mock('@/services/memory', () => ({
  getActiveGoals: mockGetActiveGoals,
  formatMemoriesForPrompt: mockFormatMemoriesForPrompt,
  formatGoalsForPrompt: mockFormatGoalsForPrompt,
}));

// Mock bedside history search to avoid DB access
vi.mock('@/services/memory/bedsideHistorySearch', () => ({
  searchBedsideHistory: mockSearchBedsideHistory,
}));

describe('agentSession helpers', () => {
  const chapters = [
    { id: 'c1', title: 'One', content: 'First', order: 0, updatedAt: 0 },
    { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchBedsideHistory.mockResolvedValue([]);
  });

  it('marks the active chapter in manuscript context', () => {
    const ctx = buildManuscriptContext(chapters as any, 'Second');
    expect(ctx).toContain('(READ ONLY - Request user to switch)');
    expect(ctx).toContain('(ACTIVE - You can edit this)');
    expect(ctx).toContain('[CHAPTER: Two]');
  });

  it('builds memory context with provider and projectId', async () => {
    const provider = {
      buildMemoryContext: vi.fn(async (projectId: string) => `[mem:${projectId}]`),
    };

    const result = await buildMemoryContext(provider, 'p1');
    expect(result).toBe('[mem:p1]');
    expect(provider.buildMemoryContext).toHaveBeenCalledWith('p1');
  });

  it('returns empty memory context when projectId is missing', async () => {
    const provider = {
      buildMemoryContext: vi.fn(async (projectId: string) => `[mem:${projectId}]`),
    };

    const result = await buildMemoryContext(provider, null);
    expect(result).toBe('');
    expect(provider.buildMemoryContext).not.toHaveBeenCalled();
  });

  it('returns empty memory context when provider missing', async () => {
    const result = await buildMemoryContext(undefined, 'p1');
    expect(result).toBe('');
  });

  it('handles provider errors gracefully and logs a warning', async () => {
    const error = new Error('boom');
    const provider = {
      buildMemoryContext: vi.fn(async () => {
        throw error;
      }),
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await buildMemoryContext(provider, 'p1');

    expect(result).toBe('');
    expect(provider.buildMemoryContext).toHaveBeenCalledWith('p1');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AgentSession] Failed to fetch memory context:',
      error,
    );

    warnSpy.mockRestore();
  });

  it('builds initialization message with persona & memory status', () => {
    const msg = buildInitializationMessage({
      chapters: chapters as any,
      fullText: 'Second',
      memoryContext: 'mem here',
      persona: { name: 'Guide', role: 'helpful' } as any,
    });

    expect(msg).toContain('Guide');
    expect(msg).toContain('Memory loaded');
    expect(msg).toContain('Total Chapters: 2');
  });

  it('builds initialization message when there is no memory context', () => {
    const msg = buildInitializationMessage({
      chapters: chapters as any,
      fullText: 'Second',
      memoryContext: '',
      persona: { name: 'Guide', role: 'helpful' } as any,
    });

    expect(msg).toContain('Guide');
    expect(msg).toContain('No memories yet.');
  });

  it('creates chat session with composed options', async () => {
    const context = {
      chapters,
      fullText: 'Second',
      lore: { characters: [], worldRules: [] },
      analysis: null,
      projectId: 'p1',
      critiqueIntensity: 'standard',
      experienceLevel: 'intermediate',
      autonomyMode: 'copilot',
    } as any;

    const memoryProvider = {
      buildMemoryContext: vi.fn(async () => 'mem block'),
    };

    const persona = { name: 'Guide', role: 'helper' } as any;

    const { chat, memoryContext } = await createChatSessionFromContext({
      context,
      persona,
      memoryProvider,
      projectId: 'p1',
    });

    expect(chat).toBe(mockChat);
    expect(memoryContext).toBe('mem block');
    expect(mockCreateAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fullManuscriptContext: expect.stringContaining('[CHAPTER: Two]'),
        persona,
        memoryContext: 'mem block',
        intensity: 'standard',
        experience: 'intermediate',
        autonomy: 'copilot',
      }),
    );
  });

  it('creates chat session using default memory fetch when provider is missing', async () => {
    mockGetMemoriesForContext.mockResolvedValueOnce([] as any);
    mockGetActiveGoals.mockResolvedValueOnce([] as any);
    mockFormatMemoriesForPrompt.mockReturnValueOnce('');
    mockFormatGoalsForPrompt.mockReturnValueOnce('');

    const context = {
      chapters,
      fullText: 'Second',
      lore: { characters: [], worldRules: [] },
      analysis: null,
      projectId: 'ctx-project',
      critiqueIntensity: 'standard',
      experienceLevel: 'intermediate',
      autonomyMode: 'copilot',
      intelligenceHUD: { enabled: true },
      interviewTarget: 'protagonist',
    } as any;

    const persona = { name: 'Guide', role: 'helper' } as any;

    const { chat, memoryContext } = await createChatSessionFromContext({
      context,
      persona,
      projectId: 'top-project',
    });

    expect(chat).toBe(mockChat);
    expect(mockGetMemoriesForContext).toHaveBeenCalledWith('top-project', { limit: 25 });
    expect(mockGetActiveGoals).toHaveBeenCalledWith('top-project');
    expect(memoryContext).toContain('[AGENT MEMORY]');
  });

  it('skips memory fetching when no project id is available', async () => {
    const context = {
      chapters,
      fullText: 'Second',
      lore: { characters: [], worldRules: [] },
      analysis: null,
      projectId: null,
      critiqueIntensity: 'standard',
      experienceLevel: 'intermediate',
      autonomyMode: 'copilot',
    } as any;

    const persona = { name: 'Guide', role: 'helper' } as any;

    const { memoryContext } = await createChatSessionFromContext({
      context,
      persona,
    });

    expect(memoryContext).toBe('');
    expect(mockGetMemoriesForContext).not.toHaveBeenCalled();
    expect(mockGetActiveGoals).not.toHaveBeenCalled();
  });

  it('fetches default memory context with memories and goals', async () => {
    mockGetMemoriesForContext.mockResolvedValueOnce([{ id: 'm1' }] as any);
    mockGetActiveGoals.mockResolvedValueOnce([{ id: 'g1' }] as any);
    mockFormatMemoriesForPrompt.mockReturnValueOnce('formatted memories');
    mockFormatGoalsForPrompt.mockReturnValueOnce('formatted goals');

    const result = await fetchMemoryContext('proj-1');

    expect(mockGetMemoriesForContext).toHaveBeenCalledWith('proj-1', { limit: 25 });
    expect(mockGetActiveGoals).toHaveBeenCalledWith('proj-1');
    expect(result).toContain('[AGENT MEMORY]');
    expect(result).toContain('formatted memories');
    expect(result).toContain('formatted goals');
  });

  it('falls back to default copy when there are no formatted memories', async () => {
    mockGetMemoriesForContext.mockResolvedValueOnce([] as any);
    mockGetActiveGoals.mockResolvedValueOnce([] as any);
    mockFormatMemoriesForPrompt.mockReturnValueOnce('');
    mockFormatGoalsForPrompt.mockReturnValueOnce('');

    const result = await fetchMemoryContext('proj-2');

    expect(result).toContain('[AGENT MEMORY]');
    expect(result).toContain('(No stored memories yet.)');
  });

  it('handles errors from default memory fetch and logs a warning', async () => {
    const error = new Error('default-mem-boom');
    mockGetMemoriesForContext.mockRejectedValueOnce(error);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchMemoryContext('proj-err');

    expect(result).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AgentSession] Failed to fetch default memory context:',
      error,
    );

    warnSpy.mockRestore();
  });
});
