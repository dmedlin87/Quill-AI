import { describe, it, expect } from 'vitest';
import { checkNarrativeDrift } from '@/services/appBrain/driftDetector';
import { ManuscriptIntelligence } from '@/types/intelligence';
import { BedsideNoteContent } from '@/services/memory/types';

describe('driftDetector', () => {
  const mockIntelligence = (overrides: Partial<ManuscriptIntelligence> = {}): ManuscriptIntelligence => ({
    structural: {
      stats: {
        avgTension: 0.5,
      },
    },
    entities: {
      nodes: [],
    },
    timeline: {
      promises: [],
    },
    ...overrides,
  } as unknown as ManuscriptIntelligence);

  it('detects high tension when plan implies slow pacing', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.9 } } as any
    });
    
    const plan: BedsideNoteContent = {
      currentFocus: 'Introspection and calm reflection',
      activeGoals: [],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].previous).toContain('slower pacing');
    expect(conflicts[0].current).toContain('high (90%)');
  });

  it('detects low tension when plan implies fast action', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.1 } } as any
    });
    
    const plan: BedsideNoteContent = {
      activeGoals: [{ title: 'Write an intense action scene', status: 'active', progress: 0 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].previous).toContain('fast pacing');
    expect(conflicts[0].current).toContain('low (10%)');
  });

  it('detects stale goals when proposal is resolved in manuscript', () => {
    const intelligence = mockIntelligence({
      timeline: {
        promises: [
          { description: 'Find the lost key', resolved: true } as any
        ],
      } as any
    });

    const plan: BedsideNoteContent = {
      activeGoals: [{ title: 'Find the lost key', status: 'active', progress: 50 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].previous).toContain('Goal "Find the lost key" is active');
    expect(conflicts[0].current).toContain('resolved promise');
  });

  it('processes character lookups across aliases and skips other node types', () => {
    const intelligence = mockIntelligence({
      entities: {
        nodes: [
          {
            id: 'n1',
            name: 'Marcus',
            type: 'character',
            aliases: ['the old man'],
            firstMention: 0,
            mentionCount: 3,
            mentions: [],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'Talia',
            type: 'character',
            aliases: [],
            firstMention: 5,
            mentionCount: 2,
            mentions: [],
            attributes: {},
          },
          {
            id: 'n3',
            name: 'The Keep',
            type: 'location',
            aliases: ['keep'],
            firstMention: 10,
            mentionCount: 1,
            mentions: [],
            attributes: {},
          },
        ],
      } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [
        { title: 'Guide Talia through training', status: 'active', progress: 40 },
        { title: 'Introduce the old man to the scouts', status: 'active', progress: 10 },
      ],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty array when aligned', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.8 } } as any
    });
    
    const plan: BedsideNoteContent = {
      currentFocus: 'High stakes battle', // implies fast/high
      activeGoals: [],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag drift when tension is just below the high threshold for slow intent', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.69 } } as any,
    });

    const plan: BedsideNoteContent = {
      currentFocus: 'quiet, introspection and calm', // implies slow
      activeGoals: [],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag drift when tension is just above the low threshold for fast intent', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.31 } } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [
        { title: 'Fast action chase sequence', status: 'active', progress: 0 },
      ],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty array when plan has no currentFocus and no activeGoals', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.99 } } as any,
      timeline: { promises: [{ description: 'Anything', resolved: true } as any] } as any,
    });

    const plan: BedsideNoteContent = {};
    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('skips non-active goals when checking for stale goals', () => {
    const intelligence = mockIntelligence({
      timeline: {
        promises: [{ description: 'Find the lost key', resolved: true } as any],
      } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [{ title: 'Find the lost key', status: 'completed', progress: 100 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag stale goals when promise is not resolved', () => {
    const intelligence = mockIntelligence({
      timeline: {
        promises: [{ description: 'Find the lost key', resolved: false } as any],
      } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [{ title: 'Find the lost key', status: 'active', progress: 50 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('flags stale goals when promise description includes the goal title', () => {
    const intelligence = mockIntelligence({
      timeline: {
        promises: [{ description: 'Find the lost key beneath the altar', resolved: true } as any],
      } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [{ title: 'lost key', status: 'active', progress: 0 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].current).toContain('resolved promise');
  });

  it('treats intent as both slow and fast when both keyword sets appear, but does not flag at mid tension', () => {
    const intelligence = mockIntelligence({
      structural: { stats: { avgTension: 0.5 } } as any,
    });

    const plan: BedsideNoteContent = {
      currentFocus: 'quiet calm before the fight',
      activeGoals: [],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });

  it('handles character nodes with undefined aliases and still matches by name', () => {
    const intelligence = mockIntelligence({
      entities: {
        nodes: [
          {
            id: 'n1',
            name: 'Seth',
            type: 'character',
            firstMention: 0,
            mentionCount: 1,
            mentions: [],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'Tower',
            type: 'location',
            aliases: ['tower'],
            firstMention: 0,
            mentionCount: 1,
            mentions: [],
            attributes: {},
          },
        ],
      } as any,
    });

    const plan: BedsideNoteContent = {
      activeGoals: [{ title: "Develop Seth's backstory", status: 'active', progress: 0 }],
    };

    const conflicts = checkNarrativeDrift(intelligence, plan);
    expect(conflicts).toHaveLength(0);
  });
});
