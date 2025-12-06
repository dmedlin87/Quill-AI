import React, { useMemo } from 'react';

type Issue = {
    quote?: string;
    issue: string;
    suggestion: string;
    alternatives?: string[];
};

interface Props {
    issues: Issue[];
    onQuoteClick: (quote?: string) => void;
    score: number;
}

const normalizeScore = (score: number) => Math.min(10, Math.max(0, Math.round(score)));

const getScoreTone = (score: number) => {
  if (score >= 8) return 'bg-green-100 text-green-700';
  if (score >= 5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const getScoreDescription = (score: number) => {
  if (score >= 8) return 'Strong era fidelity';
  if (score >= 5) return 'Mixed consistency';
  return 'High risk of mismatches';
};

export const SettingConsistencySection: React.FC<Props> = ({ issues, onQuoteClick, score }) => {
  const normalizedScore = useMemo(() => normalizeScore(score), [score]);
  const scoreTone = useMemo(() => getScoreTone(normalizedScore), [normalizedScore]);
  const scoreDescription = useMemo(() => getScoreDescription(normalizedScore), [normalizedScore]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <h3 className="text-lg font-serif font-bold text-gray-800">Setting &amp; Era Consistency</h3>
          <span 
            className={`px-2 py-0.5 rounded text-xs font-bold ${scoreTone}`}
            aria-label={`Accuracy score ${normalizedScore} out of 10. ${scoreDescription}.`}
          >
              Accuracy: {normalizedScore}/10
          </span>
      </div>
      
      {issues.length === 0 ? (
          <div className="p-4 bg-purple-50 text-purple-700 rounded-lg text-sm border border-purple-100 italic">
              No anachronisms or tone mismatches detected for this era.
          </div>
      ) : (
          <div className="space-y-4">
              {issues.map((item, idx) => {
                const quoteLabel = item.quote ?? 'Quote unavailable';
                return (
                  <div 
                    key={item.quote ?? idx} 
                    className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors"
                  >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400 group-hover:bg-purple-500 transition-colors"></div>
                      
                      {/* The Issue Header */}
                      <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900 text-sm">{item.issue}</h4>
                          <button 
                              type="button"
                              onClick={() => onQuoteClick(item.quote)}
                              className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!item.quote}
                              aria-label={`Find in text: ${quoteLabel}`}
                          >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                              Find in text
                          </button>
                      </div>

                      {/* Quote */}
                      <div className="mb-3 text-xs italic text-gray-500 border-l-2 border-purple-200 pl-3 bg-purple-50/30 py-1 rounded-r">
                          {item.quote ? `"${item.quote}"` : <span className="text-gray-400">No specific quote provided.</span>}
                      </div>

                      {/* Suggestion */}
                      <div className="text-xs text-gray-700 mb-2">
                          <strong>Fix: </strong> {item.suggestion}
                      </div>

                      {/* Alternatives / Fix Options */}
                      {item.alternatives && item.alternatives.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Suggested Alternatives</p>
                              <div className="flex flex-wrap gap-2">
                                  {item.alternatives.map((alt, i) => (
                                      <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">
                                          {alt}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
                );
              })}
          </div>
      )}
    </div>
  );
};