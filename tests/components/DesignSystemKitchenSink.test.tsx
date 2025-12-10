import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DesignSystemKitchenSink } from '@/features/shared/components/DesignSystemKitchenSink';

// Mock child components to isolate testing
vi.mock('@/features/shared/components/ui/Button', () => ({
  Button: ({ children, variant, size, leftIcon, rightIcon, isLoading }: any) => (
    <button data-variant={variant} data-size={size} data-loading={isLoading}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  ),
}));

vi.mock('@/features/shared/components/ui/Card', () => ({
  Card: ({ children, variant, padding }: any) => (
    <div data-testid="card" data-variant={variant} data-padding={padding}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/components/ui/Input', () => ({
  Input: ({ label, placeholder, leftIcon, error, defaultValue }: any) => (
    <div data-testid="input" data-label={label} data-error={error}>
      {leftIcon}
      <input placeholder={placeholder} defaultValue={defaultValue} />
    </div>
  ),
  Textarea: ({ label, placeholder }: any) => (
    <div data-testid="textarea" data-label={label}>
      <textarea placeholder={placeholder} />
    </div>
  ),
}));

vi.mock('@/features/shared/components/ui/Typography', () => ({
  Heading: ({ children, variant, className }: any) => (
    <h1 data-variant={variant} className={className}>{children}</h1>
  ),
  Text: ({ children, variant }: any) => (
    <p data-variant={variant}>{children}</p>
  ),
}));

vi.mock('@/features/shared/components/Icons', () => ({
  AgentIcon: ({ className }: any) => <span data-testid="agent-icon" className={className} />,
  WandIcon: ({ className }: any) => <span data-testid="wand-icon" className={className} />,
  ZenIcon: ({ className }: any) => <span data-testid="zen-icon" className={className} />,
}));

describe('DesignSystemKitchenSink', () => {
  describe('Rendering', () => {
    it('renders the component', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Design System Primitives')).toBeInTheDocument();
    });

    it('renders Typography section', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Typography')).toBeInTheDocument();
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });

    it('renders Buttons section', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Buttons')).toBeInTheDocument();
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByText('Ghost')).toBeInTheDocument();
      expect(screen.getByText('Danger')).toBeInTheDocument();
    });

    it('renders button sizes', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Large')).toBeInTheDocument();
    });

    it('renders buttons with icons', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Icon Left')).toBeInTheDocument();
      expect(screen.getByText('Icon Right')).toBeInTheDocument();
      expect(screen.getByText('Loading')).toBeInTheDocument();
      expect(screen.getByTestId('wand-icon')).toBeInTheDocument();
      expect(screen.getByTestId('agent-icon')).toBeInTheDocument();
    });

    it('renders Inputs section', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Inputs')).toBeInTheDocument();
      expect(screen.getAllByTestId('input')).toHaveLength(3);
      expect(screen.getByTestId('textarea')).toBeInTheDocument();
    });

    it('renders Cards section', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Cards')).toBeInTheDocument();
      expect(screen.getAllByTestId('card')).toHaveLength(4);
    });

    it('renders all card variants', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Flat Card')).toBeInTheDocument();
      expect(screen.getByText('Elevated Card')).toBeInTheDocument();
      expect(screen.getByText('Subtle Card')).toBeInTheDocument();
      expect(screen.getByText('Glass Card')).toBeInTheDocument();
    });
  });

  describe('Text Content', () => {
    it('renders body text sample', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText(/The quick brown fox/)).toBeInTheDocument();
    });

    it('renders muted text', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Muted text for secondary information.')).toBeInTheDocument();
    });

    it('renders code snippet sample', () => {
      render(<DesignSystemKitchenSink />);
      
      expect(screen.getByText('Code snippet style')).toBeInTheDocument();
    });
  });
});
