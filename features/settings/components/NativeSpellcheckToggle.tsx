import React, { useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

interface NativeSpellcheckToggleProps {
  className?: string;
}

export const NativeSpellcheckToggle = ({ className = '' }: NativeSpellcheckToggleProps) => {
  const nativeSpellcheckEnabled = useSettingsStore((state) => state.nativeSpellcheckEnabled);
  const setNativeSpellcheckEnabled = useSettingsStore((state) => state.setNativeSpellcheckEnabled);

  const handleToggle = useCallback(() => {
    setNativeSpellcheckEnabled(!nativeSpellcheckEnabled);
  }, [nativeSpellcheckEnabled, setNativeSpellcheckEnabled]);

  const variantClasses = nativeSpellcheckEnabled
    ? 'bg-[var(--interactive-bg-active)] border-[var(--interactive-accent)] text-[var(--interactive-accent)]'
    : 'bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--interactive-accent)]';

  return (
    <button
      type="button"
      aria-pressed={nativeSpellcheckEnabled}
      onClick={handleToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[var(--text-sm)] transition-colors shadow-sm ${variantClasses} ${className}`}
      title="Toggle browser spellcheck, autocorrect, and autocomplete"
    >
      <span className="text-base" aria-hidden="true">
        {nativeSpellcheckEnabled ? '✅' : '🚫'}
      </span>
      <span className="font-medium">Native Spellcheck</span>
    </button>
  );
};

