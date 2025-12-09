import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyBedsideNoteMutationLocally, applyBedsideNoteMutation } from '@/services/memory/bedsideNoteMutations';
import { BedsideNoteContent, BedsideNoteGoalSummary } from '@/services/memory';

const chainsMocks = vi.hoisted(() => ({
  getOrCreateBedsideNote: vi.fn(),
  evolveBedsideNote: vi.fn(),
}));

vi.mock('@/services/memory/chains', () => ({
  getOrCreateBedsideNote: (...args: any[]) => chainsMocks.getOrCreateBedsideNote(...args),
  evolveBedsideNote: (...args: any[]) => chainsMocks.evolveBedsideNote(...args),
}));

describe('applyBedsideNoteMutationLocally', () => {
  describe('currentFocus section', () => {
    it('sets and replaces bedside-note currentFocus', () => {
      const base: BedsideNoteContent = {
        currentFocus: 'Old focus',
        warnings: ['keep track of names'],
      };

      const { nextContent, text } = applyBedsideNoteMutationLocally(base, {
        section: 'currentFocus',
        action: 'set',
        content: 'New focus',
      });

      expect(nextContent.currentFocus).toBe('New focus');
      expect(text).toContain('New focus');
    });

    it('appends to currentFocus when it exists', () => {
      const base: BedsideNoteContent = {
        currentFocus: 'Initial focus',
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'currentFocus',
        action: 'append',
        content: 'Additional focus',
      });

      expect(nextContent.currentFocus).toBe('Initial focus\nAdditional focus');
    });

    it('sets currentFocus on append when empty', () => {
      const base: BedsideNoteContent = {};

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'currentFocus',
        action: 'append',
        content: 'New focus',
      });

      expect(nextContent.currentFocus).toBe('New focus');
    });

    it('removes currentFocus when content matches', () => {
      const base: BedsideNoteContent = {
        currentFocus: 'Remove me',
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'currentFocus',
        action: 'remove',
        content: 'Remove me',
      });

      expect(nextContent.currentFocus).toBeUndefined();
    });

    it('keeps currentFocus when remove content does not match', () => {
      const base: BedsideNoteContent = {
        currentFocus: 'Keep me',
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'currentFocus',
        action: 'remove',
        content: 'Something else',
      });

      expect(nextContent.currentFocus).toBe('Keep me');
    });
  });

  describe('list sections (warnings, nextSteps, openQuestions, recentDiscoveries)', () => {
    it('appends new list items without duplicates', () => {
      const base: BedsideNoteContent = {
        nextSteps: ['Revise opening'],
      };

      const { nextContent, text } = applyBedsideNoteMutationLocally(base, {
        section: 'nextSteps',
        action: 'append',
        content: ['Revise opening', 'Add motif'],
      });

      expect(nextContent.nextSteps).toEqual(['Revise opening', 'Add motif']);
      expect(text).toContain('Add motif');
    });

    it('removes items and cleans up empty arrays', () => {
      const base: BedsideNoteContent = {
        openQuestions: ['Where is the locket?'],
      };

      const { nextContent, text } = applyBedsideNoteMutationLocally(base, {
        section: 'openQuestions',
        action: 'remove',
        content: ['Where is the locket?'],
      });

      expect(nextContent.openQuestions).toBeUndefined();
      expect(text).not.toContain('locket');
    });

    it('sets warnings list completely', () => {
      const base: BedsideNoteContent = {
        warnings: ['old warning'],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'warnings',
        action: 'set',
        content: ['new warning 1', 'new warning 2'],
      });

      expect(nextContent.warnings).toEqual(['new warning 1', 'new warning 2']);
    });

    it('appends to warnings when empty', () => {
      const base: BedsideNoteContent = {};

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'warnings',
        action: 'append',
        content: ['first warning'],
      });

      expect(nextContent.warnings).toEqual(['first warning']);
    });

    it('removes specific items from recentDiscoveries', () => {
      const base: BedsideNoteContent = {
        recentDiscoveries: ['discovery 1', 'discovery 2', 'discovery 3'],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'recentDiscoveries',
        action: 'remove',
        content: ['discovery 2'],
      });

      expect(nextContent.recentDiscoveries).toEqual(['discovery 1', 'discovery 3']);
    });

    it('handles case-insensitive duplicate detection on append', () => {
      const base: BedsideNoteContent = {
        nextSteps: ['Do something'],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'nextSteps',
        action: 'append',
        content: ['DO SOMETHING', 'do another thing'],
      });

      // Should not duplicate "Do something" case-insensitively
      expect(nextContent.nextSteps).toEqual(['Do something', 'do another thing']);
    });

    it('handles case-insensitive removal', () => {
      const base: BedsideNoteContent = {
        openQuestions: ['Why is this happening?'],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'openQuestions',
        action: 'remove',
        content: ['WHY IS THIS HAPPENING?'],
      });

      expect(nextContent.openQuestions).toBeUndefined();
    });
  });

  describe('activeGoals section', () => {
    it('sets activeGoals completely', () => {
      const base: BedsideNoteContent = {
        activeGoals: [{ title: 'Old goal', status: 'active' }],
      };

      const newGoals: BedsideNoteGoalSummary[] = [
        { title: 'New goal 1', status: 'active' },
        { title: 'New goal 2', progress: 50 },
      ];

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'set',
        content: newGoals,
      });

      expect(nextContent.activeGoals).toEqual(newGoals);
    });

    it('appends activeGoals without duplicating by title', () => {
      const base: BedsideNoteContent = {
        activeGoals: [{ title: 'Existing goal', status: 'active' }],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'append',
        content: [
          { title: 'Existing goal', status: 'completed' }, // Should be skipped (same title)
          { title: 'New goal', progress: 25 },
        ],
      });

      expect(nextContent.activeGoals).toHaveLength(2);
      expect(nextContent.activeGoals?.[0].title).toBe('Existing goal');
      expect(nextContent.activeGoals?.[0].status).toBe('active'); // Original kept
      expect(nextContent.activeGoals?.[1].title).toBe('New goal');
    });

    it('removes activeGoals by title match', () => {
      const base: BedsideNoteContent = {
        activeGoals: [
          { title: 'Goal 1', status: 'active' },
          { title: 'Goal 2', progress: 50 },
          { title: 'Goal 3', status: 'completed' },
        ],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'remove',
        content: [{ title: 'Goal 2' }],
      });

      expect(nextContent.activeGoals).toHaveLength(2);
      expect(nextContent.activeGoals?.map(g => g.title)).toEqual(['Goal 1', 'Goal 3']);
    });

    it('removes activeGoals section when all goals removed', () => {
      const base: BedsideNoteContent = {
        activeGoals: [{ title: 'Only goal', status: 'active' }],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'remove',
        content: [{ title: 'Only goal' }],
      });

      expect(nextContent.activeGoals).toBeUndefined();
    });

    it('handles case-insensitive goal title matching', () => {
      const base: BedsideNoteContent = {
        activeGoals: [{ title: 'Important Goal', status: 'active' }],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'append',
        content: [{ title: 'IMPORTANT GOAL', status: 'completed' }], // Should be skipped
      });

      expect(nextContent.activeGoals).toHaveLength(1);
      expect(nextContent.activeGoals?.[0].status).toBe('active');
    });

    it('appends to empty activeGoals', () => {
      const base: BedsideNoteContent = {};

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'activeGoals',
        action: 'append',
        content: [{ title: 'First goal', status: 'active' }],
      });

      expect(nextContent.activeGoals).toEqual([{ title: 'First goal', status: 'active' }]);
    });
  });

  describe('edge cases', () => {
    it('preserves existing content when applying mutation to different section', () => {
      const base: BedsideNoteContent = {
        currentFocus: 'Test focus',
        warnings: ['existing warning'],
      };

      const { nextContent } = applyBedsideNoteMutationLocally(base, {
        section: 'nextSteps',
        action: 'append',
        content: ['new step'],
      });

      expect(nextContent.currentFocus).toBe('Test focus');
      expect(nextContent.warnings).toEqual(['existing warning']);
      expect(nextContent.nextSteps).toEqual(['new step']);
    });
  });
});

