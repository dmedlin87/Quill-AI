import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RelevanceTuning } from '@/features/settings/components/RelevanceTuning';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';

// Mock the store
vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

describe('RelevanceTuning', () => {
  const updateSuggestionWeight = vi.fn();
  const resetSuggestionWeights = vi.fn();
  const suggestionWeights = { plot: 1.0, character: 0.5 };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore as any).mockReturnValue({
      suggestionWeights,
      updateSuggestionWeight,
      resetSuggestionWeights,
    });
  });

  it('renders all suggestion categories', () => {
    render(<RelevanceTuning />);
    expect(screen.getByText('Adaptive Relevance Tuning')).toBeInTheDocument();
    expect(screen.getByText('Plot Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Character Notes')).toBeInTheDocument();
  });

  it('calls updateSuggestionWeight when slider changes', () => {
    render(<RelevanceTuning />);

    // Find slider for 'plot' (value 1.0)
    // The sliders are inputs with type range.
    const sliders = screen.getAllByRole('slider');
    // Assuming 'plot' is first in the object keys of mock suggestionWeights
    const plotSlider = sliders[0];

    fireEvent.change(plotSlider, { target: { value: '1.5' } });

    expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 1.5);
  });

  it('calls resetSuggestionWeights when reset button is clicked', () => {
    render(<RelevanceTuning />);

    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    expect(resetSuggestionWeights).toHaveBeenCalled();
  });
});
