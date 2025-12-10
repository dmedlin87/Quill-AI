import React from 'react';
import { motion } from 'framer-motion';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
type SpinnerVariant = 'default' | 'primary' | 'light';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}

const SIZES: Record<SpinnerSize, { wrapper: string; stroke: number }> = {
  xs: { wrapper: 'w-3 h-3', stroke: 2 },
  sm: { wrapper: 'w-4 h-4', stroke: 2 },
  md: { wrapper: 'w-6 h-6', stroke: 2.5 },
  lg: { wrapper: 'w-8 h-8', stroke: 3 },
};

const VARIANTS: Record<SpinnerVariant, { track: string; spinner: string }> = {
  default: {
    track: 'stroke-[var(--border-secondary)]',
    spinner: 'stroke-[var(--text-tertiary)]',
  },
  primary: {
    track: 'stroke-[var(--interactive-accent)]/20',
    spinner: 'stroke-[var(--interactive-accent)]',
  },
  light: {
    track: 'stroke-white/20',
    spinner: 'stroke-white',
  },
};

/**
 * Spinner - Unified loading indicator component
 * 
 * Use this for consistent loading states across the application.
 * Prefer the Button component's built-in `isLoading` prop for button loading states.
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className = '',
  label,
}) => {
  const { wrapper, stroke } = SIZES[size];
  const { track, spinner } = VARIANTS[variant];

  return (
    <div 
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    >
      <motion.svg
        className={wrapper}
        viewBox="0 0 24 24"
        fill="none"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        {/* Track */}
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth={stroke}
          className={track}
          fill="none"
        />
        {/* Spinner arc */}
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth={stroke}
          className={spinner}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="62.83"
          strokeDashoffset="47.12"
        />
      </motion.svg>
      {label && (
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      )}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  );
};

/**
 * InlineSpinner - A minimal spinner for inline use (e.g., in buttons, text)
 */
export const InlineSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-block animate-spin ${className}`}>
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4" 
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
      />
    </svg>
  </span>
);

/**
 * LoadingDots - Animated dots for chat/typing indicators
 */
export const LoadingDots: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-1.5 h-1.5 bg-current rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: i * 0.1,
        }}
      />
    ))}
  </span>
);

export default Spinner;
