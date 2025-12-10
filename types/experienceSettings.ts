/**
 * Experience Level & Autonomy Mode Settings
 * Controls AI interaction style based on user expertise and desired autonomy
 */

export type ExperienceLevel = 'novice' | 'intermediate' | 'pro';

export type AutonomyMode = 'teach' | 'copilot' | 'auto';

export interface ExperiencePreset {
  id: ExperienceLevel;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface AutonomyPreset {
  id: AutonomyMode;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const EXPERIENCE_PRESETS: Record<ExperienceLevel, ExperiencePreset> = {
  novice: {
    id: 'novice',
    label: 'Novice',
    description: 'New to writing. Detailed explanations, guided suggestions, learning-focused feedback.',
    icon: '🌱',
    color: '#10b981', // green
  },
  intermediate: {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Some experience. Balanced guidance with room to develop your voice.',
    icon: '📝',
    color: '#6366f1', // indigo
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    description: 'Experienced writer. Concise, advanced feedback. Assumes craft knowledge.',
    icon: '🎯',
    color: '#f59e0b', // amber
  },
};

export const AUTONOMY_PRESETS: Record<AutonomyMode, AutonomyPreset> = {
  teach: {
    id: 'teach',
    label: 'Teach Me',
    description: 'AI explains every suggestion. Learn the "why" behind each change.',
    icon: '📚',
    color: '#10b981', // green
  },
  copilot: {
    id: 'copilot',
    label: 'Copilot',
    description: 'Collaborative mode. AI suggests, you approve. Best of both worlds.',
    icon: '🤝',
    color: '#6366f1', // indigo
  },
  auto: {
    id: 'auto',
    label: 'Auto-Pilot',
    description: 'AI applies changes automatically. Maximum speed, minimal interruption.',
    icon: '🚀',
    color: '#ef4444', // red
  },
};

export const DEFAULT_EXPERIENCE: ExperienceLevel = 'intermediate';

export const DEFAULT_AUTONOMY: AutonomyMode = 'copilot';

export type SuggestionCategory =
  | 'plot'
  | 'character'
  | 'pacing'
  | 'style'
  | 'continuity'
  | 'lore_discovery'
  | 'timeline_conflict'
  | 'voice_inconsistency'
  | 'watched_entity'
  | 'active_goal'
  | 'reminder'
  | 'other';

export interface SuggestionWeights {
  [key: string]: number; // key is SuggestionCategory
}

export const DEFAULT_SUGGESTION_WEIGHTS: SuggestionWeights = {
  plot: 1.0,
  character: 1.0,
  pacing: 1.0,
  style: 1.0,
  continuity: 1.0,
  lore_discovery: 1.0,
  timeline_conflict: 1.0,
  voice_inconsistency: 1.0,
  watched_entity: 1.0,
  active_goal: 1.0,
  reminder: 1.0,
  other: 1.0,
};
