import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach } from 'vitest';

import { ExperienceSelector } from '@/features/settings/components/ExperienceSelector';
import { EXPERIENCE_PRESETS, AUTONOMY_PRESETS, ExperienceLevel, AutonomyMode } from '@/types/experienceSettings';

// Mock framer-motion to avoid animation issues in JSDOM
vi.mock('framer-motion', () => ({
  motion: {
    // Destructure framer-specific props to prevent them from being passed to the DOM
    div: ({ children, layoutId, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, whileHover, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}));

// Mock useSettingsStore (Zustand store)
const mockUseSettingsStore = vi.fn();

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: () => mockUseSettingsStore(),
}));

describe('ExperienceSelector', () => {
  const experiencePresets = Object.values(EXPERIENCE_PRESETS);
  const autonomyPresets = Object.values(AUTONOMY_PRESETS);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders experience and autonomy presets in compact mode and toggles values', () => {
    const setExperienceLevel = vi.fn();
    const setAutonomyMode = vi.fn();

    mockUseSettingsStore.mockReturnValue({
      experienceLevel: experiencePresets[0].id,
      autonomyMode: autonomyPresets[0].id,
      setExperienceLevel,
      setAutonomyMode,
    });

    render(<ExperienceSelector compact />);

    // All presets should be present as buttons with title text
    experiencePresets.forEach((preset) => {
      const btn = screen.getByTitle(`${preset.label}: ${preset.description}`);
      expect(btn).toBeInTheDocument();
    });

    autonomyPresets.forEach((preset) => {
      const btn = screen.getByTitle(`${preset.label}: ${preset.description}`);
      expect(btn).toBeInTheDocument();
    });

    // Clicking a non-active experience preset updates the store
    const targetExperience = experiencePresets[1];
    fireEvent.click(screen.getByTitle(`${targetExperience.label}: ${targetExperience.description}`));
    expect(setExperienceLevel).toHaveBeenCalledWith(targetExperience.id as ExperienceLevel);

    // Clicking a non-active autonomy preset updates the store
    const targetAutonomy = autonomyPresets[1];
    fireEvent.click(screen.getByTitle(`${targetAutonomy.label}: ${targetAutonomy.description}`));
    expect(setAutonomyMode).toHaveBeenCalledWith(targetAutonomy.id as AutonomyMode);
  });

  it('applies active vs inactive styling in compact mode', () => {
    const activeExperience = experiencePresets[0];
    const inactiveExperience = experiencePresets[1];

    mockUseSettingsStore.mockReturnValue({
      experienceLevel: activeExperience.id,
      autonomyMode: autonomyPresets[0].id,
      setExperienceLevel: vi.fn(),
      setAutonomyMode: vi.fn(),
    });

    render(<ExperienceSelector compact />);

    const activeButton = screen.getByTitle(`${activeExperience.label}: ${activeExperience.description}`);
    const inactiveButton = screen.getByTitle(`${inactiveExperience.label}: ${inactiveExperience.description}`);

    expect(activeButton.className).toContain('text-white');
    expect(inactiveButton.className).toContain('text-slate-400');
  });

  it('renders labels and descriptions in full mode and updates store on click', () => {
    const activeExperience = experiencePresets[0];
    const targetExperience = experiencePresets[1];
    const activeAutonomy = autonomyPresets[0];
    const targetAutonomy = autonomyPresets[1];

    const setExperienceLevel = vi.fn();
    const setAutonomyMode = vi.fn();

    mockUseSettingsStore.mockReturnValue({
      experienceLevel: activeExperience.id,
      autonomyMode: activeAutonomy.id,
      setExperienceLevel,
      setAutonomyMode,
    });

    render(<ExperienceSelector />);

    // Labels and helper copy
    expect(screen.getByText('Experience Level')).toBeInTheDocument();
    expect(screen.getByText('Adjusts explanation depth and terminology')).toBeInTheDocument();
    expect(screen.getByText('Autonomy Mode')).toBeInTheDocument();
    expect(screen.getByText('Controls how independently the AI acts')).toBeInTheDocument();

    // All preset labels should be visible
    experiencePresets.forEach((preset) => {
      expect(screen.getByText(preset.label)).toBeInTheDocument();
    });
    autonomyPresets.forEach((preset) => {
      expect(screen.getByText(preset.label)).toBeInTheDocument();
    });

    // Clicking experience preset
    const targetExpButton = screen.getByText(targetExperience.label).closest('button');
    expect(targetExpButton).toBeTruthy();
    if (targetExpButton) fireEvent.click(targetExpButton);
    expect(setExperienceLevel).toHaveBeenCalledWith(targetExperience.id as ExperienceLevel);

    // Clicking autonomy preset
    const targetAutoButton = screen.getByText(targetAutonomy.label).closest('button');
    expect(targetAutoButton).toBeTruthy();
    if (targetAutoButton) fireEvent.click(targetAutoButton);
    expect(setAutonomyMode).toHaveBeenCalledWith(targetAutonomy.id as AutonomyMode);

    // Active experience preset should use its color in inline styles
    const activeExpButton = screen.getByText(activeExperience.label).closest('button');
    expect(activeExpButton).toHaveStyle({ borderColor: activeExperience.color });
  });

  it('can hide labels and helper text in full mode when showLabels is false', () => {
    mockUseSettingsStore.mockReturnValue({
      experienceLevel: experiencePresets[0].id,
      autonomyMode: autonomyPresets[0].id,
      setExperienceLevel: vi.fn(),
      setAutonomyMode: vi.fn(),
    });

    render(<ExperienceSelector showLabels={false} />);

    expect(screen.queryByText('Experience Level')).not.toBeInTheDocument();
    expect(screen.queryByText('Autonomy Mode')).not.toBeInTheDocument();

    // Buttons are still rendered
    experiencePresets.forEach((preset) => {
      expect(screen.getByText(preset.label)).toBeInTheDocument();
    });
  });
});
