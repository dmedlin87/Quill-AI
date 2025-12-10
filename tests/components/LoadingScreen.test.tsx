import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoadingScreen } from '@/features/shared/components/LoadingScreen';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
  },
}));

describe('LoadingScreen', () => {
  describe('Default Rendering', () => {
    it('renders with default message', () => {
      render(<LoadingScreen />);
      
      expect(screen.getByText('Preparing your writing space...')).toBeInTheDocument();
    });

    it('renders with full variant by default', () => {
      const { container } = render(<LoadingScreen />);
      
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv.className).toContain('h-screen');
      expect(mainDiv.className).toContain('fixed');
    });

    it('renders keyboard shortcut tip', () => {
      render(<LoadingScreen />);
      
      // The tip contains a kbd element with Ctrl+K
      expect(screen.getByText(/Tip:/)).toBeInTheDocument();
    });
  });

  describe('Message Props', () => {
    it('renders custom message', () => {
      render(<LoadingScreen message="Loading your project..." />);
      
      expect(screen.getByText('Loading your project...')).toBeInTheDocument();
    });

    it('renders subMessage when provided', () => {
      render(<LoadingScreen subMessage="This may take a moment" />);
      
      expect(screen.getByText('This may take a moment')).toBeInTheDocument();
    });

    it('does not render subMessage when not provided', () => {
      render(<LoadingScreen />);
      
      expect(screen.queryByText('This may take a moment')).not.toBeInTheDocument();
    });
  });

  describe('Variant Prop', () => {
    it('renders inline variant without fixed positioning', () => {
      const { container } = render(<LoadingScreen variant="inline" />);
      
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv.className).toContain('min-h-[200px]');
      expect(mainDiv.className).not.toContain('fixed');
    });

    it('renders full variant with fixed positioning', () => {
      const { container } = render(<LoadingScreen variant="full" />);
      
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv.className).toContain('fixed');
      expect(mainDiv.className).toContain('inset-0');
    });
  });

  describe('Visual Elements', () => {
    it('renders the quill SVG icon', () => {
      const { container } = render(<LoadingScreen />);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders the progress bar container', () => {
      const { container } = render(<LoadingScreen />);
      
      // Progress bar has rounded-full overflow-hidden classes
      const progressBar = container.querySelector('.rounded-full.overflow-hidden');
      expect(progressBar).toBeInTheDocument();
    });
  });
});
