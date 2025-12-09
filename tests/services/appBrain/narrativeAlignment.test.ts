import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runNarrativeAlignmentCheck } from '@/services/appBrain/narrativeAlignment';
import { db } from '@/services/db';
import * as memory from '@/services/memory';
import * as intelligence from '@/services/intelligence';
import { BedsideNoteContent } from '@/services/memory/types';

// Mock dependencies
vi.mock('@/services/db', () => ({
  db: {
    chapters: {
      get: vi.fn(),
    },
  },
}));

vi.mock('@/services/memory', async () => {
  const actual = await vi.importActual('@/services/memory');
  return {
    ...actual,
    getOrCreateBedsideNote: vi.fn(),
    evolveBedsideNote: vi.fn(),
  };
});

vi.mock('@/services/intelligence', async () => {
  return {
    processManuscript: vi.fn(),
  };
});

describe('runNarrativeAlignmentCheck', () => {
  const projectId = 'proj-1';
  const chapterId = 'chap-1';
  const chapterContent = 'Some text content';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects drift and evolves bedside note', async () => {
    // Setup Mocks
    vi.mocked(db.chapters.get).mockResolvedValue({
      id: chapterId,
      projectId,
      content: chapterContent,
    } as any);

    vi.mocked(memory.getOrCreateBedsideNote).mockResolvedValue({
      id: 'note-1',
      text: 'Plan',
      structuredContent: {
        activeGoals: [{ title: 'Write a slow scene', status: 'active' }],
      } as BedsideNoteContent,
    } as any);

    // Mock intelligence to show drift (High Tension vs Slow Scene)
    vi.mocked(intelligence.processManuscript).mockReturnValue({
      structural: {
        stats: { avgTension: 0.9 }, // High tension -> drift
      },
      entities: { nodes: [] },
      timeline: { promises: [] },
    } as any);

    // Run
    await runNarrativeAlignmentCheck(projectId, chapterId);

    // Verify
    expect(db.chapters.get).toHaveBeenCalledWith(chapterId);
    expect(intelligence.processManuscript).toHaveBeenCalledWith(chapterContent, chapterId);
    
    expect(memory.evolveBedsideNote).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(memory.evolveBedsideNote).mock.calls[0];
    expect(callArgs[0]).toBe(projectId);
    expect(callArgs[1]).toContain('Narrative drift detected');
    
    // Check strict structure mapping
    const options = callArgs[2];
    expect(options?.changeReason).toBe('narrative_alignment');
    expect(options?.structuredContent?.conflicts).toHaveLength(1);
    expect(options?.structuredContent?.conflicts?.[0].previous).toContain('slower pacing');
  });

  it('does nothing if no drift detected', async () => {
    vi.mocked(db.chapters.get).mockResolvedValue({
      id: chapterId,
      content: chapterContent,
    } as any);

    vi.mocked(memory.getOrCreateBedsideNote).mockResolvedValue({
        id: 'note-1',
        text: 'Plan',
        structuredContent: {
          activeGoals: [{ title: 'Write an action scene', status: 'active' }],
        } as BedsideNoteContent,
    } as any);

    // Aligned intelligence
    vi.mocked(intelligence.processManuscript).mockReturnValue({
      structural: {
        stats: { avgTension: 0.9 }, // High tension aligns with 'action scene'
      },
      entities: { nodes: [] },
      timeline: { promises: [] },
    } as any);

    await runNarrativeAlignmentCheck(projectId, chapterId);

    expect(memory.evolveBedsideNote).not.toHaveBeenCalled();
  });

  it('handles missing chapter gracefully', async () => {
    vi.mocked(db.chapters.get).mockResolvedValue(undefined);
    await runNarrativeAlignmentCheck(projectId, chapterId);
    expect(memory.evolveBedsideNote).not.toHaveBeenCalled();
  });
});
