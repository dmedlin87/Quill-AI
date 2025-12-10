import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelector } from '@/features/settings/components/ThemeSelector';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/features/layout/store/useLayoutStore');
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: any) => (
      <div className={className} onClick={onClick} data-testid="motion-div">
        {children}
      </div>
    ),
  },
}));

describe('ThemeSelector', () => {
  const mockToggleTheme = vi.fn();
  const mockSetVisualTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    (useLayoutStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
      const state = {
        theme: 'light',
        visualTheme: 'modern',
        toggleTheme: mockToggleTheme,
        setVisualTheme: mockSetVisualTheme,
      };
      return selector(state);
    });
  });

  it('renders correctly in light mode', () => {
    render(<ThemeSelector />);

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Light Mode')).toBeInTheDocument();
    expect(screen.getByText('Classic bright look')).toBeInTheDocument();

    // Check visual themes present
    expect(screen.getByText('Parchment')).toBeInTheDocument();
    expect(screen.getByText('Modern')).toBeInTheDocument();
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('renders correctly in dark mode', () => {
    (useLayoutStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
        const state = {
          theme: 'dark',
          visualTheme: 'modern',
          toggleTheme: mockToggleTheme,
          setVisualTheme: mockSetVisualTheme,
        };
        return selector(state);
      });

    render(<ThemeSelector />);

    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('Easy on the eyes')).toBeInTheDocument();
  });

  it('calls toggleTheme when mode toggle is clicked', () => {
    render(<ThemeSelector />);

    // The card has the onClick handler.
    fireEvent.click(screen.getByText('Light Mode'));

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('calls setVisualTheme when theme options are clicked', () => {
    render(<ThemeSelector />);

    // Click Parchment
    const parchmentOption = screen.getByText('Parchment');
    fireEvent.click(parchmentOption);
    expect(mockSetVisualTheme).toHaveBeenCalledWith('parchment');

    // Click Modern
    const modernOption = screen.getByText('Modern');
    fireEvent.click(modernOption);
    expect(mockSetVisualTheme).toHaveBeenCalledWith('modern');

    // Click Classic
    const classicOption = screen.getByText('Classic');
    fireEvent.click(classicOption);
    expect(mockSetVisualTheme).toHaveBeenCalledWith('classic');
  });

  it('displays the active visual theme with a checkmark/highlight', () => {
    // Already mocked as 'modern' in default beforeEach
    render(<ThemeSelector />);

    const modernLabel = screen.getByText('Modern');
    const modernCard = modernLabel.closest('.cursor-pointer');
    expect(modernCard?.className).toContain('ring-2');

    const parchmentLabel = screen.getByText('Parchment');
    const parchmentCard = parchmentLabel.closest('.cursor-pointer');
    expect(parchmentCard?.className).not.toContain('ring-2');
  });
});
