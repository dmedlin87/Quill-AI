import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BudgetSelector } from '@/features/settings/components/BudgetSelector';
import { ExperienceSelector } from '@/features/settings/components/ExperienceSelector';
import { CritiqueIntensitySelector } from '@/features/settings/components/CritiqueIntensitySelector';

const mockStore = {
  budgetThreshold: 1,
  experienceLevel: 'advanced',
  critiqueIntensity: 'high',
  setBudgetThreshold: vi.fn(),
  setExperienceLevel: vi.fn(),
  setCritiqueIntensity: vi.fn(),
};

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: () => mockStore,
}));

describe('Settings selectors', () => {
  beforeEach(() => {
    Object.assign(mockStore, {
      budgetThreshold: 1,
      experienceLevel: 'advanced',
      critiqueIntensity: 'high',
    });
    mockStore.setBudgetThreshold.mockClear();
    mockStore.setExperienceLevel.mockClear();
    mockStore.setCritiqueIntensity.mockClear();
  });

  it('updates budget threshold when preset clicked', () => {
    render(<BudgetSelector />);

    fireEvent.click(screen.getByText('$0.50'));

    expect(mockStore.setBudgetThreshold).toHaveBeenCalledWith(0.5);
  });

  it('highlights active budget selection', () => {
    render(<BudgetSelector />);

    const active = screen.getByText('$1.00');
    expect(active.className).toContain('magic');
  });

  it('changes experience level', () => {
    render(<ExperienceSelector />);

    fireEvent.click(screen.getByText('Novice'));

    expect(mockStore.setExperienceLevel).toHaveBeenCalledWith('novice');
  });

  it('changes critique intensity', () => {
    render(<CritiqueIntensitySelector />);

    fireEvent.click(screen.getByText('Developmental'));

    expect(mockStore.setCritiqueIntensity).toHaveBeenCalledWith('developmental');
  });
});
