import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CritiqueIntensity, DEFAULT_CRITIQUE_INTENSITY } from '@/types/critiqueSettings';
import {
  ExperienceLevel,
  AutonomyMode,
  SuggestionWeights,
  DEFAULT_EXPERIENCE,
  DEFAULT_AUTONOMY,
  DEFAULT_SUGGESTION_WEIGHTS,
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
  developerModeEnabled: boolean;
  setDeveloperModeEnabled: (enabled: boolean) => void;
  suggestionWeights: SuggestionWeights;
  updateSuggestionWeight: (category: string, weight: number) => void;
  resetSuggestionWeights: () => void;
}

const initialState: Omit<SettingsState, keyof SettingsActions> = {
  critiqueIntensity: DEFAULT_CRITIQUE_INTENSITY,
  experienceLevel: DEFAULT_EXPERIENCE,
  autonomyMode: DEFAULT_AUTONOMY,
  budgetThreshold: 1.0,
  nativeSpellcheckEnabled: true,
  developerModeEnabled: false,
  suggestionWeights: DEFAULT_SUGGESTION_WEIGHTS,
};

type SettingsActions = Pick<
  SettingsState,
  | 'setCritiqueIntensity'
  | 'setExperienceLevel'
  | 'setAutonomyMode'
  | 'setBudgetThreshold'
  | 'setNativeSpellcheckEnabled'
  | 'setDeveloperModeEnabled'
  | 'updateSuggestionWeight'
  | 'resetSuggestionWeights'
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
      setDeveloperModeEnabled: (enabled) =>
        set((state) =>
          state.developerModeEnabled === enabled
            ? state
            : { ...state, developerModeEnabled: enabled }
        ),
      updateSuggestionWeight: (category, weight) =>
        set((state) => ({
          suggestionWeights: {
            ...state.suggestionWeights,
            [category]: weight,
          },
        })),
      resetSuggestionWeights: () =>
        set(() => ({
          suggestionWeights: DEFAULT_SUGGESTION_WEIGHTS,
        })),
    }),
    {
      name: 'quill-settings',
    }
  )
);
