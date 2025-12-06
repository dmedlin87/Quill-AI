import React from 'react';

type IssueSeverity = 'error' | 'warning' | 'info';

interface IssueCardProps {
  title: string;
  suggestion: string;
  severity?: IssueSeverity;
  onClick?: () => void;
  onFixClick?: (e: React.MouseEvent) => void;
  showFixButton?: boolean;
}

const severityStyles: Record<IssueSeverity, { bg: string; border: string; title: string }> = {
  error: {
    bg: 'bg-[var(--error-100)]',
    border: 'border-[var(--error-500)]',
    title: 'text-[var(--error-500)]',
  },
  warning: {
    bg: 'bg-[var(--warning-100)]',
    border: 'border-[var(--warning-500)]',
    title: 'text-[var(--warning-500)]',
  },
  info: {
    bg: 'bg-[var(--interactive-bg-active)]',
    border: 'border-[var(--interactive-accent)]',
    title: 'text-[var(--interactive-accent)]',
  },
};

/**
 * IssueCard - A presentational component for displaying analysis issues.
 * Uses CSS transitions instead of framer-motion for better list performance.
 */
export const IssueCard: React.FC<IssueCardProps> = ({
  title,
  suggestion,
  severity = 'warning',
  onClick,
  onFixClick,
  showFixButton = false,
}) => {
  const styles = severityStyles[severity];
  const handleFixButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onFixClick?.(e);
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-3 ${styles.bg} border-l-4 ${styles.border} rounded-r-md 
        cursor-pointer transition-transform duration-150 ease-out
        hover:translate-x-1 active:translate-x-0
      `}
    >
      <h5 className={`text-[var(--text-sm)] font-semibold ${styles.title} mb-1`}>
        {title}
      </h5>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
          {suggestion}
        </p>
        {showFixButton && onFixClick && (
          <button
            onClick={handleFixButtonClick}
            className="shrink-0 px-2 py-1 bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] text-[var(--text-inverse)] rounded text-[10px] font-medium transition-all duration-150 hover:scale-105 active:scale-95 flex items-center gap-1"
          >
            ✨ Fix with Agent
          </button>
        )}
      </div>
    </div>
  );
};
