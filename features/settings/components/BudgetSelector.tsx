import { useSettingsStore } from '../store/useSettingsStore';

const PRESET_AMOUNTS: readonly number[] = [0.5, 1.0, 5.0, 10.0];

export function BudgetSelector(): JSX.Element {
  const { budgetThreshold, setBudgetThreshold } = useSettingsStore();

  return (
    <div className="flex flex-col gap-2 bg-[var(--parchment-50)] border border-[var(--ink-100)] rounded-lg p-3">
      <label className="text-xs font-medium text-[var(--ink-500)]">
        Session Warning Threshold
      </label>
      <p className="text-[10px] text-[var(--ink-400)] mb-1">
        When your session cost exceeds this amount, the usage badge will highlight activity as "high".
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setBudgetThreshold(amount)}
            className={`px-3 py-1 text-[10px] rounded-full border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--magic-400)] ${
              budgetThreshold === amount
                ? 'bg-[var(--magic-100)] border-[var(--magic-400)] text-[var(--magic-700)]'
                : 'bg-transparent border-[var(--ink-200)] text-[var(--ink-500)] hover:border-[var(--magic-300)]'
            }`}
          >
            ${amount.toFixed(2)}
          </button>
        ))}
      </div>
    </div>
  );
}
