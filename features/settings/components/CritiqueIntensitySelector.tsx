import React from 'react';
import { motion } from 'framer-motion';
import { CRITIQUE_PRESETS, CritiqueIntensity } from '@/types/critiqueSettings';
import { useSettingsStore } from '../store/useSettingsStore';

type CritiquePreset = (typeof CRITIQUE_PRESETS)[CritiqueIntensity];

interface CritiqueIntensitySelectorProps {
  compact?: boolean;
}

const presets: CritiquePreset[] = Object.values(CRITIQUE_PRESETS);

export function CritiqueIntensitySelector({ compact = false }: CritiqueIntensitySelectorProps) {
  const critiqueIntensity = useSettingsStore((state) => state.critiqueIntensity);
  const setCritiqueIntensity = useSettingsStore((state) => state.setCritiqueIntensity);

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setCritiqueIntensity(preset.id)}
            className={`
              relative px-2 py-1 rounded text-xs font-medium transition-all
              ${critiqueIntensity === preset.id
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-300'
              }
            `}
            title={preset.description}
            type="button"
          >
            {critiqueIntensity === preset.id && (
              <motion.div
                layoutId="intensity-pill"
                className="absolute inset-0 rounded"
                style={{ backgroundColor: preset.color }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{preset.icon}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-300">
        Critique Intensity
      </label>
      <p className="text-xs text-slate-500 -mt-1">
        Controls how rigorous the AI feedback is
      </p>
      <div className="grid grid-cols-1 gap-2">
        {presets.map((preset) => {
          const isActive = critiqueIntensity === preset.id;
          return (
            <motion.button
              key={preset.id}
              onClick={() => setCritiqueIntensity(preset.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`
                relative p-3 rounded-lg border-2 transition-all text-left
                ${isActive
                  ? 'border-opacity-100 bg-opacity-10'
                  : 'border-slate-700 hover:border-slate-600 bg-transparent'
                }
              `}
              style={{
                borderColor: isActive ? preset.color : undefined,
                backgroundColor: isActive ? `${preset.color}15` : undefined,
              }}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{preset.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-200 flex items-center gap-2">
                    {preset.label}
                    {isActive && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: preset.color, color: 'white' }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {preset.description}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface IntensityBadgeProps {
  className?: string;
}

/**
 * Small badge showing current intensity - for use in headers
 */
export function IntensityBadge({ className = '' }: IntensityBadgeProps) {
  const critiqueIntensity = useSettingsStore((state) => state.critiqueIntensity);
  const preset = CRITIQUE_PRESETS[critiqueIntensity];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{ backgroundColor: `${preset.color}20`, color: preset.color }}
      title={`Critique mode: ${preset.label} - ${preset.description}`}
    >
      <span>{preset.icon}</span>
      <span>{preset.label}</span>
    </div>
  );
}
