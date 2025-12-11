import { useState, useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { shallow } from 'zustand/shallow';
import { Text } from '@/features/shared/components/ui/Typography';
import { Input } from '@/features/shared/components/ui/Input';
import { Button } from '@/features/shared/components/ui/Button';

interface ApiKeyInputProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  isActive?: boolean;
}

const ApiKeyInput = ({ label, description, value, onChange, isActive }: ApiKeyInputProps) => {
  const [showKey, setShowKey] = useState(false);
  const isConfigured = value.length > 20;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Text variant="label" className="flex items-center gap-2">
            {label}
            {isActive && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--feedback-success-bg)] text-[var(--feedback-success)]">
                ACTIVE
              </span>
            )}
          </Text>
          <Text variant="muted" className="text-xs">{description}</Text>
        </div>
        <div className="flex items-center gap-1">
          {isConfigured ? (
            <span className="text-[var(--feedback-success)] text-xs">✓ Configured</span>
          ) : (
            <span className="text-[var(--text-muted)] text-xs">Not set</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your API key..."
          className="flex-1 font-mono text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKey(!showKey)}
          title={showKey ? 'Hide key' : 'Show key'}
        >
          {showKey ? '🙈' : '👁️'}
        </Button>
      </div>
    </div>
  );
};

export function ApiKeyManager() {
  const { freeApiKey, paidApiKey, setFreeApiKey, setPaidApiKey } = useSettingsStore(
    (state) => ({
      freeApiKey: state.freeApiKey,
      paidApiKey: state.paidApiKey,
      setFreeApiKey: state.setFreeApiKey,
      setPaidApiKey: state.setPaidApiKey,
    }),
    shallow,
  );

  // Determine which key is active (free tier takes priority if configured)
  const freeKeyConfigured = freeApiKey.length > 20;
  const paidKeyConfigured = paidApiKey.length > 20;
  const activeTier = freeKeyConfigured ? 'free' : paidKeyConfigured ? 'paid' : null;

  const handleClearAll = useCallback(() => {
    setFreeApiKey('');
    setPaidApiKey('');
  }, [setFreeApiKey, setPaidApiKey]);

  return (
    <div className="space-y-4">
      <div>
        <Text variant="label">API Keys</Text>
        <Text variant="muted" className="mt-0.5">
          Configure your Gemini API keys. Free tier is used first, then falls back to paid.
        </Text>
      </div>

      {/* Active Mode Status Banner */}
      {activeTier && (
        <div className={`
          flex items-center justify-between p-3 rounded-lg border
          ${activeTier === 'free' 
            ? 'bg-[var(--feedback-success-bg)] border-[var(--feedback-success)] text-[var(--feedback-success)]' 
            : 'bg-[var(--feedback-warning-bg)] border-[var(--feedback-warning)] text-[var(--feedback-warning)]'
          }
        `}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{activeTier === 'free' ? '🆓' : '💳'}</span>
            <div>
              <Text variant="label" className={activeTier === 'free' ? 'text-[var(--feedback-success)]' : 'text-[var(--feedback-warning)]'}>
                {activeTier === 'free' ? 'Free Mode' : 'Paid Mode'}
              </Text>
              <Text variant="muted" className="text-xs">
                {activeTier === 'free' 
                  ? 'Using free tier API key' 
                  : 'Using paid tier API key'
                }
              </Text>
            </div>
          </div>
          <span className={`
            px-2 py-1 text-xs font-bold rounded-full
            ${activeTier === 'free' 
              ? 'bg-[var(--feedback-success)] text-white' 
              : 'bg-[var(--feedback-warning)] text-white'
            }
          `}>
            {activeTier === 'free' ? 'FREE' : 'PAID'}
          </span>
        </div>
      )}

      {!activeTier && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-[var(--surface-tertiary)] border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <Text variant="label">No API Key Configured</Text>
              <Text variant="muted" className="text-xs">
                Add an API key below to enable AI features
              </Text>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
        <ApiKeyInput
          label="Free Tier Key"
          description="Your free quota API key (used first)"
          value={freeApiKey}
          onChange={setFreeApiKey}
          isActive={activeTier === 'free'}
        />

        <div className="border-t border-[var(--border-subtle)]" />

        <ApiKeyInput
          label="Paid Tier Key"
          description="Fallback when free quota is exhausted"
          value={paidApiKey}
          onChange={setPaidApiKey}
          isActive={activeTier === 'paid'}
        />
      </div>

      {(freeKeyConfigured || paidKeyConfigured) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            Clear All Keys
          </Button>
        </div>
      )}

      <div className="p-3 rounded-lg bg-[var(--surface-tertiary)] border border-[var(--border-subtle)]">
        <Text variant="muted" className="text-xs">
          💡 <strong>Tip:</strong> Get your API key from{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--interactive-accent)] hover:underline"
          >
            Google AI Studio
          </a>
          . Keys are stored locally in your browser.
        </Text>
      </div>
    </div>
  );
}
