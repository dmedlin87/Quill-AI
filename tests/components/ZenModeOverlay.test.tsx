import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZenModeOverlay } from '@/features/layout/ZenModeOverlay';
import { renderWithProviders } from '../helpers/renderWithProviders';

// Mock the layout store
const mockSetExitZenHovered = vi.fn();
const mockSetHeaderHovered = vi.fn();

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: vi.fn((selector) => {
    const state = {
      isExitZenHovered: false,
      setExitZenHovered: mockSetExitZenHovered,
      setHeaderHovered: mockSetHeaderHovered,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock framer-motion to simplify animation testing
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ZenModeOverlay', () => {
  const mockToggleZenMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('returns null when isZenMode is false', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={false} toggleZenMode={mockToggleZenMode} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders overlay when isZenMode is true', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      expect(screen.getByLabelText('Exit Zen Mode (Escape)')).toBeInTheDocument();
    });
  });

  describe('Header Hover Zone', () => {
    it('renders invisible hover zone at top', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const hoverZone = container.querySelector('.h-12.fixed.top-0');
      expect(hoverZone).toBeInTheDocument();
    });

    it('calls setHeaderHovered(true) on mouse enter', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const hoverZone = container.querySelector('.h-12.fixed.top-0') as HTMLElement;
      fireEvent.mouseEnter(hoverZone);

      expect(mockSetHeaderHovered).toHaveBeenCalledWith(true);
    });

    it('calls setHeaderHovered(true) on focus', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const hoverZone = container.querySelector('.h-12.fixed.top-0') as HTMLElement;
      fireEvent.focus(hoverZone);

      expect(mockSetHeaderHovered).toHaveBeenCalledWith(true);
    });

    it('has aria-hidden attribute', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const hoverZone = container.querySelector('.h-12.fixed.top-0');
      expect(hoverZone).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Exit Button', () => {
    it('renders exit button with correct aria-label', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      const button = screen.getByLabelText('Exit Zen Mode (Escape)');
      expect(button).toBeInTheDocument();
    });

    it('displays "Exit Zen" text', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      expect(screen.getByText('Exit Zen')).toBeInTheDocument();
    });

    it('calls toggleZenMode when clicked', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      fireEvent.click(screen.getByLabelText('Exit Zen Mode (Escape)'));

      expect(mockToggleZenMode).toHaveBeenCalledTimes(1);
    });

    it('calls setExitZenHovered(true) on mouse enter', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const exitContainer = container.querySelector('.fixed.bottom-6.right-6') as HTMLElement;
      fireEvent.mouseEnter(exitContainer);

      expect(mockSetExitZenHovered).toHaveBeenCalledWith(true);
    });

    it('calls setExitZenHovered(false) on mouse leave', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const exitContainer = container.querySelector('.fixed.bottom-6.right-6') as HTMLElement;
      fireEvent.mouseLeave(exitContainer);

      expect(mockSetExitZenHovered).toHaveBeenCalledWith(false);
    });

    it('calls setExitZenHovered(true) on button focus', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      const button = screen.getByLabelText('Exit Zen Mode (Escape)');
      fireEvent.focus(button);

      expect(mockSetExitZenHovered).toHaveBeenCalledWith(true);
    });

    it('calls setExitZenHovered(false) on button blur', () => {
      renderWithProviders(<ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />);

      const button = screen.getByLabelText('Exit Zen Mode (Escape)');
      fireEvent.blur(button);

      expect(mockSetExitZenHovered).toHaveBeenCalledWith(false);
    });
  });

  describe('Positioning', () => {
    it('positions exit button in bottom-right corner', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const exitContainer = container.querySelector('.fixed.bottom-6.right-6');
      expect(exitContainer).toBeInTheDocument();
    });

    it('applies high z-index for overlay visibility', () => {
      const { container } = renderWithProviders(
        <ZenModeOverlay isZenMode={true} toggleZenMode={mockToggleZenMode} />
      );

      const exitContainer = container.querySelector('.z-50');
      expect(exitContainer).toBeInTheDocument();
    });
  });
});
