import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Spinner, InlineSpinner, LoadingDots } from '@/features/shared/components/ui/Spinner';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

describe('Spinner', () => {
  describe('Default Rendering', () => {
    it('renders with default props', () => {
      render(<Spinner />);
      
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('renders screen reader text', () => {
      render(<Spinner />);
      
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });
  });

  describe('Size Prop', () => {
    it('renders xs size', () => {
      const { container } = render(<Spinner size="xs" />);
      
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-3', 'h-3');
    });

    it('renders sm size', () => {
      const { container } = render(<Spinner size="sm" />);
      
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-4', 'h-4');
    });

    it('renders md size (default)', () => {
      const { container } = render(<Spinner size="md" />);
      
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6');
    });

    it('renders lg size', () => {
      const { container } = render(<Spinner size="lg" />);
      
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Variant Prop', () => {
    it('renders default variant', () => {
      const { container } = render(<Spinner variant="default" />);
      
      const circles = container.querySelectorAll('circle');
      expect(circles[0]).toHaveClass('stroke-[var(--border-secondary)]');
      expect(circles[1]).toHaveClass('stroke-[var(--text-tertiary)]');
    });

    it('renders primary variant', () => {
      const { container } = render(<Spinner variant="primary" />);
      
      const circles = container.querySelectorAll('circle');
      expect(circles[0]).toHaveClass('stroke-[var(--interactive-accent)]/20');
      expect(circles[1]).toHaveClass('stroke-[var(--interactive-accent)]');
    });

    it('renders light variant', () => {
      const { container } = render(<Spinner variant="light" />);
      
      const circles = container.querySelectorAll('circle');
      expect(circles[0]).toHaveClass('stroke-white/20');
      expect(circles[1]).toHaveClass('stroke-white');
    });
  });

  describe('Label Prop', () => {
    it('renders label text', () => {
      render(<Spinner label="Loading data..." />);
      
      // Label appears both as visible text and in sr-only
      const labels = screen.getAllByText('Loading data...');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('updates aria-label when label provided', () => {
      render(<Spinner label="Custom loading" />);
      
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('does not render label span when label not provided', () => {
      const { container } = render(<Spinner />);
      
      // Only sr-only span should exist, not the label span
      const spans = container.querySelectorAll('span');
      expect(spans).toHaveLength(1);
      expect(spans[0]).toHaveClass('sr-only');
    });
  });

  describe('ClassName Prop', () => {
    it('accepts custom className', () => {
      const { container } = render(<Spinner className="custom-spinner" />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-spinner');
    });
  });
});

describe('InlineSpinner', () => {
  it('renders correctly', () => {
    const { container } = render(<InlineSpinner />);
    
    const span = container.firstChild;
    expect(span).toHaveClass('inline-block', 'animate-spin');
  });

  it('renders SVG inside', () => {
    const { container } = render(<InlineSpinner />);
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-4', 'h-4');
  });

  it('accepts custom className', () => {
    const { container } = render(<InlineSpinner className="text-red-500" />);
    
    const span = container.firstChild;
    expect(span).toHaveClass('text-red-500');
  });
});

describe('LoadingDots', () => {
  it('renders three dots', () => {
    const { container } = render(<LoadingDots />);
    
    const dots = container.querySelectorAll('span.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('each dot has correct styling', () => {
    const { container } = render(<LoadingDots />);
    
    const dots = container.querySelectorAll('span.rounded-full');
    dots.forEach(dot => {
      expect(dot).toHaveClass('w-1.5', 'h-1.5', 'bg-current');
    });
  });

  it('accepts custom className', () => {
    const { container } = render(<LoadingDots className="text-blue-500" />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('text-blue-500');
  });

  it('wrapper has flex layout', () => {
    const { container } = render(<LoadingDots />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('inline-flex', 'items-center', 'gap-1');
  });
});
