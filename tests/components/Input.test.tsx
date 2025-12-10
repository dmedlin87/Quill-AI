import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input, Textarea } from '@/features/shared/components/ui/Input';

describe('Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<Input value="test value" onChange={() => {}} />);
      
      const input = screen.getByDisplayValue('test value');
      expect(input).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Username" />);
      
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Input label="Field 1" />);
      
      const input = container.querySelector('input');
      const label = container.querySelector('label');
      
      expect(input?.id).toBeTruthy();
      expect(label?.getAttribute('for')).toBe(input?.id);
    });

    it('uses provided id', () => {
      render(<Input id="custom-id" label="Custom" />);
      
      const input = screen.getByLabelText('Custom');
      expect(input).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('Icons', () => {
    it('renders with left icon', () => {
      const { container } = render(
        <Input leftIcon={<span data-testid="left-icon">🔍</span>} />
      );
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      
      // Check padding is applied
      const input = container.querySelector('input');
      expect(input).toHaveClass('pl-9');
    });

    it('renders with right icon', () => {
      const { container } = render(
        <Input rightIcon={<span data-testid="right-icon">❌</span>} />
      );
      
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      
      // Check padding is applied
      const input = container.querySelector('input');
      expect(input).toHaveClass('pr-9');
    });

    it('renders with both left and right icons', () => {
      const { container } = render(
        <Input 
          leftIcon={<span data-testid="left-icon">🔍</span>}
          rightIcon={<span data-testid="right-icon">❌</span>}
        />
      );
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      
      const input = container.querySelector('input');
      expect(input).toHaveClass('pl-9');
      expect(input).toHaveClass('pr-9');
    });
  });

  describe('Error State', () => {
    it('renders error message', () => {
      render(<Input error="This field is required" />);
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styling when error is present', () => {
      const { container } = render(<Input error="Invalid input" />);
      
      const input = container.querySelector('input');
      expect(input).toHaveClass('border-[var(--error-500)]');
      expect(input).toHaveClass('focus:border-[var(--error-500)]');
      expect(input).toHaveClass('focus:ring-[var(--error-500)]/20');
    });

    it('does not apply error styling when no error', () => {
      const { container } = render(<Input />);
      
      const input = container.querySelector('input');
      expect(input).not.toHaveClass('border-[var(--error-500)]');
    });
  });

  describe('States', () => {
    it('renders disabled state', () => {
      render(<Input disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50');
      expect(input).toHaveClass('disabled:cursor-not-allowed');
    });

    it('handles blur state', () => {
      const onBlur = vi.fn();
      const { container } = render(<Input onBlur={onBlur} />);
      
      const input = container.querySelector('input')!;
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when input value changes', () => {
      const onChange = vi.fn();
      render(<Input onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });
      
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('accepts custom className', () => {
      const { container } = render(<Input className="custom-class" />);
      
      const input = container.querySelector('input');
      expect(input).toHaveClass('custom-class');
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('allows programmatic focus via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });
});

describe('Textarea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with placeholder', () => {
      render(<Textarea placeholder="Enter description" />);
      
      expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<Textarea value="test content" onChange={() => {}} />);
      
      const textarea = screen.getByDisplayValue('test content');
      expect(textarea).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Textarea label="Description" />);
      
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Textarea label="Field 1" />);
      
      const textarea = container.querySelector('textarea');
      const label = container.querySelector('label');
      
      expect(textarea?.id).toBeTruthy();
      expect(label?.getAttribute('for')).toBe(textarea?.id);
    });

    it('uses provided id', () => {
      render(<Textarea id="custom-textarea-id" label="Custom" />);
      
      const textarea = screen.getByLabelText('Custom');
      expect(textarea).toHaveAttribute('id', 'custom-textarea-id');
    });
  });

  describe('Error State', () => {
    it('renders error message', () => {
      render(<Textarea error="Description is required" />);
      
      expect(screen.getByText('Description is required')).toBeInTheDocument();
    });

    it('applies error styling when error is present', () => {
      const { container } = render(<Textarea error="Invalid input" />);
      
      const textarea = container.querySelector('textarea');
      expect(textarea).toHaveClass('border-[var(--error-500)]');
      expect(textarea).toHaveClass('focus:border-[var(--error-500)]');
      expect(textarea).toHaveClass('focus:ring-[var(--error-500)]/20');
    });

    it('does not apply error styling when no error', () => {
      const { container } = render(<Textarea />);
      
      const textarea = container.querySelector('textarea');
      expect(textarea).not.toHaveClass('border-[var(--error-500)]');
    });
  });

  describe('States', () => {
    it('renders disabled state', () => {
      render(<Textarea disabled />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('disabled:opacity-50');
      expect(textarea).toHaveClass('disabled:cursor-not-allowed');
    });

    it('handles blur state', () => {
      const onBlur = vi.fn();
      const { container } = render(<Textarea onBlur={onBlur} />);
      
      const textarea = container.querySelector('textarea')!;
      fireEvent.focus(textarea);
      fireEvent.blur(textarea);
      
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when textarea value changes', () => {
      const onChange = vi.fn();
      render(<Textarea onChange={onChange} />);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'new content' } });
      
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('accepts custom className', () => {
      const { container } = render(<Textarea className="custom-textarea" />);
      
      const textarea = container.querySelector('textarea');
      expect(textarea).toHaveClass('custom-textarea');
    });

    it('supports rows attribute', () => {
      render(<Textarea rows={10} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '10');
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it('allows programmatic focus via ref', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });
});
