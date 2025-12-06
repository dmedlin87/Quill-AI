import React, { memo, useMemo } from 'react';
import { useUsage } from '../context/UsageContext';
import { useSettingsStore } from '@/features/settings';
import { AccessibleTooltip } from './AccessibleTooltip';

type UsageTooltipContentProps = {
  promptTokens: number;
  responseTokens: number;
  totalRequestCount: number;
  sessionCost: number;
  totalCost: number;
  budgetThreshold: number;
};

/**
 * Render-only tooltip content separated to benefit from React.memo
 * and avoid re-rendering the tooltip when parent recalculates classes.
 */
const UsageTooltipContent = memo(function UsageTooltipContent({
  promptTokens,
  responseTokens,
  totalRequestCount,
  sessionCost,
  totalCost,
  budgetThreshold,
}: UsageTooltipContentProps): JSX.Element {
  return (
    <>
      <div className="flex justify-between mb-1">
        <span>Input:</span>
        <span className="font-mono">{promptTokens.toLocaleString()}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Output:</span>
        <span className="font-mono">{responseTokens.toLocaleString()}</span>
      </div>
      <div className="border-t border-[var(--ink-700)] pt-1 mt-1 flex justify-between text-[var(--magic-300)]">
        <span>Requests:</span>
        <span className="font-mono">{totalRequestCount}</span>
      </div>
      <div className="flex justify-between mt-1 text-[var(--magic-200)]">
        <span>Limit: ${budgetThreshold.toFixed(2)}</span>
        <span className="font-mono">${sessionCost.toFixed(4)}</span>
      </div>
      <div className="flex justify-between mt-1 text-[var(--magic-200)]">
        <span>Lifetime:</span>
        <span className="font-mono">${totalCost.toFixed(4)}</span>
      </div>
    </>
  );
});
UsageTooltipContent.displayName = 'UsageTooltipContent';

type UsageBadgeDerivedValues = {
  safeBudgetThreshold: number;
  totalTokens: number;
  budgetExceeded: boolean;
  mainCost: string;
  ariaLabel: string;
  buttonClassName: string;
};

/**
 * UsageBadge - Displays token usage and cost with accessible tooltip.
 * 
 * Accessibility:
 * - Tooltip shows on hover AND focus (keyboard accessible)
 * - Uses aria-describedby for screen readers
 * - Escape key dismisses tooltip
 * - Boundary detection prevents off-screen overflow
 */
export function UsageBadge(): JSX.Element | null {
  const { promptTokens, responseTokens, totalRequestCount, totalCost, sessionCost } = useUsage();
  const budgetThreshold = useSettingsStore((state) => state.budgetThreshold);

  if (totalRequestCount === 0) return null;

  /**
   * Derives all display-ready values in one memo to keep string formatting
   * stable across renders and minimize recomputation cost.
   */
  const derived: UsageBadgeDerivedValues = useMemo(() => {
    const safeBudget = Number.isFinite(budgetThreshold) ? budgetThreshold : 0;
    const tokens = promptTokens + responseTokens;
    const exceeded = sessionCost > safeBudget;
    const formattedCost = sessionCost.toFixed(2);
    const aria = `Token usage: ${tokens.toLocaleString()} tokens, cost: $${formattedCost}${
      exceeded ? ', budget exceeded' : ''
    }`;
    const buttonClass = `flex items-center gap-2 px-3 py-1.5 bg-[var(--parchment-50)] border rounded-full shadow-sm text-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--interactive-accent)] focus:ring-offset-1 ${
      exceeded
        ? 'border-[var(--error-300)] text-[var(--error-600)] hover:border-[var(--error-400)]'
        : 'border-[var(--ink-100)] text-[var(--ink-400)] hover:border-[var(--magic-300)]'
    }`;

    return {
      safeBudgetThreshold: safeBudget,
      totalTokens: tokens,
      budgetExceeded: exceeded,
      mainCost: formattedCost,
      ariaLabel: aria,
      buttonClassName: buttonClass,
    };
  }, [budgetThreshold, promptTokens, responseTokens, sessionCost]);

  const tooltipContent = useMemo<JSX.Element>(
    () => (
      <UsageTooltipContent
        promptTokens={promptTokens}
        responseTokens={responseTokens}
        totalRequestCount={totalRequestCount}
        sessionCost={sessionCost}
        totalCost={totalCost}
        budgetThreshold={derived.safeBudgetThreshold}
      />
    ),
    [derived.safeBudgetThreshold, promptTokens, responseTokens, sessionCost, totalCost, totalRequestCount]
  );

  return (
    <AccessibleTooltip
      position="bottom"
      showDelay={150}
      content={tooltipContent}
    >
      <button
        type="button"
        className={derived.buttonClassName}
        aria-label={derived.ariaLabel}
      >
        <div className="flex items-center gap-1">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor" 
            className="w-3 h-3 text-[var(--magic-500)]"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <span className="font-mono font-medium">{derived.totalTokens.toLocaleString()} tokens</span>
          <span className="font-mono text-[var(--ink-500)]">
            · ${derived.mainCost}
          </span>
          {derived.budgetExceeded && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-[var(--error-500)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--error-500)]" aria-hidden="true" />
              <span>high</span>
            </span>
          )}
        </div>
      </button>
    </AccessibleTooltip>
  );
};
