import { describe, it, expect, vi } from 'vitest';
import {
  buildAdaptiveContext,
  DEFAULT_BUDGET,
  VOICE_MODE_BUDGET,
  EDITING_BUDGET,
  DEEP_ANALYSIS_BUDGET,
  estimateTokens,
  selectContextProfile,
  getContextBudgetForModel,
  PROFILE_ALLOCATIONS,
} from '@/services/appBrain/adaptiveContext';
import { eventBus } from '@/services/appBrain/eventBus';

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    formatRecentEventsForAI: vi.fn(() => 'Events...'),
  },
}));

describe('adaptiveContext', () => {
  const baseState: any = {
    manuscript: {
      projectTitle: 'Novel',
      chapters: [
        { id: 'c1', title: 'One', content: 'abc', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'xyz', order: 1, updatedAt: 0 },
      ],
      activeChapterId: 'c1',
      currentText: 'Hello world around cursor',
      setting: { timePeriod: 'Now', location: 'Here' },
    },
    ui: {
      cursor: { position: 6 },
      selection: { text: 'Hello', start: 0, end: 5 },
      microphone: { status: 'idle', mode: 'voice', lastTranscript: null, error: null },
    },
    intelligence: {
      hud: {
        situational: {
          tensionLevel: 'medium',
          pacing: 'steady',
          narrativePosition: { percentComplete: 50 },
          currentScene: { type: 'intro' },
          currentParagraph: { type: 'body' },
        },
        context: { activeEntities: [] },
        prioritizedIssues: [],
        styleAlerts: [],
        stats: { wordCount: 1000, sentenceCount: 100, paragraphCount: 10 },
      },
      timeline: null,
    },
    analysis: { result: null },
    lore: { characters: [], worldRules: [], manuscriptIndex: null },
    session: { chatHistory: [] },
  };

  describe('buildAdaptiveContext', () => {
    it('prefers voice budget when mode provided and tracks inclusions', async () => {
      const result = await buildAdaptiveContext(baseState, 'p1', { budget: VOICE_MODE_BUDGET });

      expect(result.budget.totalTokens).toBeLessThan(DEFAULT_BUDGET.totalTokens);
      expect(result.sectionsIncluded).toContain('manuscript');
    });

    it('truncates sections when exceeding budget', async () => {
      const tinyBudget = { ...DEFAULT_BUDGET, totalTokens: 100 };
      const largeState = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          currentText: 'lorem '.repeat(500),
        },
      };

      const result = await buildAdaptiveContext(largeState, 'p1', { budget: tinyBudget });

      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeLessThanOrEqual(tinyBudget.totalTokens + 100);
    });

    it('uses default budget when no options provided', async () => {
      const result = await buildAdaptiveContext(baseState, 'p1');

      expect(result.budget.totalTokens).toBe(DEFAULT_BUDGET.totalTokens);
    });
  });

  describe('estimateTokens', () => {
    it('estimates tokens by character count', () => {
      expect(estimateTokens('12345678')).toBe(2);
    });

    it('handles empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('selectContextProfile', () => {
    it('returns voice profile for voice mode', () => {
      expect(selectContextProfile({ mode: 'voice', hasSelection: false })).toBe('voice');
      expect(selectContextProfile({ mode: 'voice', hasSelection: true })).toBe('voice');
    });

    it('returns analysis_deep for analysis queryType', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'analysis' })).toBe('analysis_deep');
    });

    it('returns editing for editing queryType or selection', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: true })).toBe('editing');
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'editing' })).toBe('editing');
    });

    it('returns full for general text mode without selection', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: false })).toBe('full');
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'general' })).toBe('full');
    });
  });

  describe('getContextBudgetForModel', () => {
    it('returns budget with appropriate total tokens', () => {
      const budget = getContextBudgetForModel('agent', 'full');

      expect(budget.totalTokens).toBeGreaterThan(0);
      expect(budget.totalTokens).toBeLessThanOrEqual(16000); // maxBudget default
    });

    it('uses profile allocations', () => {
      const editingBudget = getContextBudgetForModel('agent', 'editing');
      const voiceBudget = getContextBudgetForModel('agent', 'voice');

      expect(editingBudget.sections).toEqual(PROFILE_ALLOCATIONS.editing);
      expect(voiceBudget.sections).toEqual(PROFILE_ALLOCATIONS.voice);
    });

    it('respects maxBudget option', () => {
      const budget = getContextBudgetForModel('agent', 'full', { maxBudget: 5000 });

      expect(budget.totalTokens).toBeLessThanOrEqual(5000);
    });

    it('respects reserveForResponse option', () => {
      const normalBudget = getContextBudgetForModel('agent', 'full');
      const largeReserveBudget = getContextBudgetForModel('agent', 'full', { reserveForResponse: 10000 });

      // Larger reserve should result in smaller available budget
      expect(largeReserveBudget.totalTokens).toBeLessThanOrEqual(normalBudget.totalTokens);
    });
  });

  describe('PROFILE_ALLOCATIONS', () => {
    it('has all expected profiles', () => {
      expect(PROFILE_ALLOCATIONS).toHaveProperty('full');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('editing');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('voice');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('analysis_deep');
    });

    it('all profiles sum to ~1.0', () => {
      for (const [profile, sections] of Object.entries(PROFILE_ALLOCATIONS)) {
        const sum = Object.values(sections).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });
  });
});
