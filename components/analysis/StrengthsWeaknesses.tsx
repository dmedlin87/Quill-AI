import React from 'react';

interface Props {
    strengths: string[];
    weaknesses: string[];
}

export const StrengthsWeaknesses: React.FC<Props> = ({ strengths, weaknesses }) => {
  return (
    <div className="grid grid-cols-1 gap-6">
    <div>
        <h3 className="text-lg font-serif font-bold text-green-800 border-b border-green-100 pb-2 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Key Strengths
        </h3>
        {strengths && strengths.length > 0 ? (
            <ul className="space-y-2">
            {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-green-50/50 p-2 rounded border border-green-100">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{s}</span>
                </li>
            ))}
            </ul>
        ) : <p className="text-sm text-gray-500 italic">No specific strengths listed.</p>}
    </div>

    <div>
        <h3 className="text-lg font-serif font-bold text-red-800 border-b border-red-100 pb-2 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        Areas for Improvement
        </h3>
        {weaknesses && weaknesses.length > 0 ? (
            <ul className="space-y-2">
            {weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50/50 p-2 rounded border border-red-100">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{w}</span>
                </li>
            ))}
            </ul>
        ) : <p className="text-sm text-gray-500 italic">No specific weaknesses listed.</p>}
    </div>
  </div>
  );
};