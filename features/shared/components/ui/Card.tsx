import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type CardVariant = 'flat' | 'elevated' | 'glass' | 'subtle';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLMotionProps<"div"> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: React.ReactNode;
}

const VARIANTS: Record<CardVariant, string> = {
  flat: `
    bg-[var(--surface-primary)] border border-[var(--border-primary)]
  `,
  elevated: `
    bg-[var(--card-bg)] shadow-md border border-[var(--border-subtle)]
  `,
  glass: `
    glass border border-[var(--glass-border)]
  `,
  subtle: `
    bg-[var(--surface-secondary)] border border-transparent
  `,
};

const PADDINGS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'elevated', padding = 'md', children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={`rounded-xl transition-colors duration-200 ${VARIANTS[variant]} ${PADDINGS[padding]} ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';
