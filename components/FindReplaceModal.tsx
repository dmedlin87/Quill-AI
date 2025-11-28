import React, { useState, useEffect, useMemo } from 'react';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onTextChange: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  currentText,
  onTextChange,
  textareaRef
}) => {
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      document.getElementById('find-input')?.focus();
      // Select all text in find input
      (document.getElementById('find-input') as HTMLInputElement)?.select();
    }
  }, [isOpen]);

  // Calculate matches
  const matches = useMemo(() => {
    if (!findTerm) return [];
    const indices: number[] = [];
    
    try {
      // Escape regex characters if we aren't using regex mode (not implemented yet, assuming literal)
      const escapedTerm = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, isCaseSensitive ? 'g' : 'gi');
      
      let match;
      while ((match = regex.exec(currentText)) !== null) {
        indices.push(match.index);
      }
    } catch (e) {
      console.error(e);
    }
    return indices;
  }, [currentText, findTerm, isCaseSensitive]);

  // Reset index when matches change
  useEffect(() => {
    if (currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches.length]);

  const scrollToMatch = (index: number) => {
    if (!textareaRef.current || index === -1) return;
    
    const matchPos = matches[index];
    if (matchPos === undefined) return;

    const textarea = textareaRef.current;
    
    textarea.focus();
    textarea.setSelectionRange(matchPos, matchPos + findTerm.length);
    
    // Simple scroll logic: estimate line height
    const textBefore = currentText.substring(0, matchPos);
    const lines = textBefore.split('\n').length;
    const lineHeight = 32; // Approx line height from CSS
    const scrollPos = Math.max(0, (lines - 1) * lineHeight - 150); // Center-ish
    
    textarea.scrollTop = scrollPos;
    // Trigger scroll event manually if needed for synced backdrop
    textarea.dispatchEvent(new Event('scroll'));
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const handleReplace = () => {
    if (matches.length === 0) return;
    
    const matchPos = matches[currentMatchIndex];
    const before = currentText.substring(0, matchPos);
    const after = currentText.substring(matchPos + findTerm.length);
    
    const newText = before + replaceTerm + after;
    onTextChange(newText);
    
    // Stay at roughly the same position? 
    // The matches array will recalculate automatically.
  };

  const handleReplaceAll = () => {
    if (!findTerm) return;
    
    const escapedTerm = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, isCaseSensitive ? 'g' : 'gi');
    
    const newText = currentText.replace(regex, replaceTerm);
    onTextChange(newText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 right-8 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200 text-sm">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-lg drag-handle cursor-move">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          Find & Replace
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 space-y-3">
        {/* Find Input */}
        <div className="relative">
          <input
            id="find-input"
            type="text"
            className="w-full border border-gray-300 rounded-md py-1.5 pl-3 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Find..."
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
             <span className="text-xs text-gray-400 font-mono">
               {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
             </span>
          </div>
        </div>

        {/* Replace Input */}
        <div className="flex gap-2">
           <input
            type="text"
            className="flex-1 border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Replace..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplace();
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-1">
           <button 
             onClick={() => setIsCaseSensitive(!isCaseSensitive)}
             className={`p-1.5 rounded text-xs font-medium border ${isCaseSensitive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700'}`}
             title="Case Sensitive"
           >
             Aa
           </button>

           <div className="flex items-center gap-2">
              <button 
                onClick={handlePrev} 
                disabled={matches.length === 0}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                title="Previous Match (Shift+Enter)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button 
                onClick={handleNext} 
                disabled={matches.length === 0}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                title="Next Match (Enter)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
           </div>
        </div>
        
        <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
           <button 
             onClick={handleReplace}
             disabled={matches.length === 0}
             className="flex-1 bg-white border border-gray-300 text-gray-700 py-1.5 rounded hover:bg-gray-50 text-xs font-medium disabled:opacity-50 transition-colors"
           >
             Replace
           </button>
           <button 
             onClick={handleReplaceAll}
             disabled={matches.length === 0}
             className="flex-1 bg-white border border-gray-300 text-gray-700 py-1.5 rounded hover:bg-gray-50 text-xs font-medium disabled:opacity-50 transition-colors"
           >
             Replace All
           </button>
        </div>
      </div>
    </div>
  );
};