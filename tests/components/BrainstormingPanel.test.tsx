import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrainstormingPanel } from '@/features/analysis/components/BrainstormingPanel';

const mockGenerate = vi.fn();
const usePlotSuggestionsMock = vi.fn();

vi.mock('@/features/shared', () => ({
  usePlotSuggestions: (...args: unknown[]) => usePlotSuggestionsMock(...args),
}));

describe('BrainstormingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlotSuggestionsMock.mockReturnValue({
      suggestions: [],
      isLoading: false,
      error: null,
      generate: mockGenerate,
    });
  });

  it('allows selecting suggestion type and generating ideas', () => {
    render(<BrainstormingPanel currentText="Story text" />);

    const input = screen.getByPlaceholderText(/shocking revelation/i);
    fireEvent.change(input, { target: { value: 'A dark secret is revealed' } });

    const plotTwistButton = screen.getByText('Plot Twist');
    fireEvent.click(plotTwistButton);

    const generateButton = screen.getByText('Generate');
    fireEvent.click(generateButton);

    expect(mockGenerate).toHaveBeenCalledWith('A dark secret is revealed', 'Plot Twist');
  });

  it('shows loading state while generating', () => {
    usePlotSuggestionsMock.mockReturnValue({
      suggestions: [],
      isLoading: true,
      error: null,
      generate: mockGenerate,
    });

    render(<BrainstormingPanel currentText="Story text" />);

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thinking/i })).toBeDisabled();
  });

  it('renders suggestions when available', () => {
    usePlotSuggestionsMock.mockReturnValue({
      suggestions: [
        {
          title: 'Unexpected Ally',
          description: 'An old rival offers help at a critical moment.',
          reasoning: 'It complicates loyalties and raises stakes.',
        },
      ],
      isLoading: false,
      error: null,
      generate: mockGenerate,
    });

    render(<BrainstormingPanel currentText="Story text" />);

    expect(screen.getByText('Unexpected Ally')).toBeInTheDocument();
    expect(screen.getByText(/old rival offers help/i)).toBeInTheDocument();
    expect(screen.getByText(/why this works/i)).toBeInTheDocument();
  });

  it('displays error message when provided by hook', () => {
    usePlotSuggestionsMock.mockReturnValue({
      suggestions: [],
      isLoading: false,
      error: 'Failed to generate ideas. Please try again.',
      generate: mockGenerate,
    });

    render(<BrainstormingPanel currentText="Story text" />);

    expect(screen.getByText('Failed to generate ideas. Please try again.')).toBeInTheDocument();
  });

  it('triggers generate when pressing Enter in the query input', () => {
    render(<BrainstormingPanel currentText="Story text" />);

    const input = screen.getByPlaceholderText(/shocking revelation/i);
    fireEvent.change(input, { target: { value: 'A betrayal at the feast' } });

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockGenerate).toHaveBeenCalledWith('A betrayal at the feast', 'General');
  });
});