describe('applyBedsideNoteMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error when projectId is missing', async () => {
    await expect(
      applyBedsideNoteMutation('', {
        section: 'currentFocus',
        action: 'set',
        content: 'Test',
      })
    ).rejects.toThrow('projectId is required');
  });

  it('applies mutation and evolves bedside note', async () => {
    const existingNote = {
      id: 'note-1',
      text: 'Existing text',
      structuredContent: { currentFocus: 'Old focus' },
    };

    const evolvedNote = {
      id: 'note-2',
      text: 'Updated text',
      structuredContent: { currentFocus: 'New focus' },
    };

    chainsMocks.getOrCreateBedsideNote.mockResolvedValue(existingNote);
    chainsMocks.evolveBedsideNote.mockResolvedValue(evolvedNote);

    const result = await applyBedsideNoteMutation('project-1', {
      section: 'currentFocus',
      action: 'set',
      content: 'New focus',
    });

    expect(chainsMocks.getOrCreateBedsideNote).toHaveBeenCalledWith('project-1');
    expect(chainsMocks.evolveBedsideNote).toHaveBeenCalledWith(
      'project-1',
      expect.any(String),
      expect.objectContaining({
        changeReason: 'agent_set_currentFocus',
        structuredContent: expect.objectContaining({ currentFocus: 'New focus' }),
      })
    );
    expect(result).toBe(evolvedNote);
  });

  it('handles empty structuredContent in existing note', async () => {
    const existingNote = {
      id: 'note-1',
      text: 'Existing text',
      // No structuredContent
    };

    chainsMocks.getOrCreateBedsideNote.mockResolvedValue(existingNote);
    chainsMocks.evolveBedsideNote.mockResolvedValue(existingNote);

    await applyBedsideNoteMutation('project-1', {
      section: 'warnings',
      action: 'append',
      content: ['New warning'],
    });

    expect(chainsMocks.evolveBedsideNote).toHaveBeenCalledWith(
      'project-1',
      expect.any(String),
      expect.objectContaining({
        structuredContent: expect.objectContaining({ warnings: ['New warning'] }),
      })
    );
  });
});
