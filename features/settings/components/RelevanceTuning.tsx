import React from 'react';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { SuggestionCategory } from '@/types/experienceSettings';

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  plot: 'Plot Suggestions',
  character: 'Character Notes',
  pacing: 'Pacing Advice',
  style: 'Style & Tone',
  continuity: 'Continuity Checks',
  lore_discovery: 'Lore Discovery',
  timeline_conflict: 'Timeline Conflicts',
  voice_inconsistency: 'Voice Consistency',
  watched_entity: 'Watched Entities',
  active_goal: 'Active Goals',
  reminder: 'Reminders',
  other: 'Other Suggestions',
};

export const RelevanceTuning: React.FC = () => {
  const { suggestionWeights, updateSuggestionWeight, resetSuggestionWeights } = useSettingsStore();

  const handleSliderChange = (category: SuggestionCategory, value: number) => {
    updateSuggestionWeight(category, value);
  };

  const categories = Object.keys(suggestionWeights) as SuggestionCategory[];

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Adaptive Relevance Tuning</h3>
        <button
          onClick={resetSuggestionWeights}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Reset to Defaults
        </button>
      </div>

      <p className="text-xs text-gray-500">
        The system learns from your interactions. You can manually fine-tune the frequency of specific suggestion types below.
        (1.0 = Default, 0 = Muted)
      </p>

      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category} className="flex items-center gap-3">
            <span className="text-xs text-gray-700 w-32 truncate" title={CATEGORY_LABELS[category] || category}>
              {CATEGORY_LABELS[category] || category}
            </span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={suggestionWeights[category] ?? 1.0}
              onChange={(e) => handleSliderChange(category, parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {(suggestionWeights[category] ?? 1.0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
