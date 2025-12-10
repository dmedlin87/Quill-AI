import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

interface DeveloperModeToggleProps {
  className?: string;
}

export const DeveloperModeToggle: React.FC<DeveloperModeToggleProps> = ({ className }) => {
  const developerModeEnabled = useSettingsStore((state) => state.developerModeEnabled);
  const setDeveloperModeEnabled = useSettingsStore((state) => state.setDeveloperModeEnabled);

  return (
    <label
      className={`flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none ${
        className ?? ''
      }`}
    >
      <input
        type="checkbox"
        checked={developerModeEnabled}
        onChange={(e) => setDeveloperModeEnabled(e.target.checked)}
        className="form-checkbox h-4 w-4 text-indigo-600"
      />
      <span className="flex items-center gap-1">
        <span>Developer Mode</span>
        <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-tertiary)]">
          Debug
        </span>
      </span>
    </label>
  );
};
