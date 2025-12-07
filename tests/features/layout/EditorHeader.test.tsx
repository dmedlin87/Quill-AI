import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    header: ({ children, onMouseEnter, onMouseLeave, ...props }: any) => (
      <header onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...props}>
        {children}
      </header>
    ),
  },
  useReducedMotion: () => false,
}));

// Mock layout store
const mockSetHeaderHovered = vi.fn();
const mockUseLayoutStore = vi.fn();
vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: (selector: any) => selector(mockUseLayoutStore()),
}));

// Mock child components
vi.mock('@/features/shared', () => ({
  UsageBadge: () => <div data-testid="usage-badge">UsageBadge</div>,
}));
vi.mock('@/features/voice', () => ({
  VoiceCommandButton: () => <button data-testid="voice-btn">Voice</button>,
}));

import { EditorHeader } from '@/features/layout/EditorHeader';

describe('EditorHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutStore.mockReturnValue({
      isHeaderHovered: false,
      setHeaderHovered: mockSetHeaderHovered,
    });
  });

  it('renders UsageBadge and VoiceCommandButton', () => {
    render(<EditorHeader isZenMode={false} />);
    
    expect(screen.getByTestId('usage-badge')).toBeInTheDocument();
    expect(screen.getByTestId('voice-btn')).toBeInTheDocument();
  });

  it('has banner role', () => {
    render(<EditorHeader isZenMode={false} />);
    
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('calls setHeaderHovered on mouse enter in zen mode', () => {
    render(<EditorHeader isZenMode={true} />);
    
    fireEvent.mouseEnter(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).toHaveBeenCalledWith(true);
  });

  it('does not call setHeaderHovered on mouse enter outside zen mode', () => {
    render(<EditorHeader isZenMode={false} />);
    
    fireEvent.mouseEnter(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).not.toHaveBeenCalled();
  });

  it('calls setHeaderHovered(false) on mouse leave', () => {
    render(<EditorHeader isZenMode={true} />);
    
    fireEvent.mouseLeave(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).toHaveBeenCalledWith(false);
  });
});
