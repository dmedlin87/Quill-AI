import React from 'react';
import { useUsage } from '../contexts/UsageContext';

export const UsageBadge: React.FC = () => {
  const { promptTokens, responseTokens, totalRequestCount } = useUsage();
  
  if (totalRequestCount === 0) return null;

  const total = promptTokens + responseTokens;

  return (
    <div className="group relative flex items-center gap-2 px-3 py-1.5 bg-[var(--parchment-50)] border border-[var(--ink-100)] rounded-full shadow-sm text-[10px] text-[var(--ink-400)] cursor-help hover:border-[var(--magic-300)] transition-colors">
      <div className="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-[var(--magic-500)]">
           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        <span className="font-mono font-medium">{total.toLocaleString()} tokens</span>
      </div>

      {/* Tooltip */}
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[var(--ink-900)] text-[var(--parchment-50)] p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 z-50">
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
         {/* Arrow */}
         <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[var(--ink-900)]"></div>
      </div>
    </div>
  );
};
