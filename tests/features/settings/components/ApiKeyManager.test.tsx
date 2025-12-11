import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeyManager } from '@/features/settings/components/ApiKeyManager';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import React from 'react';

// Mock UI components
vi.mock('@/features/shared/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/components/ui/Input', () => ({
  Input: ({ value, onChange, type, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      type={type}
      {...props}
      data-testid="api-key-input"
    />
  ),
}));

vi.mock('@/features/shared/components/ui/Typography', () => ({
  Text: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock store
vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

describe('ApiKeyManager', () => {
  const setFreeApiKey = vi.fn();
  const setPaidApiKey = vi.fn();

  const defaultStore = {
    freeApiKey: '',
    paidApiKey: '',
    setFreeApiKey,
    setPaidApiKey,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore as any).mockImplementation((selector: any) => {
      // Simple selector emulation
      return selector(defaultStore);
    });
  });

  it('renders input fields for keys', () => {
    render(<ApiKeyManager />);
    expect(screen.getByText('Free Tier Key')).toBeInTheDocument();
    expect(screen.getByText('Paid Tier Key')).toBeInTheDocument();
  });

  it('displays warning when no keys are configured', () => {
    render(<ApiKeyManager />);
    expect(screen.getByText('No API Key Configured')).toBeInTheDocument();
  });

  it('updates free api key on input', () => {
    const { rerender } = render(<ApiKeyManager />);

    // Find the input for free key (first one)
    const inputs = screen.getAllByTestId('api-key-input');
    
    // Use fireEvent.change to simulate a single update event
    // since our mocked store doesn't actual update the 'value' prop on rerender
    const event = { target: { value: 'new-free-key' } };
    
    // We need to bypass the React SyntheticEvent wrapper if possible or just trigger change
    // userEvent is better but requires state updates. fireEvent is simpler here.
    const { fireEvent } = require('@testing-library/react');
    fireEvent.change(inputs[0], event);

    expect(setFreeApiKey).toHaveBeenCalledWith('new-free-key');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<ApiKeyManager />);

    // By default type is password (hidden)
    const inputs = screen.getAllByTestId('api-key-input');
    expect(inputs[0]).toHaveAttribute('type', 'password');

    // Click show button (eye icon)
    const toggleButton = screen.getAllByTitle('Show key')[0];
    await user.click(toggleButton);

    expect(inputs[0]).toHaveAttribute('type', 'text');
  });

  it('shows active status for configured key', () => {
     (useSettingsStore as any).mockImplementation((selector: any) => 
       selector({
         ...defaultStore,
         freeApiKey: 'valid-key-length-is-over-20-chars-long', // >20 chars needed
       })
     );
     
     render(<ApiKeyManager />);
     expect(screen.getByText('Free Mode')).toBeInTheDocument();
     expect(screen.getByText('Using free tier API key')).toBeInTheDocument();
  });

  it('shows paid mode if only paid key is configured', () => {
    (useSettingsStore as any).mockImplementation((selector: any) => 
      selector({
        ...defaultStore,
        paidApiKey: 'valid-paid-key-length-is-over-20-chars-long', 
      })
    );
    
    render(<ApiKeyManager />);
    expect(screen.getByText('Paid Mode')).toBeInTheDocument();
 });

 it('prioritizes free key if both are configured', () => {
    (useSettingsStore as any).mockImplementation((selector: any) => 
      selector({
        ...defaultStore,
        freeApiKey: 'valid-free-key-length-is-over-20-chars-long',
        paidApiKey: 'valid-paid-key-length-is-over-20-chars-long',
      })
    );
    
    render(<ApiKeyManager />);
    expect(screen.getByText('Free Mode')).toBeInTheDocument();
 });

  it('calls clear all keys', async () => {
    (useSettingsStore as any).mockImplementation((selector: any) => 
      selector({
        ...defaultStore,
        freeApiKey: 'some-key-long-enough-to-show-clear',
      })
    );

    const user = userEvent.setup();
    render(<ApiKeyManager />);

    const clearButton = screen.getByText('Clear All Keys');
    await user.click(clearButton);

    expect(setFreeApiKey).toHaveBeenCalledWith('');
    expect(setPaidApiKey).toHaveBeenCalledWith('');
  });
});
