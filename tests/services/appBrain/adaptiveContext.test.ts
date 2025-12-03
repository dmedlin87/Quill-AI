import { describe, it, expect, vi } from 'vitest';
import {
  buildAdaptiveContext,
  DEFAULT_BUDGET,
  VOICE_MODE_BUDGET,
  estimateTokens,
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

  it('prefers voice budget when mode provided and tracks inclusions', async () => {
    const result = await buildAdaptiveContext(baseState, 'p1', VOICE_MODE_BUDGET);

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

    const result = await buildAdaptiveContext(largeState, 'p1', tinyBudget);

    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.tokenCount).toBeLessThanOrEqual(tinyBudget.totalTokens + 100);
  });

  it('estimates tokens by character count', () => {
    expect(estimateTokens('12345678')).toBe(2);
  });
});
