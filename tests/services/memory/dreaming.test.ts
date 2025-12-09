import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDreamingCycle } from '../../../services/memory/dreaming';
import { ai } from '../../../services/gemini/client';
import { applyBedsideNoteMutation } from '../../../services/memory/bedsideNoteMutations';
import { getOrCreateBedsideNote } from '../../../services/memory/chains';
import { createMemory, deleteMemory, getMemories } from '../../../services/memory/index';
import { ModelConfig } from '../../../config/models';

// Mocks
vi.mock('../../../services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('../../../services/memory/bedsideNoteMutations', () => ({
  applyBedsideNoteMutation: vi.fn(),
}));

vi.mock('../../../services/memory/chains', () => ({
  getOrCreateBedsideNote: vi.fn(),
}));

vi.mock('../../../services/memory/index', () => ({
  createMemory: vi.fn(),
  deleteMemory: vi.fn(),
  getMemories: vi.fn(),
}));

describe('Dreaming Service', () => {
  const mockProjectId = 'project-123';
  const mockSignal = new AbortController().signal;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 summarized if no episodic memories are found', async () => {
    vi.mocked(getMemories).mockResolvedValue([]);

    const result = await runDreamingCycle(mockProjectId, mockSignal);

    expect(result).toEqual({ summarized: 0, removed: 0 });
    expect(getMemories).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'project',
      projectId: mockProjectId,
    }));
    expect(ai.models.generateContent).not.toHaveBeenCalled();
  });

  it('should process episodic memories and consolidate them', async () => {
    const recentTime = Date.now() - 1000;
    const mockMemories = [
      { id: '1', text: 'Mem 1', topicTags: ['episodic'], updatedAt: recentTime, importance: 0.8 },
      { id: '2', text: 'Mem 2', topicTags: ['episodic', 'other'], updatedAt: recentTime, importance: 0.6 },
    ];

    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);
    vi.mocked(getOrCreateBedsideNote).mockResolvedValue({
      structuredContent: { openQuestions: ['What is the meaning of life?'] },
    } as any);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          title: 'Narrative Summary',
          summary: 'A consolidated summary.',
          tags: ['plot'],
          answeredQuestions: ['What is the meaning of life?'],
        }),
      },
    } as any);

    const result = await runDreamingCycle(mockProjectId, mockSignal);

    expect(result).toEqual({ summarized: 1, removed: 2 });

    // Verify AI call
    expect(ai.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: ModelConfig.agent,
    }));

    // Verify memory creation (consolidation)
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Narrative Summary: A consolidated summary.',
      topicTags: expect.arrayContaining(['narrative_arc', 'episodic_rollup', 'plot']),
      importance: 0.7, // Average of 0.8 and 0.6
    }));

    // Verify question archiving
    expect(applyBedsideNoteMutation).toHaveBeenCalledWith(mockProjectId, {
      section: 'openQuestions',
      action: 'remove',
      content: ['What is the meaning of life?'],
    });

    // Verify deletion of old memories
    expect(deleteMemory).toHaveBeenCalledTimes(2);
    expect(deleteMemory).toHaveBeenCalledWith('1');
    expect(deleteMemory).toHaveBeenCalledWith('2');
  });

  it('should handle missing AI response fields gracefully', async () => {
    const recentTime = Date.now() - 1000;
    const mockMemories = [
      { id: '1', text: 'Mem 1', topicTags: ['episodic'], updatedAt: recentTime, importance: 0.5 },
    ];

    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);
    vi.mocked(getOrCreateBedsideNote).mockResolvedValue({ structuredContent: {} } as any);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
      response: {
        text: () => 'Invalid JSON',
      },
    } as any);

    const result = await runDreamingCycle(mockProjectId, mockSignal);

    expect(result).toEqual({ summarized: 1, removed: 1 });
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Recent edits were consolidated into a narrative checkpoint.',
    }));
  });

  it('should respect abort signal before AI call', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const mockMemories = [{ id: '1', topicTags: ['episodic'], updatedAt: Date.now() }];
    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);

    await expect(runDreamingCycle(mockProjectId, abortController.signal))
      .rejects.toThrow('Dreaming aborted');

    expect(ai.models.generateContent).not.toHaveBeenCalled();
  });

  it('should respect abort signal after AI call', async () => {
    const abortController = new AbortController();

    const mockMemories = [{ id: '1', topicTags: ['episodic'], updatedAt: Date.now() }];
    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);
    vi.mocked(getOrCreateBedsideNote).mockResolvedValue({} as any);

    vi.mocked(ai.models.generateContent).mockImplementation(async () => {
      abortController.abort(); // Abort during call
      return { response: { text: () => '{}' } } as any;
    });

    await expect(runDreamingCycle(mockProjectId, abortController.signal))
      .rejects.toThrow('Dreaming aborted');

    expect(createMemory).not.toHaveBeenCalled();
  });

  it('should filter out old memories or memories without the tag', async () => {
    const now = Date.now();
    const mockMemories = [
      { id: '1', text: 'Recent', topicTags: ['episodic'], updatedAt: now, importance: 1 },
      { id: '2', text: 'Old', topicTags: ['episodic'], updatedAt: now - (1000 * 60 * 60 * 2), importance: 1 }, // 2 hours old
      { id: '3', text: 'Wrong Tag', topicTags: ['other'], updatedAt: now, importance: 1 },
    ];

    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);
    vi.mocked(getOrCreateBedsideNote).mockResolvedValue({} as any);
    vi.mocked(ai.models.generateContent).mockResolvedValue({ response: { text: () => '{}' } } as any);

    await runDreamingCycle(mockProjectId, mockSignal);

    // Only memory 1 should be processed and deleted
    expect(deleteMemory).toHaveBeenCalledTimes(1);
    expect(deleteMemory).toHaveBeenCalledWith('1');
  });

  it('should handle failure in archiving questions without crashing', async () => {
    const mockMemories = [{ id: '1', topicTags: ['episodic'], updatedAt: Date.now(), importance: 0.5 }];
    vi.mocked(getMemories).mockResolvedValue(mockMemories as any);
    vi.mocked(getOrCreateBedsideNote).mockResolvedValue({ structuredContent: { openQuestions: ['Q1'] } } as any);

    vi.mocked(ai.models.generateContent).mockResolvedValue({
      response: {
        text: () => JSON.stringify({ answeredQuestions: ['Q1'] }),
      },
    } as any);

    vi.mocked(applyBedsideNoteMutation).mockRejectedValue(new Error('DB Error'));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runDreamingCycle(mockProjectId, mockSignal);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to archive bedside questions'), expect.any(Error));
    // Should proceed to delete memories even if archiving failed
    expect(deleteMemory).toHaveBeenCalledWith('1');
  });
});
