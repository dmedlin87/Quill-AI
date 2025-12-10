import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { feedbackTracker } from '@/services/appBrain/feedbackTracker';
import { eventBus } from '@/services/appBrain/eventBus';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { SuggestionCategory, DEFAULT_SUGGESTION_WEIGHTS } from '@/types/experienceSettings';

describe('FeedbackTracker', () => {
  beforeEach(() => {
    // Reset store
    useSettingsStore.setState({
      suggestionWeights: { ...DEFAULT_SUGGESTION_WEIGHTS },
    });
    feedbackTracker.start();
  });

  afterEach(() => {
    feedbackTracker.stop();
  });

  it('decreases weight on dismiss', () => {
    const category: SuggestionCategory = 'pacing';
    const initialWeight = useSettingsStore.getState().suggestionWeights[category];

    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'test-1',
        action: 'dismissed',
        suggestionCategory: category,
      },
    });

    const newWeight = useSettingsStore.getState().suggestionWeights[category];
    expect(newWeight).toBeLessThan(initialWeight);
    expect(newWeight).toBeCloseTo(initialWeight * 0.95, 3);
  });

  it('increases weight on apply', () => {
    const category: SuggestionCategory = 'lore_discovery';
    const initialWeight = useSettingsStore.getState().suggestionWeights[category];

    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'test-2',
        action: 'applied',
        suggestionCategory: category,
      },
    });

    const newWeight = useSettingsStore.getState().suggestionWeights[category];
    expect(newWeight).toBeGreaterThan(initialWeight);
    expect(newWeight).toBeCloseTo(initialWeight * 1.05, 3);
  });

  it('mutes weight on muted action', () => {
    const category: SuggestionCategory = 'style';

    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'test-3',
        action: 'muted',
        suggestionCategory: category,
      },
    });

    const newWeight = useSettingsStore.getState().suggestionWeights[category];
    expect(newWeight).toBe(0);
  });

  it('clamps weight to reasonable bounds', () => {
    const category: SuggestionCategory = 'plot';
    useSettingsStore.setState({
      suggestionWeights: { ...DEFAULT_SUGGESTION_WEIGHTS, [category]: 1.95 },
    });

    // Boost it over 2.0
    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'test-4',
        action: 'applied',
        suggestionCategory: category,
      },
    });

    let newWeight = useSettingsStore.getState().suggestionWeights[category];
    expect(newWeight).toBe(2.0);

    // Decay it under 0.1
    useSettingsStore.setState({
        suggestionWeights: { ...DEFAULT_SUGGESTION_WEIGHTS, [category]: 0.101 },
      });

    eventBus.emit({
        type: 'PROACTIVE_SUGGESTION_ACTION',
        payload: {
          suggestionId: 'test-5',
          action: 'dismissed',
          suggestionCategory: category,
        },
      });

    newWeight = useSettingsStore.getState().suggestionWeights[category];
    // 0.101 * 0.95 = 0.09595 -> clamped to 0.1
    expect(newWeight).toBe(0.1);
  });

  it('handles categories without an existing weight entry', () => {
    // Use a category key that is not present in DEFAULT_SUGGESTION_WEIGHTS
    const missingCategory = 'experimental' as SuggestionCategory;

    // Ensure the store has no explicit weight for this key
    useSettingsStore.setState({
      suggestionWeights: { ...DEFAULT_SUGGESTION_WEIGHTS },
    });

    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'test-missing',
        action: 'dismissed',
        suggestionCategory: missingCategory,
      },
    });

    const newWeight = useSettingsStore.getState().suggestionWeights[missingCategory];
    // Should start from the implicit default 1.0 and apply decay
    expect(newWeight).toBeCloseTo(1 * 0.95, 3);
  });
});
