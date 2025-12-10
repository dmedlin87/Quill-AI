import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--interactive-accent)] text-[var(--text-inverse)]
    hover:bg-[var(--interactive-accent-hover)]
    shadow-sm border border-transparent
  `,
  secondary: `
    bg-[var(--surface-primary)] text-[var(--text-primary)]
    border border-[var(--border-secondary)]
    hover:bg-[var(--interactive-bg-hover)] hover:border-[var(--border-primary)]
    shadow-sm
  `,
  ghost: `
    bg-transparent text-[var(--text-secondary)]
    hover:bg-[var(--interactive-bg)] hover:text-[var(--text-primary)]
    border border-transparent
  `,
  danger: `
    bg-[var(--error-100)] text-[var(--error-500)]
    border border-[var(--error-500)]/30
    hover:bg-[var(--error-100)] hover:border-[var(--error-500)]
  `,
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[var(--text-xs)] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-[var(--text-sm)] gap-2 rounded-lg',
  lg: 'h-12 px-6 text-[var(--text-base)] gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center justify-center font-medium transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-none
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--interactive-accent)] focus-visible:ring-offset-2
    `;

    return (
      <motion.button
        ref={ref}
        whileTap={!disabled && !isLoading ? { scale: 0.98 } : undefined}
        className={`${baseClasses} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <span className="animate-spin mr-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </span>
        )}
        
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
