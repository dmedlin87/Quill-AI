import * as SettingsFeature from '@/features/settings';

describe('features/settings index', () => {
  it('exports settings components and store', () => {
    expect(SettingsFeature.useSettingsStore).toBeDefined();
    expect(SettingsFeature.CritiqueIntensitySelector).toBeDefined();
    expect(SettingsFeature.IntensityBadge).toBeDefined();
    expect(SettingsFeature.ExperienceSelector).toBeDefined();
    expect(SettingsFeature.ExperienceBadge).toBeDefined();
    expect(SettingsFeature.NativeSpellcheckToggle).toBeDefined();
    expect(SettingsFeature.DeveloperModeToggle).toBeDefined();
    expect(SettingsFeature.RelevanceTuning).toBeDefined();
    expect(SettingsFeature.ThemeSelector).toBeDefined();
    expect(SettingsFeature.ModelBuildSelector).toBeDefined();
    expect(SettingsFeature.ModelBuildBadge).toBeDefined();
    expect(SettingsFeature.ApiKeyManager).toBeDefined();
  });
});
