import React, { useState, useEffect } from 'react';
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

interface WeightInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}

const WeightInput: React.FC<WeightInputProps> = ({ value, min, max, onChange, label }) => {
  const [localValue, setLocalValue] = useState(value.toFixed(2));

  // Sync with external changes (e.g. slider)
  useEffect(() => {
    // Only update if the value is significantly different to avoid fighting cursor
    // But since we only commit on blur, prop shouldn't change while typing unless slider moves.
    // If slider moves, we want to update.
    setLocalValue(value.toFixed(2));
  }, [value]);

  const handleBlur = () => {
    let floatVal = parseFloat(localValue);
    if (isNaN(floatVal)) {
      floatVal = value; // Revert to current prop value
    } else {
      floatVal = Math.min(Math.max(floatVal, min), max); // Clamp
    }

    // Update parent/store
    onChange(floatVal);
    // Format local display
    setLocalValue(floatVal.toFixed(2));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step="0.1"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="text-xs text-gray-500 w-12 text-right border rounded p-1"
      aria-label={`${label} weight`}
    />
  );
};

export const RelevanceTuning: React.FC = () => {
  const { suggestionWeights, updateSuggestionWeight, resetSuggestionWeights } = useSettingsStore();

  const handleSliderChange = (category: SuggestionCategory, value: number) => {
    updateSuggestionWeight(category, value);
  };

  const handleInputChange = (category: SuggestionCategory, value: number) => {
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
            <WeightInput
              value={suggestionWeights[category] ?? 1.0}
              min={0}
              max={2}
              onChange={(val) => handleInputChange(category, val)}
              label={CATEGORY_LABELS[category] || category}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
