import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { SettingConsistencySection } from '@/features/analysis/components/SettingConsistencySection';

describe('SettingConsistencySection', () => {
  it('renders empty state when there are no issues', () => {
    render(
      <SettingConsistencySection
        issues={[]}
        onQuoteClick={() => {}}
        score={9}
      />
    );

    expect(screen.getByText('Setting & Era Consistency')).toBeInTheDocument();
    expect(screen.getByText('Accuracy: 9/10')).toBeInTheDocument();
    expect(
      screen.getByText('No anachronisms or tone mismatches detected for this era.')
    ).toBeInTheDocument();
  });

  it('renders issues with quotes, suggestions, and alternatives', () => {
    const onQuoteClick = vi.fn();

    const issues = [
      {
        quote: 'She checked her wristwatch under the gaslight.',
        issue: 'Modern object in pre-industrial setting.',
        suggestion: 'Replace with an era-appropriate timekeeping method.',
        alternatives: ['Pocket watch', 'Clock tower chime'],
      },
    ];

    render(
      <SettingConsistencySection
        issues={issues}
        onQuoteClick={onQuoteClick}
        score={6}
      />
    );

    expect(screen.getByText('Setting & Era Consistency')).toBeInTheDocument();
    expect(screen.getByText('Accuracy: 6/10')).toBeInTheDocument();
    expect(screen.getByText('Modern object in pre-industrial setting.')).toBeInTheDocument();
    expect(screen.getByText('"She checked her wristwatch under the gaslight."')).toBeInTheDocument();
    expect(screen.getByText('Replace with an era-appropriate timekeeping method.')).toBeInTheDocument();

    // Alternatives rendered as chips
    expect(screen.getByText('Pocket watch')).toBeInTheDocument();
    expect(screen.getByText('Clock tower chime')).toBeInTheDocument();

    // Clicking "Find in text" uses onQuoteClick
    fireEvent.click(screen.getByText('Find in text'));
    expect(onQuoteClick).toHaveBeenCalledWith('She checked her wristwatch under the gaslight.');
  });

  it('applies correct badge color based on score thresholds', () => {
    const { rerender } = render(
      <SettingConsistencySection
        issues={[]}
        onQuoteClick={() => {}}
        score={9}
      />
    );

    const highBadge = screen.getByText('Accuracy: 9/10');
    expect(highBadge).toHaveClass('bg-green-100', 'text-green-700');

    rerender(
      <SettingConsistencySection
        issues={[]}
        onQuoteClick={() => {}}
        score={6}
      />
    );

    const midBadge = screen.getByText('Accuracy: 6/10');
    expect(midBadge).toHaveClass('bg-yellow-100', 'text-yellow-700');

    rerender(
      <SettingConsistencySection
        issues={[]}
        onQuoteClick={() => {}}
        score={3}
      />
    );

    const lowBadge = screen.getByText('Accuracy: 3/10');
    expect(lowBadge).toHaveClass('bg-red-100', 'text-red-700');
  });
});
