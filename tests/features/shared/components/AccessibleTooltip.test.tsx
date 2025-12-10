import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccessibleTooltip } from '@/features/shared/components/AccessibleTooltip';

describe('AccessibleTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children but not tooltip initially', () => {
    render(
      <AccessibleTooltip content="Tooltip Content">
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('shows tooltip after mouse enter and delay', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.mouseEnter(trigger);

    // Should not be visible immediately
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.mouseEnter(trigger);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus (keyboard navigation)', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.focus(trigger);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();
  });

  it('hides tooltip on blur', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.focus(trigger);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('dismisses tooltip on Escape key', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.focus(trigger);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('establishes aria-describedby relationship', () => {
    render(
      <AccessibleTooltip content="Tooltip Content" showDelay={200}>
        <button>Trigger</button>
      </AccessibleTooltip>
    );

    const triggerContainer = screen.getByText('Trigger').closest('div');
    expect(triggerContainer).not.toHaveAttribute('aria-describedby');

    fireEvent.mouseEnter(screen.getByText('Trigger'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(triggerContainer).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('clears timeout on unmount', () => {
      const { unmount } = render(
          <AccessibleTooltip content="Tooltip Content" showDelay={200}>
              <button>Trigger</button>
          </AccessibleTooltip>
      );

      const trigger = screen.getByText('Trigger');
      fireEvent.mouseEnter(trigger);

      unmount();

      // Should not throw or cause side effects if timer fires after unmount
      act(() => {
          vi.advanceTimersByTime(200);
      });
  });
});
