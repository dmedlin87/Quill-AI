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
});
