import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ZenModeOverlay } from '@/features/layout/ZenModeOverlay';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ZenModeOverlay', () => {
  beforeEach(() => {
    useLayoutStore.setState({ isExitZenHovered: false, isHeaderHovered: false });
  });

  it('returns null when zen mode is inactive', () => {
    const { container } = render(<ZenModeOverlay isZenMode={false} toggleZenMode={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders exit controls and toggles store hover state', () => {
    const toggleZenMode = vi.fn();
    const { container } = render(<ZenModeOverlay isZenMode toggleZenMode={toggleZenMode} />);

    // The first div is the hover zone
    const hoverZone = container.querySelector('div');
    expect(hoverZone).not.toBeNull();
    fireEvent.mouseEnter(hoverZone!);
    expect(useLayoutStore.getState().isHeaderHovered).toBe(true);

    // Also tests onFocus for header zone
    fireEvent.focus(hoverZone!);
    expect(useLayoutStore.getState().isHeaderHovered).toBe(true);

    const button = screen.getByRole('button', { name: /exit zen/i });
    fireEvent.mouseEnter(button);
    expect(useLayoutStore.getState().isExitZenHovered).toBe(true);

    fireEvent.click(button);
    expect(toggleZenMode).toHaveBeenCalled();
  });

  it('handles keyboard escape to exit', () => {
    const toggleZenMode = vi.fn();
    render(<ZenModeOverlay isZenMode toggleZenMode={toggleZenMode} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggleZenMode).toHaveBeenCalled();
  });

  it('updates hover state on focus/blur of button', () => {
    render(<ZenModeOverlay isZenMode toggleZenMode={vi.fn()} />);
    const button = screen.getByRole('button', { name: /exit zen/i });

    fireEvent.focus(button);
    expect(useLayoutStore.getState().isExitZenHovered).toBe(true);

    fireEvent.blur(button);
    expect(useLayoutStore.getState().isExitZenHovered).toBe(false);
  });
});
