import { describe, it, expect } from 'vitest';
import {
  BedsideNoteMutationSchema,
  parseBedsideNoteMutation,
} from '@/services/memory/bedside/schema';

describe('BedsideNoteMutationSchema', () => {
  describe('currentFocus section', () => {
    it('parses valid currentFocus mutation', () => {
      const input = {
        section: 'currentFocus',
        action: 'set',
        content: 'Working on chapter 5',
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.section).toBe('currentFocus');
      expect(result.action).toBe('set');
      expect(result.content).toBe('Working on chapter 5');
    });

    it('trims content whitespace', () => {
      const input = {
        section: 'currentFocus',
        action: 'set',
        content: '  trimmed  ',
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toBe('trimmed');
    });
  });

  describe('list sections', () => {
    it('parses warnings section', () => {
      const input = {
        section: 'warnings',
        action: 'append',
        content: 'Character timeline issue',
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.section).toBe('warnings');
      expect(result.content).toEqual(['Character timeline issue']);
    });

    it('parses array of strings', () => {
      const input = {
        section: 'nextSteps',
        action: 'set',
        content: ['Step 1', 'Step 2'],
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toEqual(['Step 1', 'Step 2']);
    });

    it('filters empty strings from array', () => {
      const input = {
        section: 'openQuestions',
        action: 'set',
        content: ['Valid', '', '  ', 'Also valid'],
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toEqual(['Valid', 'Also valid']);
    });

    it('rejects empty content array', () => {
      const input = {
        section: 'recentDiscoveries',
        action: 'set',
        content: [],
      };
      
      expect(() => BedsideNoteMutationSchema.parse(input)).toThrow();
    });
  });

  describe('activeGoals section', () => {
    it('parses goal object', () => {
      const input = {
        section: 'activeGoals',
        action: 'append',
        content: { title: 'Finish draft', progress: 50 },
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toEqual([{ title: 'Finish draft', progress: 50 }]);
    });

    it('parses goal string as title', () => {
      const input = {
        section: 'activeGoals',
        action: 'set',
        content: 'New goal title',
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toEqual([{ title: 'New goal title' }]);
    });

    it('parses array of goals', () => {
      const input = {
        section: 'activeGoals',
        action: 'set',
        content: [
          { title: 'Goal 1', status: 'active' },
          { title: 'Goal 2', status: 'completed' },
        ],
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      
      expect(result.content).toHaveLength(2);
    });

    it('validates goal progress range', () => {
      const input = {
        section: 'activeGoals',
        action: 'set',
        content: { title: 'Test', progress: 150 },
      };
      
      expect(() => BedsideNoteMutationSchema.parse(input)).toThrow();
    });

    it('accepts goal with all optional fields', () => {
      const input = {
        section: 'activeGoals',
        action: 'set',
        content: {
          title: 'Complete goal',
          progress: 75,
          status: 'active',
          note: 'In progress',
          updatedAt: Date.now(),
        },
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      const goal = result.content[0] as { status?: string; note?: string };
      expect(goal.status).toBe('active');
      expect(goal.note).toBe('In progress');
    });

    it('accepts goal with only required title', () => {
      const input = {
        section: 'activeGoals',
        action: 'set',
        content: { title: 'Minimal goal' },
      };
      
      const result = BedsideNoteMutationSchema.parse(input);
      const goal = result.content[0] as { title: string; progress?: number };
      expect(goal.title).toBe('Minimal goal');
      expect(goal.progress).toBeUndefined();
    });
  });

  describe('action types', () => {
    it('accepts set action', () => {
      const input = { section: 'currentFocus', action: 'set', content: 'test' };
      expect(() => BedsideNoteMutationSchema.parse(input)).not.toThrow();
    });

    it('accepts append action', () => {
      const input = { section: 'warnings', action: 'append', content: 'test' };
      expect(() => BedsideNoteMutationSchema.parse(input)).not.toThrow();
    });

    it('accepts remove action', () => {
      const input = { section: 'nextSteps', action: 'remove', content: 'test' };
      expect(() => BedsideNoteMutationSchema.parse(input)).not.toThrow();
    });

    it('rejects invalid action', () => {
      const input = { section: 'currentFocus', action: 'invalid', content: 'test' };
      expect(() => BedsideNoteMutationSchema.parse(input)).toThrow();
    });
  });
});

describe('parseBedsideNoteMutation', () => {
  it('returns parsed mutation', () => {
    const result = parseBedsideNoteMutation({
      section: 'currentFocus',
      action: 'set',
      content: 'Parsed content',
    });
    
    expect(result.content).toBe('Parsed content');
  });

  it('throws on invalid input', () => {
    expect(() =>
      parseBedsideNoteMutation({ section: 'invalid' as any, action: 'set', content: '' }),
    ).toThrow();
  });
});
