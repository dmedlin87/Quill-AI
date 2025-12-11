import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlotIssuesSection } from '@/features/analysis/components/PlotIssuesSection';
import { AnalysisResult } from '@/types';

type PlotIssue = AnalysisResult['plotIssues'][number];

describe('PlotIssuesSection', () => {
  const mockIssues: PlotIssue[] = [
    {
      issue: 'Timeline error',
      location: 'Chapter 2',
      suggestion: 'Check the dates.',
      quote: 'It was 1999...',
    },
    {
        issue: 'Logic gap',
        location: 'Scene 4',
        suggestion: 'Explain how he got there.',
    }
  ];

  const defaultProps = {
    issues: mockIssues,
    onQuoteClick: vi.fn(),
    onFixRequest: vi.fn(),
  };

  it('renders "No major plot holes" when issues list is empty', () => {
    render(<PlotIssuesSection {...defaultProps} issues={[]} />);
    expect(screen.getByText(/No major plot holes detected/i)).toBeInTheDocument();
  });

  it('renders plot issues correctly', () => {
    render(<PlotIssuesSection {...defaultProps} />);
    expect(screen.getByText('Timeline error')).toBeInTheDocument();
    expect(screen.getByText(/Chapter 2/)).toBeInTheDocument();
    expect(screen.getByText(/"It was 1999..."/)).toBeInTheDocument();
    expect(screen.getByText('Check the dates.')).toBeInTheDocument();

    expect(screen.getByText('Logic gap')).toBeInTheDocument();
    expect(screen.getByText(/Scene 4/)).toBeInTheDocument();
    expect(screen.getByText('Explain how he got there.')).toBeInTheDocument();
  });

  it('calls onQuoteClick when an issue with quote is clicked', () => {
    const onQuoteClick = vi.fn();
    render(<PlotIssuesSection {...defaultProps} onQuoteClick={onQuoteClick} />);

    const issueCard = screen.getByText('Timeline error').closest('div');
    fireEvent.click(issueCard!);

    expect(onQuoteClick).toHaveBeenCalledWith('It was 1999...');
  });

  it('shows "Go to text" tooltip on hover for issues with quotes', () => {
    // Note: We can check if the element exists in DOM since CSS opacity is visual
    render(<PlotIssuesSection {...defaultProps} />);
    expect(screen.getByText(/Go to text/)).toBeInTheDocument();
  });

  it('renders fix button and calls onFixRequest with correct context including quote', () => {
    const onFixRequest = vi.fn();
    render(<PlotIssuesSection {...defaultProps} onFixRequest={onFixRequest} />);

    const buttons = screen.getAllByText('✨ Fix with Agent');
    const firstButton = buttons[0]; // Corresponds to issue with quote

    fireEvent.click(firstButton);
    expect(onFixRequest).toHaveBeenCalledWith(
      '"It was 1999..." (Chapter 2)',
      'Check the dates.'
    );
  });

  it('renders fix button and calls onFixRequest with correct context without quote', () => {
      const onFixRequest = vi.fn();
      render(<PlotIssuesSection {...defaultProps} onFixRequest={onFixRequest} />);

      const buttons = screen.getAllByText('✨ Fix with Agent');
      const secondButton = buttons[1]; // Corresponds to issue without quote

      fireEvent.click(secondButton);
      expect(onFixRequest).toHaveBeenCalledWith(
        'Scene 4',
        'Explain how he got there.'
      );
    });
});
