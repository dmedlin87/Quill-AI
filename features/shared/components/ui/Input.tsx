import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || React.useId();
    const descriptionId = `${inputId}-description`;
    const hasDescription = !!error || !!helperText;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {label}
            {props.required && <span className="text-[var(--error-500)] ml-0.5">*</span>}
          </label>
        )}
        
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none group-focus-within:text-[var(--interactive-accent)] transition-colors">
              {leftIcon}
            </div>
          )}
          
          <input
            id={inputId}
            ref={ref}
            aria-describedby={hasDescription ? descriptionId : undefined}
            aria-invalid={!!error}
            className={`
              w-full bg-[var(--surface-primary)] text-[var(--text-primary)]
              border border-[var(--border-secondary)] rounded-lg
              h-10 px-3 py-2 text-sm placeholder-[var(--text-muted)]
              transition-all duration-200
              focus:bg-[var(--surface-elevated)]
              focus:outline-none focus:ring-2 focus:ring-[var(--interactive-accent)]/20 focus:border-[var(--interactive-accent)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-9' : ''}
              ${rightIcon ? 'pr-9' : ''}
              ${error ? 'border-[var(--error-500)] focus:border-[var(--error-500)] focus:ring-[var(--error-500)]/20' : ''}
              ${className}
            `}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error ? (
          <p id={descriptionId} className="text-xs text-[var(--error-500)] mt-1 animate-slide-up">
            {error}
          </p>
        ) : helperText ? (
          <p id={descriptionId} className="text-xs text-[var(--text-tertiary)] mt-1">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || React.useId();
    const descriptionId = `${inputId}-description`;
    const hasDescription = !!error || !!helperText;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {label}
            {props.required && <span className="text-[var(--error-500)] ml-0.5">*</span>}
          </label>
        )}
        
        <textarea
          id={inputId}
          ref={ref}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-invalid={!!error}
          className={`
            w-full bg-[var(--surface-primary)] text-[var(--text-primary)]
            border border-[var(--border-secondary)] rounded-lg
            px-3 py-2 text-sm placeholder-[var(--text-muted)]
            transition-all duration-200
            focus:bg-[var(--surface-elevated)]
            focus:outline-none focus:ring-2 focus:ring-[var(--interactive-accent)]/20 focus:border-[var(--interactive-accent)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[var(--error-500)] focus:border-[var(--error-500)] focus:ring-[var(--error-500)]/20' : ''}
            ${className}
          `}
          {...props}
        />
        
        {error ? (
          <p id={descriptionId} className="text-xs text-[var(--error-500)] mt-1 animate-slide-up">
            {error}
          </p>
        ) : helperText ? (
          <p id={descriptionId} className="text-xs text-[var(--text-tertiary)] mt-1">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
