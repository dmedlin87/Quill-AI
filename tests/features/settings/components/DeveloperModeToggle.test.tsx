import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeveloperModeToggle } from '@/features/settings/components/DeveloperModeToggle';

// Mock settings store
const mockSetDeveloperModeEnabled = vi.fn();
let mockDeveloperModeEnabled = false;

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      developerModeEnabled: mockDeveloperModeEnabled,
      setDeveloperModeEnabled: mockSetDeveloperModeEnabled,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

describe('DeveloperModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeveloperModeEnabled = false;
  });

  describe('Rendering', () => {
    it('renders checkbox input', () => {
      render(<DeveloperModeToggle />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('renders Developer Mode label', () => {
      render(<DeveloperModeToggle />);
      
      expect(screen.getByText('Developer Mode')).toBeInTheDocument();
    });

    it('renders Debug badge', () => {
      render(<DeveloperModeToggle />);
      
      expect(screen.getByText('Debug')).toBeInTheDocument();
    });
  });

  describe('State', () => {
    it('reflects unchecked state when disabled', () => {
      mockDeveloperModeEnabled = false;
      render(<DeveloperModeToggle />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('reflects checked state when enabled', () => {
      mockDeveloperModeEnabled = true;
      render(<DeveloperModeToggle />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('Interactions', () => {
    it('calls setDeveloperModeEnabled when toggled on', () => {
      mockDeveloperModeEnabled = false;
      render(<DeveloperModeToggle />);
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      expect(mockSetDeveloperModeEnabled).toHaveBeenCalledWith(true);
    });

    it('calls setDeveloperModeEnabled when toggled off', () => {
      mockDeveloperModeEnabled = true;
      render(<DeveloperModeToggle />);
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      expect(mockSetDeveloperModeEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('Styling', () => {
    it('accepts custom className', () => {
      const { container } = render(<DeveloperModeToggle className="custom-class" />);
      
      const label = container.querySelector('label');
      expect(label).toHaveClass('custom-class');
    });

    it('has cursor-pointer on label', () => {
      const { container } = render(<DeveloperModeToggle />);
      
      const label = container.querySelector('label');
      expect(label).toHaveClass('cursor-pointer');
    });
  });
});
