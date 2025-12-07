import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings store
const mockSetNativeSpellcheckEnabled = vi.fn();
let mockEnabled = false;

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: (selector: (state: any) => any) =>
    selector({
      nativeSpellcheckEnabled: mockEnabled,
      setNativeSpellcheckEnabled: mockSetNativeSpellcheckEnabled,
    }),
}));

import { NativeSpellcheckToggle } from '@/features/settings/components/NativeSpellcheckToggle';

describe('NativeSpellcheckToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled = false;
  });

  it('renders toggle button with label', () => {
    render(<NativeSpellcheckToggle />);
    
    expect(screen.getByRole('button', { name: /native spellcheck/i })).toBeInTheDocument();
  });

  it('shows disabled icon when spellcheck is off', () => {
    mockEnabled = false;
    render(<NativeSpellcheckToggle />);
    
    expect(screen.getByText('🚫')).toBeInTheDocument();
  });

  it('shows enabled icon when spellcheck is on', () => {
    mockEnabled = true;
    render(<NativeSpellcheckToggle />);
    
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('has aria-pressed matching enabled state', () => {
    mockEnabled = true;
    render(<NativeSpellcheckToggle />);
    
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles spellcheck when clicked', () => {
    mockEnabled = false;
    render(<NativeSpellcheckToggle />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(mockSetNativeSpellcheckEnabled).toHaveBeenCalledWith(true);
  });

  it('applies custom className', () => {
    render(<NativeSpellcheckToggle className="custom-class" />);
    
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('has tooltip with description', () => {
    render(<NativeSpellcheckToggle />);
    
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Toggle browser spellcheck, autocorrect, and autocomplete',
    );
  });
});
