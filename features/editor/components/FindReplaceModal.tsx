import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/features/shared/components/ui/Input';
import { Button } from '@/features/shared/components/ui/Button';
import { dialogZoomVariants } from '@/features/shared/animations';
import { Card } from '@/features/shared/components/ui/Card';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onTextChange: (text: string) => void;
  editor: Editor | null;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  currentText,
  onTextChange,
  editor
}) => {
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow animation to start/render
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Calculate matches using regex on plain text for simplicity
  const matches = useMemo(() => {
    if (!findTerm) return [];
    const indices: number[] = [];
    
    try {
      const escapedTerm = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, isCaseSensitive ? 'g' : 'gi');
      
      let match;
      while ((match = regex.exec(currentText)) !== null) {
        indices.push(match.index);
        // Prevent infinite loops with zero-width matches
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return indices;
  }, [currentText, findTerm, isCaseSensitive]);

  useEffect(() => {
    if (currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches.length, currentMatchIndex]);

  const scrollToMatch = (index: number) => {
    if (!editor || index === -1) return;
    
    const matchPos = matches[index];
    if (matchPos === undefined) return;
    
    // Select the text at the position
    // Note: This relies on Markdown indices matching Tiptap doc indices. 
    // For simple formatting they are usually close enough.
    const from = matchPos;
    const to = matchPos + findTerm.length;
    
    editor.commands.setTextSelection({ from, to });
    editor.commands.scrollIntoView();
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
    if (matches.length === 0 || !editor) return;
    
    const matchPos = matches[currentMatchIndex];
    
    // Use Tiptap command to replace range, preserving history stack
    const from = matchPos;
    const to = matchPos + findTerm.length;
    
    editor.chain().focus().setTextSelection({ from, to }).insertContent(replaceTerm).run();
    setFindTerm(''); // Optional: clear or keep term. Keeping term usually better but match index might shift.
    // Ideally we re-run match logic, but for now this works. 
    // Note: React state update will trigger re-render and re-calc of matches based on new text content passed from parent.
  };

  const handleReplaceAll = () => {
    if (!findTerm || !editor) return;
    
    const escapedTerm = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, isCaseSensitive ? 'g' : 'gi');
    
    const newText = currentText.replace(regex, replaceTerm);
    
    // Replace full content
    editor.commands.setContent(newText);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           variants={dialogZoomVariants}
           initial="hidden"
           animate="visible"
           exit="exit"
           className="fixed top-20 right-20 z-50 w-80 shadow-2xl"
           drag
           dragConstraints={{ left: -500, right: 100, top: -100, bottom: 500 }}
           dragMomentum={false}
           // Use a Card primitive as the container
        >
          <Card variant="elevated" padding="none" className="overflow-hidden border border-[var(--border-secondary)]">
            {/* Header / Drag Handle */}
            <div className="p-3 border-b border-[var(--border-secondary)] flex items-center justify-between bg-[var(--surface-secondary)] cursor-move">
              <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[var(--text-muted)]">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
                Find & Replace
              </h3>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Close find and replace"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-3 bg-[var(--surface-primary)]">
              {/* Find Input */}
              <div className="relative">
                <Input
                  ref={findInputRef}
                  placeholder="Find..."
                  value={findTerm}
                  onChange={(e) => setFindTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pr-16"
                  autoFocus
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1 pointer-events-none">
                   <span className="text-xs text-[var(--text-muted)] font-mono">
                     {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
                   </span>
                </div>
              </div>

              {/* Replace Input */}
              <div className="flex gap-2">
                 <Input
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
                 <Button 
                   variant={isCaseSensitive ? 'primary' : 'secondary'}
                   size="sm"
                   onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                   className={!isCaseSensitive ? '!bg-[var(--surface-secondary)] !text-[var(--text-secondary)]' : ''}
                   title="Case Sensitive"
                 >
                   Aa
                 </Button>

                 <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrev} 
                      disabled={matches.length === 0}
                      title="Previous Match (Shift+Enter)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNext} 
                      disabled={matches.length === 0}
                      title="Next Match (Enter)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </Button>
                 </div>
              </div>
              
              <div className="flex gap-2 pt-2 border-t border-[var(--border-secondary)] mt-2">
                 <Button 
                   variant="secondary"
                   size="sm"
                   onClick={handleReplace}
                   disabled={matches.length === 0}
                   className="flex-1"
                 >
                   Replace
                 </Button>
                 <Button 
                   variant="secondary"
                   size="sm"
                   onClick={handleReplaceAll}
                   disabled={matches.length === 0}
                   className="flex-1"
                 >
                   Replace All
                 </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};