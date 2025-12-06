import React, { useMemo } from 'react';
import { calculateDiff } from '@/features/shared';

interface VisualDiffProps {
  original: string;
  modified: string;
  className?: string;
}

type DiffSegment = [-1 | 0 | 1, string];

export const VisualDiff: React.FC<VisualDiffProps> = ({ original, modified, className = '' }) => {
  const diffs = useMemo<DiffSegment[]>(
    () => calculateDiff(original, modified) as DiffSegment[],
    [original, modified],
  );

  return (
    <div className={`font-serif text-sm leading-relaxed whitespace-pre-wrap text-gray-800 ${className}`}>
      {diffs.map(([operation, text], index) => {
        switch (operation) {
          case -1:
            return (
              <span
                key={index}
                className="line-through bg-red-100 text-red-800 decoration-red-400 mx-0.5 rounded-sm px-0.5"
              >
                {text}
              </span>
            );
          case 1:
            return (
              <span
                key={index}
                className="bg-green-100 text-green-800 font-medium border-b border-green-200 mx-0.5 rounded-sm px-0.5"
              >
                {text}
              </span>
            );
          default:
            return (
              <span key={index} className="text-gray-600">
                {text}
              </span>
            );
        }
      })}
    </div>
  );
};