import React from 'react';

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
}

/**
 * ScoreCard - A simple, presentational component for displaying scores.
 * Uses CSS transitions instead of framer-motion for better performance.
 */
export const ScoreCard: React.FC<ScoreCardProps> = ({
  label,
  score,
  maxScore = 10
}) => {
  const safeMax = maxScore > 0 ? maxScore : 1;
  const safeScore = Number.isFinite(score) ? score : 0;
  const percentage = Math.min(
    Math.max((safeScore / safeMax) * 100, 0),
    100
  );

  return (
    <div
      className="bg-gradient-to-br from-[var(--interactive-bg-active)] to-[var(--surface-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--glass-border)] shadow-sm animate-fade-in"
      aria-label={`${label} score ${safeScore} of ${safeMax}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-[var(--text-sm)] font-semibold text-[var(--text-secondary)]">
          {label}
        </span>
        <span
          className="text-[var(--text-2xl)] font-bold text-[var(--interactive-accent)] font-serif transition-transform duration-300 hover:scale-110"
        >
          {safeScore}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--interactive-accent)] to-[var(--interactive-accent-hover)] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
