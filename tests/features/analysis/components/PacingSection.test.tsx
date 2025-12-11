import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PacingSection } from '@/features/analysis/components/PacingSection';

describe('PacingSection', () => {
  const defaultProps = {
    pacing: {
      score: 7,
      analysis: 'Good pacing overall.',
      slowSections: ['Slow part 1'],
      fastSections: ['Fast part 1'],
    },
    currentText: 'This is the full text. Slow part 1 is here. Fast part 1 is there.',
  };

  it('renders score and analysis', () => {
    render(<PacingSection {...defaultProps} />);
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('Good pacing overall.')).toBeInTheDocument();
  });

  it('renders slow and fast sections lists', () => {
    render(<PacingSection {...defaultProps} />);
    expect(screen.getByText('Slow part 1')).toBeInTheDocument();
    expect(screen.getByText('Fast part 1')).toBeInTheDocument();
  });

  it('filters sections when filter buttons are clicked', () => {
    render(<PacingSection {...defaultProps} />);

    // Click 'Slow' filter
    fireEvent.click(screen.getByText('Slow'));
    expect(screen.getByText('Slow part 1')).toBeInTheDocument();
    expect(screen.queryByText('Fast part 1')).not.toBeInTheDocument();

    // Click 'Fast' filter
    fireEvent.click(screen.getByText('Fast'));
    expect(screen.queryByText('Slow part 1')).not.toBeInTheDocument();
    expect(screen.getByText('Fast part 1')).toBeInTheDocument();

    // Click 'All' filter
    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('Slow part 1')).toBeInTheDocument();
    expect(screen.getByText('Fast part 1')).toBeInTheDocument();
  });

  it('displays "None detected" when list is empty', () => {
    const props = {
      ...defaultProps,
      pacing: {
        ...defaultProps.pacing,
        slowSections: [],
        fastSections: [],
      },
    };
    render(<PacingSection {...props} />);
    const noneDetectedElements = screen.getAllByText('None detected.');
    expect(noneDetectedElements).toHaveLength(2); // One for slow, one for fast
  });

  it('handles empty currentText gracefully', () => {
    render(<PacingSection {...defaultProps} currentText="" />);
    expect(screen.getByText('7/10')).toBeInTheDocument();
    // Should verify it doesn't crash and heatmap is empty
  });

  it('calculates heatmap segments correctly based on text', () => {
    render(<PacingSection {...defaultProps} />);
    // This is checking implementation details via visual feedback,
    // but we can check if the heatmap segments are rendered in DOM
    // The segments are divs with title attributes.

    const slowSegment = screen.getByTitle(/Slow: Slow part 1/);
    expect(slowSegment).toBeInTheDocument();

    const fastSegment = screen.getByTitle(/Fast: Fast part 1/);
    expect(fastSegment).toBeInTheDocument();
  });
});
