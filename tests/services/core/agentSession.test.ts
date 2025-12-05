import { describe, it, expect, vi } from 'vitest';
import {
  buildManuscriptContext,
  buildMemoryContext,
  buildInitializationMessage,
  createChatSessionFromContext,
} from '@/services/core/agentSession';

const mockChat = { sendMessage: vi.fn() };

const mockCreateAgentSession = vi.hoisted(() =>
  vi.fn(() => mockChat),
);

vi.mock('@/services/gemini/agent', () => ({
  createAgentSession: mockCreateAgentSession,
}));

describe('agentSession helpers', () => {
  const chapters = [
    { id: 'c1', title: 'One', content: 'First', order: 0, updatedAt: 0 },
    { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
  ];

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

  it('returns empty memory context when provider missing', async () => {
    const result = await buildMemoryContext(undefined, 'p1');
    expect(result).toBe('');
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
});
