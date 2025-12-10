import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExperienceSelector } from '@/features/settings/components/ExperienceSelector';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { EXPERIENCE_PRESETS, AUTONOMY_PRESETS } from '@/types/experienceSettings';

// Mock the store
vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

describe('ExperienceSelector', () => {
  const setExperienceLevel = vi.fn();
  const setAutonomyMode = vi.fn();
  const storeState = {
    experienceLevel: 'novice',
    autonomyMode: 'manual',
    setExperienceLevel,
    setAutonomyMode,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore as any).mockImplementation((selector: any) => {
        return selector(storeState);
    });
  });

  it('renders all experience levels', () => {
    render(<ExperienceSelector />);

    expect(screen.getByText('Experience Level')).toBeInTheDocument();

    // Check for each preset
    Object.values(EXPERIENCE_PRESETS).forEach(preset => {
        expect(screen.getByText(preset.label)).toBeInTheDocument();
    });
  });

  it('renders all autonomy modes', () => {
    render(<ExperienceSelector />);

    expect(screen.getByText('Autonomy Mode')).toBeInTheDocument();

    Object.values(AUTONOMY_PRESETS).forEach(preset => {
        expect(screen.getByText(preset.label)).toBeInTheDocument();
    });
  });

  it('calls setExperienceLevel when an experience preset is clicked', () => {
    render(<ExperienceSelector />);

    // Click 'Pro'
    fireEvent.click(screen.getByText('Pro'));

    expect(setExperienceLevel).toHaveBeenCalledWith('pro');
  });

  it('calls setAutonomyMode when an autonomy preset is clicked', () => {
    render(<ExperienceSelector />);

    // Click 'Autonomous' or 'Auto' (checking the label)
    // The preset label is 'Auto'
    const autoLabel = AUTONOMY_PRESETS['auto'].label;
    fireEvent.click(screen.getByText(autoLabel));

    expect(setAutonomyMode).toHaveBeenCalledWith('auto');
  });

  it('renders compact mode correctly', () => {
    render(<ExperienceSelector compact />);

    // Should NOT show section headers
    expect(screen.queryByText('Experience Level')).not.toBeInTheDocument();

    // But should still show preset icons/labels (or at least be clickable)
    // The CompactPresetPills renders buttons.
    // Let's check if buttons exist for each ID.

    const noviceButton = screen.getByTitle(/Novice/);
    expect(noviceButton).toBeInTheDocument();

    fireEvent.click(noviceButton);
    expect(setExperienceLevel).toHaveBeenCalledWith('novice');
  });

  it('highlights the active selection', () => {
     // Default mock state is 'novice' and 'manual'
     render(<ExperienceSelector />);

     const noviceCard = screen.getByText('Novice').closest('div[role="button"]');
     expect(noviceCard).toHaveClass('ring-2'); // Based on current styling in code

     const proCard = screen.getByText('Pro').closest('div[role="button"]');
     expect(proCard).not.toHaveClass('ring-2');
  });

  it('updates highlight when store state changes', () => {
     // Re-mock implementation for this test to simulate state change
     (useSettingsStore as any).mockImplementation((selector: any) => {
        return selector({
            ...storeState,
            experienceLevel: 'pro'
        });
     });

     render(<ExperienceSelector />);

     const proCard = screen.getByText('Pro').closest('div[role="button"]');
     expect(proCard).toHaveClass('ring-2');
  });
});
