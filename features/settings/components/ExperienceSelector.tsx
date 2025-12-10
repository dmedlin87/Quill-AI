import { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  EXPERIENCE_PRESETS,
  AUTONOMY_PRESETS,
  type ExperienceLevel,
  type AutonomyMode,
} from '@/types/experienceSettings';
import { useSettingsStore } from '../store/useSettingsStore';
import { shallow } from 'zustand/shallow';
import { Card } from '@/features/shared/components/ui/Card';
import { Text } from '@/features/shared/components/ui/Typography';

interface ExperienceSelectorProps {
  compact?: boolean;
  showLabels?: boolean;
}

type PresetRecord<T extends string, V> = Record<T, V>;
const objectValues = <T extends string, V>(record: PresetRecord<T, V>): V[] =>
  Object.values(record);

const EXPERIENCE_LIST = objectValues(EXPERIENCE_PRESETS);
const AUTONOMY_LIST = objectValues(AUTONOMY_PRESETS);

type Preset = (typeof EXPERIENCE_LIST)[number] | (typeof AUTONOMY_LIST)[number];

interface PresetPillProps {
  presets: Preset[];
  activeId: string;
  onSelect: (id: string) => void;
  layoutId: string;
}

const CompactPresetPills = ({ presets, activeId, onSelect, layoutId }: PresetPillProps) => (
  <div className="flex items-center gap-1 bg-[var(--surface-secondary)] rounded-lg p-1 border border-[var(--border-subtle)]">
    {presets.map((preset) => {
      const isActive = activeId === preset.id;
      return (
        <button
          key={preset.id}
          onClick={() => onSelect(preset.id)}
          className={`
            relative px-2 py-1 rounded text-xs font-medium transition-all
            ${isActive ? 'text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
          `}
          title={`${preset.label}: ${preset.description}`}
        >
          {isActive && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded bg-[var(--interactive-accent)]"
              // style={{ backgroundColor: preset.color }} // Using theme accent instead of preset color for consistency
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
             {/* We can optionally tint the icon if not active, or keep it monochrome */}
             <span className={isActive ? 'text-[var(--text-inverse)]' : ''}>{preset.icon}</span>
          </span>
        </button>
      );
    })}
  </div>
);

interface PresetCardProps {
  preset: Preset;
  isActive: boolean;
  onSelect: (id: string) => void;
}

const PresetCard = ({ preset, isActive, onSelect }: PresetCardProps) => (
  <Card
    variant={isActive ? 'elevated' : 'flat'}
    padding="sm"
    className={`
      cursor-pointer text-center transition-all group flex flex-col items-center justify-center h-24
      ${isActive 
        ? 'ring-2 ring-[var(--interactive-accent)] bg-[var(--surface-primary)]' 
        : 'hover:border-[var(--border-secondary)] hover:bg-[var(--surface-secondary)]'
      }
    `}
    onClick={() => onSelect(preset.id)}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <span className="text-2xl mb-1">{preset.icon}</span>
    <Text variant="muted" className={`text-xs font-medium ${isActive ? 'text-[var(--interactive-accent)]' : ''}`}>
      {preset.label}
    </Text>
  </Card>
);

export function ExperienceSelector({
  compact = false,
  showLabels = true,
}: ExperienceSelectorProps) {
  const { experienceLevel, autonomyMode, setExperienceLevel, setAutonomyMode } = useSettingsStore(
    (state) => ({
      experienceLevel: state.experienceLevel,
      autonomyMode: state.autonomyMode,
      setExperienceLevel: state.setExperienceLevel,
      setAutonomyMode: state.setAutonomyMode,
    }),
    shallow,
  );

  const experiencePresets = EXPERIENCE_LIST;
  const autonomyPresets = AUTONOMY_LIST;

  const handleExperienceSelect = useCallback(
    (id: ExperienceLevel) => setExperienceLevel(id),
    [setExperienceLevel],
  );
  const handleAutonomySelect = useCallback(
    (id: AutonomyMode) => setAutonomyMode(id),
    [setAutonomyMode],
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <CompactPresetPills
          presets={experiencePresets}
          activeId={experienceLevel}
          onSelect={handleExperienceSelect}
          layoutId="experience-pill"
        />

        {/* Divider */}
        <div className="w-px h-4 bg-[var(--border-secondary)]" />

        <CompactPresetPills
          presets={autonomyPresets}
          activeId={autonomyMode}
          onSelect={handleAutonomySelect}
          layoutId="autonomy-pill"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Experience Level Section */}
      <div className="space-y-3">
        {showLabels && (
          <div>
            <Text variant="label">Experience Level</Text>
            <Text variant="muted" className="mt-0.5">Adjusts explanation depth and terminology</Text>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {experiencePresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={experienceLevel === preset.id}
              onSelect={handleExperienceSelect}
            />
          ))}
        </div>
      </div>

      {/* Autonomy Mode Section */}
      <div className="space-y-3">
        {showLabels && (
           <div>
            <Text variant="label">Autonomy Mode</Text>
            <Text variant="muted" className="mt-0.5">Controls how independently the AI acts</Text>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {autonomyPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={autonomyMode === preset.id}
              onSelect={handleAutonomySelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact badges showing current experience & autonomy - for use in headers
 */
interface ExperienceBadgeProps {
  className?: string;
}

export function ExperienceBadge({ className = '' }: ExperienceBadgeProps) {
  const { experienceLevel, autonomyMode } = useSettingsStore(
    (state) => ({
      experienceLevel: state.experienceLevel,
      autonomyMode: state.autonomyMode,
    }),
    shallow,
  );
  const expPreset = EXPERIENCE_PRESETS[experienceLevel];
  const autoPreset = AUTONOMY_PRESETS[autonomyMode];

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span 
        className="px-1.5 py-0.5 rounded text-xs font-medium border border-transparent"
        style={{ 
          backgroundColor: 'var(--surface-secondary)', 
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-subtle)'
        }}
        title={`Experience: ${expPreset.label} - ${expPreset.description}`}
      >
        {expPreset.icon}
      </span>
      <span 
        className="px-1.5 py-0.5 rounded text-xs font-medium border border-transparent"
        style={{ 
           backgroundColor: 'var(--surface-secondary)', 
           color: 'var(--text-secondary)',
           borderColor: 'var(--border-subtle)'
        }}
        title={`Autonomy: ${autoPreset.label} - ${autoPreset.description}`}
      >
        {autoPreset.icon}
      </span>
    </div>
  );
}
