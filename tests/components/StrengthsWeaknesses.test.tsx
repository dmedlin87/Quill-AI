import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StrengthsWeaknesses } from '@/features/analysis/components/StrengthsWeaknesses';

describe('StrengthsWeaknesses', () => {
  it('renders strengths and weaknesses lists when provided', () => {
    const strengths = ['Vivid descriptions', 'Strong character dynamics'];
    const weaknesses = ['Slow opening', 'Occasional exposition dumps'];

    render(
      <StrengthsWeaknesses
        strengths={strengths}
        weaknesses={weaknesses}
      />
    );

    expect(screen.getByText('Key Strengths')).toBeInTheDocument();
    expect(screen.getByText('Areas for Improvement')).toBeInTheDocument();

    strengths.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });

    weaknesses.forEach((w) => {
      expect(screen.getByText(w)).toBeInTheDocument();
    });
  });

  it('handles empty lists gracefully', () => {
    render(
      <StrengthsWeaknesses
        strengths={[]}
        weaknesses={[]}
      />
    );

    expect(
      screen.getByText('No specific strengths listed.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No specific weaknesses listed.')
    ).toBeInTheDocument();
  });
});
