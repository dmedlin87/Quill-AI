import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingConsistencySection } from '@/features/analysis/components/SettingConsistencySection';

describe('SettingConsistencySection', () => {
  const mockIssues = [
    {
      issue: 'Anachronism detected',
      suggestion: 'Remove "smartphone" in 1800s.',
      quote: 'He checked his smartphone.',
      alternatives: ['pocket watch', 'letter'],
    },
    {
        issue: 'Tone mismatch',
        suggestion: 'Use darker tone.',
        // No quote provided
    }
  ];

  const defaultProps = {
    issues: mockIssues,
    onQuoteClick: vi.fn(),
    score: 8.5,
  };

  it('renders score and description correctly (rounding up)', () => {
    render(<SettingConsistencySection {...defaultProps} />);
    expect(screen.getByText('Accuracy: 9/10')).toBeInTheDocument();
    // 9/10 is >= 8, so High score label
    expect(screen.getByLabelText(/Accuracy score 9 out of 10. Strong era fidelity./)).toBeInTheDocument();
  });

  it('renders medium score style', () => {
    render(<SettingConsistencySection {...defaultProps} score={6} />);
    const scoreBadge = screen.getByText('Accuracy: 6/10');
    expect(scoreBadge).toHaveClass('bg-yellow-100');
  });

  it('renders low score style', () => {
    render(<SettingConsistencySection {...defaultProps} score={4} />);
    const scoreBadge = screen.getByText('Accuracy: 4/10');
    expect(scoreBadge).toHaveClass('bg-red-100');
  });

  it('renders issues list with quotes and suggestions', () => {
    render(<SettingConsistencySection {...defaultProps} />);
    expect(screen.getByText('Anachronism detected')).toBeInTheDocument();
    expect(screen.getByText(/"He checked his smartphone."/)).toBeInTheDocument();
    expect(screen.getByText('Remove "smartphone" in 1800s.')).toBeInTheDocument();

    expect(screen.getByText('Tone mismatch')).toBeInTheDocument();
    expect(screen.getByText('No specific quote provided.')).toBeInTheDocument();
  });

  it('renders "No anachronisms detected" when list is empty', () => {
    render(<SettingConsistencySection {...defaultProps} issues={[]} />);
    expect(screen.getByText(/No anachronisms or tone mismatches detected/i)).toBeInTheDocument();
  });

  it('calls onQuoteClick when "Find in text" is clicked', () => {
    const onQuoteClick = vi.fn();
    render(<SettingConsistencySection {...defaultProps} onQuoteClick={onQuoteClick} />);

    const findButtons = screen.getAllByRole('button', { name: /find in text/i });
    fireEvent.click(findButtons[0]);

    expect(onQuoteClick).toHaveBeenCalledWith('He checked his smartphone.');
  });

  it('disables "Find in text" button if quote is missing', () => {
    const onQuoteClick = vi.fn();
    render(<SettingConsistencySection {...defaultProps} onQuoteClick={onQuoteClick} />);

    const findButtons = screen.getAllByRole('button', { name: /find in text/i });
    const noQuoteButton = findButtons[1]; // The second issue has no quote

    expect(noQuoteButton).toBeDisabled();

    fireEvent.click(noQuoteButton);
    expect(onQuoteClick).not.toHaveBeenCalled();
  });

  it('renders alternatives tags', () => {
    render(<SettingConsistencySection {...defaultProps} />);
    expect(screen.getByText('pocket watch')).toBeInTheDocument();
    expect(screen.getByText('letter')).toBeInTheDocument();
  });

  it('handles scores outside 0-10 range', () => {
    render(<SettingConsistencySection {...defaultProps} score={15} />);
    expect(screen.getByText('Accuracy: 10/10')).toBeInTheDocument();

    render(<SettingConsistencySection {...defaultProps} score={-5} />);
    expect(screen.getByText('Accuracy: 0/10')).toBeInTheDocument();
  });
});
