import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { PlotIssuesSection } from '@/features/analysis/components/PlotIssuesSection';

describe('PlotIssuesSection', () => {
  it('renders empty state when no issues', () => {
    render(
      <PlotIssuesSection
        issues={[]}
        onQuoteClick={() => {}}
      />
    );

    expect(
      screen.getByText('No major plot holes detected. Great job!')
    ).toBeInTheDocument();
  });

  it('renders issues and supports navigation and fix actions', () => {
    const onQuoteClick = vi.fn();
    const onFixRequest = vi.fn();

    const issues = [
      {
        issue: 'Motivation feels weak.',
        location: 'Chapter 3, opening',
        suggestion: 'Clarify the emotional stakes behind the decision.',
        quote: 'He simply decided to leave without a word.',
      },
    ];

    render(
      <PlotIssuesSection
        issues={issues}
        onQuoteClick={onQuoteClick}
        onFixRequest={onFixRequest}
      />
    );

    expect(screen.getByText('Plot Analysis')).toBeInTheDocument();
    expect(screen.getByText('Motivation feels weak.')).toBeInTheDocument();
    expect(screen.getByText('Chapter 3, opening')).toBeInTheDocument();

    // Clicking the card uses the quote navigation callback
    fireEvent.click(screen.getByText('Motivation feels weak.'));
    expect(onQuoteClick).toHaveBeenCalledWith('He simply decided to leave without a word.');

    // Clicking fix button triggers onFixRequest with derived context
    const fixButton = screen.getByText('✨ Fix with Agent');
    fireEvent.click(fixButton);

    expect(onFixRequest).toHaveBeenCalledWith(
      '"He simply decided to leave without a word." (Chapter 3, opening)',
      'Clarify the emotional stakes behind the decision.'
    );
  });
});
