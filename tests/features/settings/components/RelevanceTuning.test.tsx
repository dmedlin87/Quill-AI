import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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

    const sliders = screen.getAllByRole('slider');
    const plotSlider = sliders[0];

    fireEvent.change(plotSlider, { target: { value: '1.5' } });

    expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 1.5);
  });

  it('calls updateSuggestionWeight when input is changed and blurred', () => {
    render(<RelevanceTuning />);

    // Find input for 'plot'
    const inputs = screen.getAllByRole('spinbutton');
    const plotInput = inputs[0];

    // Changing value shouldn't trigger update yet
    fireEvent.change(plotInput, { target: { value: '1.2' } });
    expect(updateSuggestionWeight).not.toHaveBeenCalled();

    // Blur should trigger update
    fireEvent.blur(plotInput);
    expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 1.2);
  });

  it('clamps manual input values between 0 and 2 on blur', () => {
     render(<RelevanceTuning />);

     const inputs = screen.getAllByRole('spinbutton');
     const plotInput = inputs[0];

     // Test > 2
     fireEvent.change(plotInput, { target: { value: '5' } });
     fireEvent.blur(plotInput);
     expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 2);

     // Test < 0
     fireEvent.change(plotInput, { target: { value: '-1' } });
     fireEvent.blur(plotInput);
     expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 0);
  });

  it('calls resetSuggestionWeights when reset button is clicked', () => {
    render(<RelevanceTuning />);

    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    expect(resetSuggestionWeights).toHaveBeenCalled();
  });

  it('reverts invalid input on blur', () => {
     render(<RelevanceTuning />);

     const inputs = screen.getAllByRole('spinbutton');
     const plotInput = inputs[0];

     // Change to invalid
     fireEvent.change(plotInput, { target: { value: '' } }); // Empty string -> NaN usually
     fireEvent.blur(plotInput);

     // Should call with original value or just reset local state?
     // Implementation calls update with original value if NaN
     expect(updateSuggestionWeight).toHaveBeenCalledWith('plot', 1.0);
  });

  it('updates input when slider changes (via prop update)', () => {
    // This is tricky to test with mock store because we need to simulate re-render with new props.
    // We can use rerender with updated mock return value.

    const { rerender } = render(<RelevanceTuning />);
    const inputs = screen.getAllByRole('spinbutton');
    const plotInput = inputs[0] as HTMLInputElement;

    expect(plotInput.value).toBe('1.00');

    // Update mock and rerender
    (useSettingsStore as any).mockReturnValue({
      suggestionWeights: { ...suggestionWeights, plot: 1.5 },
      updateSuggestionWeight,
      resetSuggestionWeights,
    });

    rerender(<RelevanceTuning />);

    expect(plotInput.value).toBe('1.50');
  });

  it('blurs input on Enter key press', () => {
    render(<RelevanceTuning />);
    const inputs = screen.getAllByRole('spinbutton');
    const plotInput = inputs[0];

    // Mock blur
    const blurSpy = vi.spyOn(plotInput, 'blur');

    fireEvent.keyDown(plotInput, { key: 'Enter', code: 'Enter' });

    expect(blurSpy).toHaveBeenCalled();
  });
});
