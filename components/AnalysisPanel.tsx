import React from 'react';
import { AnalysisResult } from '../types';
import { findQuoteRange } from '../utils/textLocator';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  currentText: string;
  onNavigate: (start: number, end: number) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, isLoading, currentText, onNavigate }) => {
  
  const handleQuoteClick = (quote?: string) => {
    if (!quote) return;
    const range = findQuoteRange(currentText, quote);
    if (range) onNavigate(range.start, range.end);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
         <div className="w-8 h-8 border-2 border-[var(--magic-400)] border-t-transparent rounded-full animate-spin"></div>
         <p className="font-serif text-[var(--ink-500)] animate-pulse">Consulting the muse...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-[var(--ink-400)] font-serif italic">Run an analysis to reveal insights.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      
      {/* Score Card */}
      <div className="bg-gradient-to-br from-[var(--magic-100)] to-[var(--parchment-100)] rounded-[var(--radius-lg)] p-5 border border-[var(--magic-200)] shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--ink-600)]">Pacing Score</span>
          <span className="text-[var(--text-2xl)] font-bold text-[var(--magic-500)] font-serif">{analysis.pacing.score}</span>
        </div>
        <div className="h-1.5 bg-[var(--parchment-200)] rounded-full overflow-hidden">
           <div 
             className="h-full bg-gradient-to-r from-[var(--magic-400)] to-[var(--magic-300)] rounded-full transition-all duration-500"
             style={{ width: `${(analysis.pacing.score / 10) * 100}%` }}
           />
        </div>
      </div>

      <section>
        <h4 className="text-[var(--text-sm)] font-semibold text-[var(--ink-700)] mb-3">Executive Summary</h4>
        <p className="text-[var(--text-sm)] text-[var(--ink-600)] leading-relaxed font-serif">{analysis.summary}</p>
      </section>

      {/* Issues List */}
      <section>
        <h4 className="text-[var(--text-sm)] font-semibold text-[var(--ink-700)] mb-3">Detected Issues</h4>
        <div className="space-y-3">
          {analysis.plotIssues.map((issue, i) => (
             <div 
               key={i}
               onClick={() => handleQuoteClick(issue.quote)}
               className="p-3 bg-[var(--error-100)] border-l-4 border-[var(--error-500)] rounded-r-md cursor-pointer hover:translate-x-1 transition-transform"
             >
                <h5 className="text-[var(--text-sm)] font-semibold text-[var(--error-500)] mb-1">{issue.issue}</h5>
                <p className="text-[var(--text-xs)] text-[var(--ink-600)]">{issue.suggestion}</p>
             </div>
          ))}
          {analysis.settingAnalysis?.issues.map((issue, i) => (
             <div 
               key={`setting-${i}`}
               onClick={() => handleQuoteClick(issue.quote)}
               className="p-3 bg-[var(--warning-100)] border-l-4 border-[var(--warning-500)] rounded-r-md cursor-pointer hover:translate-x-1 transition-transform"
             >
                <h5 className="text-[var(--text-sm)] font-semibold text-[var(--warning-500)] mb-1">{issue.issue}</h5>
                <p className="text-[var(--text-xs)] text-[var(--ink-600)]">{issue.suggestion}</p>
             </div>
          ))}
        </div>
      </section>
    </div>
  );
};
