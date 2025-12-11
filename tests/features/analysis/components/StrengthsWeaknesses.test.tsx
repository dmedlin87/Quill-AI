import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StrengthsWeaknesses } from '@/features/analysis/components/StrengthsWeaknesses';

describe('StrengthsWeaknesses', () => {
  it('renders lists of strengths and weaknesses', () => {
    const strengths = ['Great dialogue', 'Vivid descriptions'];
    const weaknesses = ['Slow pacing', 'Flat characters'];

    render(<StrengthsWeaknesses strengths={strengths} weaknesses={weaknesses} />);

    expect(screen.getByText('Key Strengths')).toBeInTheDocument();
    expect(screen.getByText('Great dialogue')).toBeInTheDocument();
    expect(screen.getByText('Vivid descriptions')).toBeInTheDocument();

    expect(screen.getByText('Areas for Improvement')).toBeInTheDocument();
    expect(screen.getByText('Slow pacing')).toBeInTheDocument();
    expect(screen.getByText('Flat characters')).toBeInTheDocument();
  });

  it('renders fallback text when lists are empty', () => {
    render(<StrengthsWeaknesses strengths={[]} weaknesses={[]} />);

    expect(screen.getByText('No specific strengths listed.')).toBeInTheDocument();
    expect(screen.getByText('No specific weaknesses listed.')).toBeInTheDocument();
  });

  it('renders fallback text when props are undefined', () => {
    render(<StrengthsWeaknesses />);

    expect(screen.getByText('No specific strengths listed.')).toBeInTheDocument();
    expect(screen.getByText('No specific weaknesses listed.')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
      // Just a basic check that we are rendering the structure expected
      const { container } = render(<StrengthsWeaknesses strengths={['Strong']} weaknesses={['Weak']} />);

      const greenElements = container.querySelectorAll('.text-green-800'); // Title color
      const redElements = container.querySelectorAll('.text-red-800');     // Title color

      expect(greenElements.length).toBeGreaterThan(0);
      expect(redElements.length).toBeGreaterThan(0);
  });
});
