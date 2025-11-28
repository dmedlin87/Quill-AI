import React from 'react';

interface Props {
    issues: Array<{
        issue: string;
        location: string;
        suggestion: string;
    }>
}

export const PlotIssuesSection: React.FC<Props> = ({ issues }) => {
  return (
    <div>
    <h3 className="text-lg font-serif font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Plot Analysis</h3>
    {issues.length === 0 ? (
        <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">No major plot holes detected. Great job!</div>
    ) : (
        <div className="space-y-4">
            {issues.map((issue, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-red-100 shadow-sm relative overflow-hidden group hover:border-red-200 transition-colors">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 group-hover:bg-red-500 transition-colors"></div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{issue.issue}</h4>
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {issue.location}
                    </p>
                    <div className="bg-red-50 p-3 rounded text-xs text-red-800">
                        <strong>Fix: </strong> {issue.suggestion}
                    </div>
                </div>
            ))}
        </div>
    )}
  </div>
  );
};