import React, { useMemo } from 'react';
import { calculateDiff } from '../utils/diffUtils';

interface VisualDiffProps {
  original: string;
  modified: string;
  className?: string;
}

export const VisualDiff: React.FC<VisualDiffProps> = ({ original, modified, className = '' }) => {
  const diffs = useMemo(() => calculateDiff(original, modified), [original, modified]);

  return (
    <div className={`font-serif text-sm leading-relaxed whitespace-pre-wrap text-gray-800 ${className}`}>
      {diffs.map((diff, index) => {
        // diff is [operation, text]
        // operation: -1 (delete), 0 (equal), 1 (insert)
        const operation = diff[0];
        const text = diff[1];

        if (operation === -1) {
          // DELETE
          return (
            <span 
              key={index} 
              className="line-through bg-red-100 text-red-800 decoration-red-400 mx-0.5 rounded-sm px-0.5"
            >
              {text}
            </span>
          );
        }

        if (operation === 1) {
          // INSERT
          return (
            <span 
              key={index} 
              className="bg-green-100 text-green-800 font-medium border-b border-green-200 mx-0.5 rounded-sm px-0.5"
            >
              {text}
            </span>
          );
        }

        // EQUAL
        return <span key={index} className="text-gray-600">{text}</span>;
      })}
    </div>
  );
};