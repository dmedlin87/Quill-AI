import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CritiqueIntensity, DEFAULT_CRITIQUE_INTENSITY } from '@/types/critiqueSettings';
import {
  ExperienceLevel,
  AutonomyMode,
  DEFAULT_EXPERIENCE,
  DEFAULT_AUTONOMY,
} from '@/types/experienceSettings';

interface SettingsState {
  critiqueIntensity: CritiqueIntensity;
  setCritiqueIntensity: (intensity: CritiqueIntensity) => void;
  experienceLevel: ExperienceLevel;
  setExperienceLevel: (level: ExperienceLevel) => void;
  autonomyMode: AutonomyMode;
  setAutonomyMode: (mode: AutonomyMode) => void;
  budgetThreshold: number;
  setBudgetThreshold: (threshold: number) => void;
  nativeSpellcheckEnabled: boolean;
  setNativeSpellcheckEnabled: (enabled: boolean) => void;
}

const initialState: Omit<SettingsState, keyof SettingsActions> = {
  critiqueIntensity: DEFAULT_CRITIQUE_INTENSITY,
  experienceLevel: DEFAULT_EXPERIENCE,
  autonomyMode: DEFAULT_AUTONOMY,
  budgetThreshold: 1.0,
  nativeSpellcheckEnabled: true,
};

type SettingsActions = Pick<
  SettingsState,
  | 'setCritiqueIntensity'
  | 'setExperienceLevel'
  | 'setAutonomyMode'
  | 'setBudgetThreshold'
  | 'setNativeSpellcheckEnabled'
>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,
      setCritiqueIntensity: (intensity) =>
        set((state) =>
          state.critiqueIntensity === intensity ? state : { ...state, critiqueIntensity: intensity }
        ),
      setExperienceLevel: (level) =>
        set((state) => (state.experienceLevel === level ? state : { ...state, experienceLevel: level })),
      setAutonomyMode: (mode) =>
        set((state) => (state.autonomyMode === mode ? state : { ...state, autonomyMode: mode })),
      setBudgetThreshold: (threshold) =>
        set((state) =>
          state.budgetThreshold === threshold ? state : { ...state, budgetThreshold: threshold }
        ),
      setNativeSpellcheckEnabled: (enabled) =>
        set((state) =>
          state.nativeSpellcheckEnabled === enabled
            ? state
            : { ...state, nativeSpellcheckEnabled: enabled }
        ),
    }),
    {
      name: 'quill-settings',
    }
  )
);
