import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input, Textarea } from '@/features/shared/components/ui/Input';

describe('Input', () => {
  it('renders correctly with label', () => {
    render(<Input label="Username" id="username" />);
    // Use regex to match text even if asterisk is present (though it shouldn't be here)
    expect(screen.getByLabelText(/Username/)).toBeInTheDocument();
  });

  it('renders helper text when provided', () => {
    render(<Input label="Password" helperText="Must be at least 8 characters" />);
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('renders error instead of helper text when error is present', () => {
    render(<Input label="Password" helperText="Helper" error="Invalid password" />);
    expect(screen.getByText('Invalid password')).toBeInTheDocument();
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
  });

  it('shows required indicator when required prop is present', () => {
    render(<Input label="Email" required />);
    // Check for the asterisk or visual indicator.
    // We expect the label to contain the text "Email" and an asterisk
    const label = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'label' && content.includes('Email');
    });
    expect(label).toBeInTheDocument();
    expect(label.innerHTML).toContain('*');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('Textarea', () => {
  it('renders helper text when provided', () => {
    render(<Textarea label="Bio" helperText="Tell us about yourself" />);
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument();
  });

  it('shows required indicator when required prop is present', () => {
    render(<Textarea label="Description" required />);
    const label = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.includes('Description');
    });
    expect(label).toBeInTheDocument();
    expect(label.innerHTML).toContain('*');
  });
});
