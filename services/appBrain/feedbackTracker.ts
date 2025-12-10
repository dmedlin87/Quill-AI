import { eventBus } from './eventBus';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { SuggestionCategory } from '@/types/experienceSettings';

/**
 * Feedback Tracker Service
 *
 * Listens to user interactions with proactive suggestions (Apply, Dismiss, Mute)
 * and adjusts the relevance weights for future suggestions.
 */

// Weight adjustment factors
const DISMISS_DECAY = 0.95; // Reduce weight by 5%
const APPLY_BOOST = 1.05;   // Increase weight by 5%
const MUTE_WEIGHT = 0;      // Hard mute

export class FeedbackTracker {
  private unsubscribe: (() => void) | null = null;

  start() {
    this.unsubscribe = eventBus.subscribe('PROACTIVE_SUGGESTION_ACTION', (event) => {
      if (event.type !== 'PROACTIVE_SUGGESTION_ACTION') return;

      const { action, suggestionCategory } = event.payload;
      this.handleFeedback(action, suggestionCategory);
    });
    console.log('[FeedbackTracker] Started');
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    console.log('[FeedbackTracker] Stopped');
  }

  private handleFeedback(action: 'applied' | 'dismissed' | 'muted', category: SuggestionCategory) {
    const store = useSettingsStore.getState();
    const currentWeight = store.suggestionWeights[category] ?? 1.0;

    let newWeight = currentWeight;

    switch (action) {
      case 'dismissed':
        newWeight = currentWeight * DISMISS_DECAY;
        break;
      case 'applied':
        newWeight = currentWeight * APPLY_BOOST;
        break;
      case 'muted':
        newWeight = MUTE_WEIGHT;
        break;
    }

    // Ensure weight doesn't grow indefinitely or become negative (though multiplication keeps it positive)
    // Cap at 2.0 (200%) and min 0.1 (10%) unless muted
    if (newWeight !== MUTE_WEIGHT) {
      newWeight = Math.max(0.1, Math.min(2.0, newWeight));
    }

    // Round to 3 decimal places for cleanliness
    newWeight = Math.round(newWeight * 1000) / 1000;

    console.log(`[FeedbackTracker] Adjusted weight for ${category}: ${currentWeight} -> ${newWeight} (${action})`);

    store.updateSuggestionWeight(category, newWeight);
  }
}

export const feedbackTracker = new FeedbackTracker();
