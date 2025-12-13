import React from 'react';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';

export const AutomatedThinkingToggle: React.FC = () => {
  const enabled = useSettingsStore(state => state.automatedThinkingEnabled);
  const setEnabled = useSettingsStore(state => state.setAutomatedThinkingEnabled);

  return (
    <div className="px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Automated Thinking</p>
          <p className="text-[var(--text-xs)] text-[var(--text-tertiary)]">
            AI-driven analysis + suggestions run in the background once enabled.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
          aria-label="Toggle automated thinking"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--interactive-accent)] ${
            enabled ? 'bg-[var(--interactive-accent)]' : 'bg-[var(--surface-primary)]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
        Disabled by default to avoid automated API calls. Manually opt in when you want proactive suggestions.
      </p>
    </div>
  );
};

export default AutomatedThinkingToggle;
