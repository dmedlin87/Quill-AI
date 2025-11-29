import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { PacingSection } from '@/features/analysis/components/PacingSection';

describe('PacingSection', () => {
  const basePacing = {
    score: 7,
    analysis: 'Generally solid pacing.',
    slowSections: ['The market scene in chapter 1 drags slightly.'],
    fastSections: ['The climax in chapter 12 rushes past key emotional beats.'],
  };

  const currentText = [
    'The market scene in chapter 1 drags slightly.',
    'The climax in chapter 12 rushes past key emotional beats.',
  ].join(' ');

  it('renders pacing score, analysis, and sections', () => {
    render(<PacingSection pacing={basePacing} currentText={currentText} />);

    expect(screen.getByText('Pacing & Flow')).toBeInTheDocument();
    expect(screen.getByText('Pacing Score')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('Generally solid pacing.')).toBeInTheDocument();

    expect(screen.getByText('Dragging Sections (Too Slow)')).toBeInTheDocument();
    expect(screen.getByText('Rushed Sections (Too Fast)')).toBeInTheDocument();

    expect(screen.getByText(basePacing.slowSections[0])).toBeInTheDocument();
    expect(screen.getByText(basePacing.fastSections[0])).toBeInTheDocument();
  });

  it('filters timeline and lists by pacing type', () => {
    render(<PacingSection pacing={basePacing} currentText={currentText} />);

    // Default shows both
    expect(screen.getByText(basePacing.slowSections[0])).toBeInTheDocument();
    expect(screen.getByText(basePacing.fastSections[0])).toBeInTheDocument();

    // Slow filter
    fireEvent.click(screen.getByText('Slow'));
    expect(screen.getByText(basePacing.slowSections[0])).toBeInTheDocument();
    expect(screen.queryByText(basePacing.fastSections[0])).not.toBeInTheDocument();

    // Fast filter
    fireEvent.click(screen.getByText('Fast'));
    expect(screen.getByText(basePacing.fastSections[0])).toBeInTheDocument();
    expect(screen.queryByText(basePacing.slowSections[0])).not.toBeInTheDocument();
  });

  it('shows empty state messages when no sections for selected filter', () => {
    const pacing = {
      score: 5,
      analysis: 'Neutral pacing.',
      slowSections: [],
      fastSections: [],
    };

    render(<PacingSection pacing={pacing} currentText="" />);

    expect(screen.getAllByText('None detected.')).toHaveLength(2);
    expect(screen.getByText('No issues detected in selected filter.')).toBeInTheDocument();
  });
});
