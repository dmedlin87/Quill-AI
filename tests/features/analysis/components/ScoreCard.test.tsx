import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoreCard } from '@/features/analysis/components/ScoreCard';

describe('ScoreCard', () => {
  it('renders label and score', () => {
    render(<ScoreCard label="Pacing" score={7} />);
    
    expect(screen.getByText('Pacing')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('uses default maxScore of 10', () => {
    render(<ScoreCard label="Plot" score={5} />);
    
    expect(screen.getByLabelText('Plot score 5 of 10')).toBeInTheDocument();
  });

  it('respects custom maxScore', () => {
    render(<ScoreCard label="Custom" score={3} maxScore={5} />);
    
    expect(screen.getByLabelText('Custom score 3 of 5')).toBeInTheDocument();
  });

  it('clamps percentage between 0 and 100', () => {
    const { container } = render(<ScoreCard label="Over" score={15} maxScore={10} />);
    
    // Score displays as-is but progress bar width capped at 100%
    expect(screen.getByText('15')).toBeInTheDocument();
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('handles zero maxScore gracefully', () => {
    render(<ScoreCard label="Zero" score={5} maxScore={0} />);
    
    // Falls back to safeMax of 1, so percentage = 500% capped to 100%
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('handles non-finite score', () => {
    render(<ScoreCard label="NaN" score={NaN} />);
    
    // safeScore becomes 0
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('handles negative score clamped to 0%', () => {
    const { container } = render(<ScoreCard label="Neg" score={-5} />);
    
    expect(screen.getByText('-5')).toBeInTheDocument();
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });
});
