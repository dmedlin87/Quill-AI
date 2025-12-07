import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings store
const mockSetBudgetThreshold = vi.fn();
vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: () => ({
    budgetThreshold: 1.0,
    setBudgetThreshold: mockSetBudgetThreshold,
  }),
}));

import { BudgetSelector } from '@/features/settings/components/BudgetSelector';

describe('BudgetSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label and description', () => {
    render(<BudgetSelector />);
    
    expect(screen.getByText('Session Warning Threshold')).toBeInTheDocument();
    expect(screen.getByText(/usage badge will highlight/i)).toBeInTheDocument();
  });

  it('renders preset amount buttons', () => {
    render(<BudgetSelector />);
    
    expect(screen.getByRole('button', { name: '$0.50' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '$1.00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '$5.00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '$10.00' })).toBeInTheDocument();
  });

  it('calls setBudgetThreshold when preset clicked', () => {
    render(<BudgetSelector />);
    
    fireEvent.click(screen.getByRole('button', { name: '$5.00' }));
    
    expect(mockSetBudgetThreshold).toHaveBeenCalledWith(5.0);
  });

  it('highlights currently selected threshold', () => {
    render(<BudgetSelector />);
    
    const selectedButton = screen.getByRole('button', { name: '$1.00' });
    expect(selectedButton.className).toContain('magic-100');
  });
});
