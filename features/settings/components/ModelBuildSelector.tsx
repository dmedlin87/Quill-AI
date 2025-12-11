import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore, ModelBuildKey } from '../store/useSettingsStore';
import { shallow } from 'zustand/shallow';
import { Card } from '@/features/shared/components/ui/Card';
import { Text } from '@/features/shared/components/ui/Typography';

interface ModelBuildSelectorProps {
  compact?: boolean;
  showLabels?: boolean;
}

interface ModelPreset {
  id: ModelBuildKey;
  label: string;
  description: string;
  icon: string;
}

const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'default',
    label: 'Normal',
    description: 'Pro models for analysis, Flash for chat. Best quality.',
    icon: '✨',
  },
  {
    id: 'cheap',
    label: 'Cheap',
    description: 'Flash models for everything. Fast & low cost.',
    icon: '⚡',
  },
];

interface PresetCardProps {
  preset: ModelPreset;
  isActive: boolean;
  onSelect: (id: ModelBuildKey) => void;
}

const PresetCard = ({ preset, isActive, onSelect }: PresetCardProps) => (
  <Card
    variant={isActive ? 'elevated' : 'flat'}
    padding="sm"
    className={`
      cursor-pointer transition-all group flex flex-col items-start justify-center min-h-[80px]
      ${isActive 
        ? 'ring-2 ring-[var(--interactive-accent)] bg-[var(--surface-primary)]' 
        : 'hover:border-[var(--border-secondary)] hover:bg-[var(--surface-secondary)]'
      }
    `}
    onClick={() => onSelect(preset.id)}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(preset.id);
      }
    }}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xl">{preset.icon}</span>
      <Text variant="label" className={isActive ? 'text-[var(--interactive-accent)]' : ''}>
        {preset.label}
      </Text>
    </div>
    <Text variant="muted" className="text-xs">
      {preset.description}
    </Text>
  </Card>
);

const CompactPresetPills = ({ 
  presets, 
  activeId, 
  onSelect 
}: { 
  presets: ModelPreset[]; 
  activeId: ModelBuildKey; 
  onSelect: (id: ModelBuildKey) => void 
}) => (
  <div className="flex items-center gap-1 bg-[var(--surface-secondary)] rounded-lg p-1 border border-[var(--border-subtle)]">
    {presets.map((preset) => {
      const isActive = activeId === preset.id;
      return (
        <button
          key={preset.id}
          onClick={() => onSelect(preset.id)}
          className={`
            relative px-3 py-1.5 rounded text-xs font-medium transition-all
            ${isActive ? 'text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
          `}
          title={`${preset.label}: ${preset.description}`}
        >
          {isActive && (
            <motion.div
              layoutId="model-build-pill"
              className="absolute inset-0 rounded bg-[var(--interactive-accent)]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
            <span>{preset.icon}</span>
            <span>{preset.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

export function ModelBuildSelector({
  compact = false,
  showLabels = true,
}: ModelBuildSelectorProps) {
  const { modelBuild, setModelBuild } = useSettingsStore(
    (state) => ({
      modelBuild: state.modelBuild,
      setModelBuild: state.setModelBuild,
    }),
    shallow,
  );

  const handleSelect = useCallback(
    (id: ModelBuildKey) => setModelBuild(id),
    [setModelBuild],
  );

  if (compact) {
    return (
      <CompactPresetPills
        presets={MODEL_PRESETS}
        activeId={modelBuild}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <div className="space-y-3">
      {showLabels && (
        <div>
          <Text variant="label">AI Model Mode</Text>
          <Text variant="muted" className="mt-0.5">
            Choose quality vs cost tradeoff
          </Text>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {MODEL_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isActive={modelBuild === preset.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Compact badge showing current model mode - for use in headers
 */
export function ModelBuildBadge({ className = '' }: { className?: string }) {
  const modelBuild = useSettingsStore((state) => state.modelBuild);
  const preset = MODEL_PRESETS.find((p) => p.id === modelBuild) || MODEL_PRESETS[0];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border border-transparent ${className}`}
      style={{
        backgroundColor: 'var(--surface-secondary)',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-subtle)',
      }}
      title={`Model Mode: ${preset.label} - ${preset.description}`}
    >
      {preset.icon} {preset.label}
    </span>
  );
}
