import React from 'react';

/**
 * Headings use the theme's serif font family and tight tracking.
 */
export type HeadingVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: HeadingVariant;
  children: React.ReactNode;
}

const HEADING_STYLES: Record<HeadingVariant, string> = {
  h1: 'text-[var(--text-4xl)] font-semibold leading-tight',
  h2: 'text-[var(--text-3xl)] font-medium leading-tight',
  h3: 'text-[var(--text-2xl)] font-medium leading-snug',
  h4: 'text-[var(--text-xl)] font-medium leading-snug',
  h5: 'text-[var(--text-lg)] font-medium leading-normal',
  h6: 'text-[var(--text-base)] font-bold uppercase tracking-wide',
};

export const Heading: React.FC<HeadingProps> = ({ 
  variant = 'h2', 
  className = '', 
  children, 
  ...props 
}) => {
  const Component = variant;
  return (
    <Component 
      className={`font-serif text-[var(--text-primary)] ${HEADING_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

/**
 * Text uses the theme's UI font (usually sans-serif) for interface readability.
 * Use 'prose' variant for long-form content which might switch to serif in Parchment theme.
 */
export type TextVariant = 'body' | 'small' | 'muted' | 'label' | 'code' | 'prose';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  as?: React.ElementType;
  children: React.ReactNode;
}

const TEXT_STYLES: Record<TextVariant, string> = {
  body: 'text-[var(--text-base)] text-[var(--text-primary)] leading-normal',
  small: 'text-[var(--text-sm)] text-[var(--text-secondary)] leading-relaxed',
  muted: 'text-[var(--text-xs)] text-[var(--text-muted)]',
  label: 'text-[var(--text-xs)] font-bold text-[var(--text-tertiary)] uppercase tracking-wider',
  code: 'font-mono text-[var(--text-sm)] bg-[var(--interactive-bg)] px-1 py-0.5 rounded text-[var(--text-secondary)]',
  prose: 'text-[var(--prose-size)] font-serif leading-relaxed text-[var(--text-primary)] max-w-[65ch]',
};

export const Text: React.FC<TextProps> = ({ 
  variant = 'body', 
  as = 'p', 
  className = '', 
  children, 
  ...props 
}) => {
  const Component = as;
  return (
    <Component 
      className={`${TEXT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
