import { describe, it, expect, beforeEach } from 'vitest';

import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { DEFAULT_CRITIQUE_INTENSITY, CritiqueIntensity } from '@/types/critiqueSettings';
import {
  DEFAULT_EXPERIENCE,
  DEFAULT_AUTONOMY,
  ExperienceLevel,
  AutonomyMode,
  DEFAULT_SUGGESTION_WEIGHTS
} from '@/types/experienceSettings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset to defaults before each test to avoid persistence bleed-through
    useSettingsStore.setState({
      critiqueIntensity: DEFAULT_CRITIQUE_INTENSITY,
      experienceLevel: DEFAULT_EXPERIENCE,
      autonomyMode: DEFAULT_AUTONOMY,
      nativeSpellcheckEnabled: true,
      developerModeEnabled: false,
      budgetThreshold: 1.0,
      automatedThinkingEnabled: false,
      advancedFeaturesEnabled: false,
      experimentalFeaturesEnabled: false,
      suggestionWeights: DEFAULT_SUGGESTION_WEIGHTS,
    });
  });

  it('initializes with default settings', () => {
    const state = useSettingsStore.getState();

    expect(state.critiqueIntensity).toBe(DEFAULT_CRITIQUE_INTENSITY);
    expect(state.experienceLevel).toBe(DEFAULT_EXPERIENCE);
    expect(state.autonomyMode).toBe(DEFAULT_AUTONOMY);
    expect(state.nativeSpellcheckEnabled).toBe(true);
    expect(state.developerModeEnabled).toBe(false);
    expect(state.budgetThreshold).toBe(1.0);
    expect(state.automatedThinkingEnabled).toBe(false);
    expect(state.advancedFeaturesEnabled).toBe(false);
    expect(state.experimentalFeaturesEnabled).toBe(false);
    expect(state.suggestionWeights).toEqual(DEFAULT_SUGGESTION_WEIGHTS);
  });

  it('updates critiqueIntensity via setCritiqueIntensity', () => {
    const { setCritiqueIntensity } = useSettingsStore.getState();

    setCritiqueIntensity('intensive' as CritiqueIntensity);

    expect(useSettingsStore.getState().critiqueIntensity).toBe('intensive');
  });

  it('updates experienceLevel via setExperienceLevel', () => {
    const { setExperienceLevel } = useSettingsStore.getState();

    setExperienceLevel('pro' as ExperienceLevel);

    expect(useSettingsStore.getState().experienceLevel).toBe('pro');
  });

  it('updates autonomyMode via setAutonomyMode', () => {
    const { setAutonomyMode } = useSettingsStore.getState();

    setAutonomyMode('auto' as AutonomyMode);

    expect(useSettingsStore.getState().autonomyMode).toBe('auto');
  });

  it('toggles native spellcheck preference', () => {
    const { setNativeSpellcheckEnabled } = useSettingsStore.getState();

    setNativeSpellcheckEnabled(false);

    expect(useSettingsStore.getState().nativeSpellcheckEnabled).toBe(false);
  });

  it('toggles developer mode preference', () => {
    const { setDeveloperModeEnabled } = useSettingsStore.getState();

    setDeveloperModeEnabled(true);

    expect(useSettingsStore.getState().developerModeEnabled).toBe(true);
  });

  it('toggles advanced features preference', () => {
    const { setAdvancedFeaturesEnabled } = useSettingsStore.getState();

    setAdvancedFeaturesEnabled(true);

    expect(useSettingsStore.getState().advancedFeaturesEnabled).toBe(true);
  });

  it('toggles experimental features preference', () => {
    const { setExperimentalFeaturesEnabled } = useSettingsStore.getState();

    setExperimentalFeaturesEnabled(true);

    expect(useSettingsStore.getState().experimentalFeaturesEnabled).toBe(true);
  });

  it('updates budgetThreshold via setBudgetThreshold', () => {
    const { setBudgetThreshold } = useSettingsStore.getState();

    setBudgetThreshold(2.5);

    expect(useSettingsStore.getState().budgetThreshold).toBe(2.5);
  });

  it('updates suggestion weights and resets them', () => {
    const { updateSuggestionWeight, resetSuggestionWeights } = useSettingsStore.getState();

    updateSuggestionWeight('plot', 1.5);
    expect(useSettingsStore.getState().suggestionWeights.plot).toBe(1.5);

    resetSuggestionWeights();
    expect(useSettingsStore.getState().suggestionWeights.plot).toBe(DEFAULT_SUGGESTION_WEIGHTS.plot);
  });

  it('toggles automated thinking preference', () => {
    const { setAutomatedThinkingEnabled } = useSettingsStore.getState();

    setAutomatedThinkingEnabled(true);

    expect(useSettingsStore.getState().automatedThinkingEnabled).toBe(true);
  });

  it('preserves state reference if value is unchanged', () => {
      const { setCritiqueIntensity } = useSettingsStore.getState();
      const initialState = useSettingsStore.getState();

      setCritiqueIntensity(initialState.critiqueIntensity);

      expect(useSettingsStore.getState()).toBe(initialState);
  });
});
