import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IssueCard } from '@/features/analysis/components/IssueCard';

describe('IssueCard', () => {
  const defaultProps = {
    title: 'Test Issue',
    suggestion: 'Consider fixing this.',
  };

  it('renders title and suggestion', () => {
    render(<IssueCard {...defaultProps} />);
    expect(screen.getByText('Test Issue')).toBeInTheDocument();
    expect(screen.getByText('Consider fixing this.')).toBeInTheDocument();
  });

  it('applies correct severity styles for warning (default)', () => {
    const { container } = render(<IssueCard {...defaultProps} />);
    const card = container.firstChild as HTMLElement;
    // Warning styles
    expect(card).toHaveClass('bg-[var(--warning-100)]');
    expect(card).toHaveClass('border-[var(--warning-500)]');
    const title = screen.getByRole('heading', { level: 5 });
    expect(title).toHaveClass('text-[var(--warning-500)]');
  });

  it('applies correct severity styles for error', () => {
    const { container } = render(<IssueCard {...defaultProps} severity="error" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-[var(--error-100)]');
    expect(card).toHaveClass('border-[var(--error-500)]');
  });

  it('applies correct severity styles for info', () => {
    const { container } = render(<IssueCard {...defaultProps} severity="info" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-[var(--interactive-bg-active)]');
    expect(card).toHaveClass('border-[var(--interactive-accent)]');
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<IssueCard {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByText('Test Issue'));
    expect(onClick).toHaveBeenCalled();
  });

  it('does not render fix button by default', () => {
    render(<IssueCard {...defaultProps} />);
    expect(screen.queryByText(/Fix with Agent/i)).not.toBeInTheDocument();
  });

  it('renders fix button when showFixButton is true and onFixClick is provided', () => {
    render(<IssueCard {...defaultProps} showFixButton={true} onFixClick={vi.fn()} />);
    expect(screen.getByText(/Fix with Agent/i)).toBeInTheDocument();
  });

  it('calls onFixClick and stops propagation when fix button is clicked', () => {
    const onFixClick = vi.fn();
    const onCardClick = vi.fn();

    render(
      <IssueCard
        {...defaultProps}
        showFixButton={true}
        onFixClick={onFixClick}
        onClick={onCardClick}
      />
    );

    const fixButton = screen.getByText(/Fix with Agent/i);
    fireEvent.click(fixButton);

    expect(onFixClick).toHaveBeenCalled();
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
