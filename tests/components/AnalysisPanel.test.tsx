import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AnalysisPanel } from '@/features/analysis/components/AnalysisPanel';
import { AnalysisResult } from '@/types';

const mockFindQuoteRange = vi.fn();

vi.mock('@/features/shared', () => ({
  findQuoteRange: (...args: unknown[]) => mockFindQuoteRange(...args),
}));

const baseAnalysis: AnalysisResult = {
  summary: 'A sweeping summary of the narrative.',
  strengths: [],
  weaknesses: [],
  pacing: {
    score: 7,
    analysis: 'Decent pace.',
    slowSections: [],
    fastSections: [],
  },
  settingAnalysis: {
    score: 6,
    analysis: 'Setting details.',
    issues: [
      {
        issue: 'Setting mismatch',
        suggestion: 'Align the location details.',
        quote: 'A futuristic café in 1800s Paris',
      },
    ],
  },
  plotIssues: [
    {
      issue: 'Pacing dip',
      location: 'Chapter 1',
      suggestion: 'Tighten the opening scene.',
      quote: 'The hero hesitates too long.',
    },
  ],
  characters: [],
  generalSuggestions: [],
};

describe('AnalysisPanel', () => {
  beforeEach(() => {
    mockFindQuoteRange.mockReset();
  });

  it('renders loading state', () => {
    render(
      <AnalysisPanel
        analysis={null}
        isLoading
        currentText=""
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Consulting the muse...')).toBeInTheDocument();
  });

  it('renders empty state when no analysis available', () => {
    render(
      <AnalysisPanel
        analysis={null}
        isLoading={false}
        currentText=""
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Run an analysis to reveal insights.')).toBeInTheDocument();
  });

  it('renders analysis content and supports navigation and fix actions', () => {
    const onNavigate = vi.fn();
    const onFixRequest = vi.fn();
    mockFindQuoteRange.mockReturnValue({ start: 10, end: 25 });

    render(
      <AnalysisPanel
        analysis={baseAnalysis}
        isLoading={false}
        currentText={'The hero hesitates too long.'}
        onNavigate={onNavigate}
        onFixRequest={onFixRequest}
      />
    );

    expect(screen.getByText('Pacing Score')).toBeInTheDocument();
    expect(screen.getByText('A sweeping summary of the narrative.')).toBeInTheDocument();
    expect(screen.getByText('Pacing dip')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pacing dip'));
    expect(onNavigate).toHaveBeenCalledWith(10, 25);

    const fixButtons = screen.getAllByText('✨ Fix with Agent');
    fireEvent.click(fixButtons[0]);
    expect(onFixRequest).toHaveBeenCalledWith('"The hero hesitates too long." (Chapter 1)', 'Tighten the opening scene.');
  });
});
