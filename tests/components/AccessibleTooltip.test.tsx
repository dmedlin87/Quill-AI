import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccessibleTooltip } from '@/features/shared/components/AccessibleTooltip';

describe('AccessibleTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders children', () => {
      render(
        <AccessibleTooltip content="Tooltip content">
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('does not show tooltip initially', () => {
      render(
        <AccessibleTooltip content="Tooltip content">
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Mouse Interactions', () => {
    it('shows tooltip on mouse enter after delay', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={200}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;
      fireEvent.mouseEnter(trigger);

      // Should not be visible immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Advance timers past delay
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Hide tooltip
      fireEvent.mouseLeave(trigger);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('cancels showing if mouse leaves before delay completes', () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={500}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Leave before delay completes
      fireEvent.mouseLeave(trigger);

      // Complete the delay
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('shows tooltip on focus', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Focus me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Focus me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.focus(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on blur', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Focus me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Focus me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.focus(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.blur(trigger);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dismisses tooltip on Escape key', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Focus me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Focus me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.focus(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Attributes', () => {
    it('uses aria-describedby when tooltip is visible', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Accessible button</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Accessible button').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const tooltip = screen.getByRole('tooltip');
      const innerTrigger = trigger.querySelector('[aria-describedby]');

      expect(innerTrigger).toHaveAttribute('aria-describedby', tooltip.id);
    });

    it('does not have aria-describedby when tooltip is hidden', () => {
      render(
        <AccessibleTooltip content="Tooltip content">
          <button>Accessible button</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Accessible button').closest('div[class*="relative"]') as HTMLElement;
      const innerTrigger = trigger.querySelector('div[aria-describedby]');

      expect(innerTrigger).toBeNull();
    });

    it('tooltip has role="tooltip"', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={0}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Position Props', () => {
    it('accepts position prop', () => {
      render(
        <AccessibleTooltip content="Tooltip content" position="top" showDelay={0}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Tooltip should be rendered (position classes tested via visual/integration tests)
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('accepts className prop', () => {
      const { container } = render(
        <AccessibleTooltip content="Tooltip content" className="custom-class">
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Custom Show Delay', () => {
    it('respects custom showDelay', async () => {
      render(
        <AccessibleTooltip content="Tooltip content" showDelay={500}>
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);

      // Not visible at 400ms
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Visible at 600ms
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('uses default delay of 200ms', async () => {
      render(
        <AccessibleTooltip content="Tooltip content">
          <button>Hover me</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover me').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);

      // Not visible at 100ms
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Visible at 250ms
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Content Types', () => {
    it('renders string content', async () => {
      render(
        <AccessibleTooltip content="Simple text" showDelay={0}>
          <button>Hover</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByText('Simple text')).toBeInTheDocument();
    });

    it('renders React node content', async () => {
      render(
        <AccessibleTooltip content={<span data-testid="custom-content">Custom JSX</span>} showDelay={0}>
          <button>Hover</button>
        </AccessibleTooltip>
      );

      const trigger = screen.getByText('Hover').closest('div[class*="relative"]') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });
});
