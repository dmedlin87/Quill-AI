import React, { useMemo } from 'react';
import * as Diff from 'diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  onAccept: () => void;
  onReject: () => void;
  description?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ 
  oldText, 
  newText, 
  onAccept, 
  onReject,
  description 
}) => {
  const diff = useMemo(() => {
    return Diff.diffWords(oldText, newText);
  }, [oldText, newText]);

  return (
    <div className="bg-white border border-indigo-100 rounded-lg shadow-lg overflow-hidden my-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-2">
          <span className="text-lg">✏️</span> Review Suggested Edit
        </h4>
        {description && <span className="text-xs text-indigo-600 italic truncate max-w-[200px]">{description}</span>}
      </div>
      
      <div className="p-4 bg-gray-50/50 max-h-60 overflow-y-auto font-serif text-sm leading-relaxed text-gray-800">
        {diff.map((part, index) => {
          const color = part.added ? 'bg-green-200 text-green-900' : part.removed ? 'bg-red-200 text-red-900 line-through decoration-red-900/50' : 'text-gray-600';
          return (
            <span key={index} className={`${color} px-0.5 rounded-sm`}>
              {part.value}
            </span>
          );
        })}
      </div>
      
      <div className="flex border-t border-gray-100 divide-x divide-gray-100">
        <button 
          onClick={onReject}
          className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
          Reject
        </button>
        <button 
          onClick={onAccept}
          className="flex-1 py-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
          Accept Change
        </button>
      </div>
    </div>
  );
};