import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IssueCard } from '@/features/analysis/components/IssueCard';

describe('IssueCard', () => {
  const defaultProps = {
    title: 'Test Issue',
    suggestion: 'This is a suggestion for fixing the issue',
  };

  describe('Basic Rendering', () => {
    it('renders title and suggestion text', () => {
      render(<IssueCard {...defaultProps} />);

      expect(screen.getByText('Test Issue')).toBeInTheDocument();
      expect(screen.getByText('This is a suggestion for fixing the issue')).toBeInTheDocument();
    });

    it('uses warning severity styles by default', () => {
      const { container } = render(<IssueCard {...defaultProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-l-4');
    });
  });

  describe('Severity Variants', () => {
    it('applies error severity styles', () => {
      const { container } = render(<IssueCard {...defaultProps} severity="error" />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('error');
    });

    it('applies warning severity styles', () => {
      const { container } = render(<IssueCard {...defaultProps} severity="warning" />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('warning');
    });

    it('applies info severity styles', () => {
      const { container } = render(<IssueCard {...defaultProps} severity="info" />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('interactive');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const handleClick = vi.fn();
      render(<IssueCard {...defaultProps} onClick={handleClick} />);

      fireEvent.click(screen.getByText('Test Issue'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not crash when onClick is undefined', () => {
      render(<IssueCard {...defaultProps} />);

      // Should not throw
      fireEvent.click(screen.getByText('Test Issue'));
    });
  });

  describe('Fix Button', () => {
    it('does not show fix button by default', () => {
      render(<IssueCard {...defaultProps} />);

      expect(screen.queryByText('✨ Fix with Agent')).not.toBeInTheDocument();
    });

    it('shows fix button when showFixButton is true and onFixClick is provided', () => {
      const handleFix = vi.fn();
      render(<IssueCard {...defaultProps} showFixButton={true} onFixClick={handleFix} />);

      expect(screen.getByText('✨ Fix with Agent')).toBeInTheDocument();
    });

    it('does not show fix button when showFixButton is true but onFixClick is not provided', () => {
      render(<IssueCard {...defaultProps} showFixButton={true} />);

      expect(screen.queryByText('✨ Fix with Agent')).not.toBeInTheDocument();
    });

    it('calls onFixClick when fix button is clicked', () => {
      const handleFix = vi.fn();
      const handleClick = vi.fn();
      render(
        <IssueCard
          {...defaultProps}
          onClick={handleClick}
          showFixButton={true}
          onFixClick={handleFix}
        />
      );

      fireEvent.click(screen.getByText('✨ Fix with Agent'));

      expect(handleFix).toHaveBeenCalledTimes(1);
    });

    it('passes event to onFixClick handler', () => {
      const handleFix = vi.fn();
      render(<IssueCard {...defaultProps} showFixButton={true} onFixClick={handleFix} />);

      fireEvent.click(screen.getByText('✨ Fix with Agent'));

      expect(handleFix).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('Styling', () => {
    it('has cursor-pointer class for clickability', () => {
      const { container } = render(<IssueCard {...defaultProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('cursor-pointer');
    });

    it('has hover transform styles', () => {
      const { container } = render(<IssueCard {...defaultProps} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('hover:translate-x-1');
    });
  });
});
