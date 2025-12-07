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
  <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
    {presets.map((preset) => {
      const isActive = activeId === preset.id;
      return (
        <button
          key={preset.id}
          onClick={() => onSelect(preset.id)}
          className={`
            relative px-2 py-1 rounded text-xs font-medium transition-all
            ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300'}
          `}
          title={`${preset.label}: ${preset.description}`}
        >
          {isActive && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded"
              style={{ backgroundColor: preset.color }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{preset.icon}</span>
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
  <motion.button
    key={preset.id}
    onClick={() => onSelect(preset.id)}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`
      relative p-2 rounded-lg border-2 transition-all text-center
      ${isActive ? 'border-opacity-100' : 'border-slate-700 hover:border-slate-600'}
    `}
    style={{
      borderColor: isActive ? preset.color : undefined,
      backgroundColor: isActive ? `${preset.color}15` : undefined,
    }}
  >
    <span className="text-lg">{preset.icon}</span>
    <div className="text-xs font-medium text-slate-300 mt-1">{preset.label}</div>
  </motion.button>
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
        <div className="w-px h-4 bg-slate-600" />

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
    <div className="space-y-4">
      {/* Experience Level Section */}
      <div className="space-y-2">
        {showLabels && (
          <>
            <label className="text-sm font-medium text-slate-300">
              Experience Level
            </label>
            <p className="text-xs text-slate-500 -mt-1">
              Adjusts explanation depth and terminology
            </p>
          </>
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
      <div className="space-y-2">
        {showLabels && (
          <>
            <label className="text-sm font-medium text-slate-300">
              Autonomy Mode
            </label>
            <p className="text-xs text-slate-500 -mt-1">
              Controls how independently the AI acts
            </p>
          </>
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
        className="px-1.5 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${expPreset.color}20`, color: expPreset.color }}
        title={`Experience: ${expPreset.label} - ${expPreset.description}`}
      >
        {expPreset.icon}
      </span>
      <span 
        className="px-1.5 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${autoPreset.color}20`, color: autoPreset.color }}
        title={`Autonomy: ${autoPreset.label} - ${autoPreset.description}`}
      >
        {autoPreset.icon}
      </span>
    </div>
  );
}
