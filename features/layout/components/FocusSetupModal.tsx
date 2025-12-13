import React, { useState } from 'react';
import { FocusGoalType, useFocusStore } from '../store/useFocusStore';
import { useLayoutStore } from '../store/useLayoutStore'; // To exit zen mode if cancelled?
import { useEditor } from '@/features/shared';

interface FocusSetupModalProps {
  onClose: () => void;
}

export const FocusSetupModal: React.FC<FocusSetupModalProps> = ({ onClose }) => {
  const [goalType, setGoalType] = useState<FocusGoalType>('time');
  const [target, setTarget] = useState<string>('30'); // Default 30 mins

  const { startSession } = useFocusStore();
  const { currentText } = useEditor();

  const handleStart = () => {
    const numericTarget = parseInt(target, 10);
    if (isNaN(numericTarget) || numericTarget <= 0) return;

    // Calculate current word count
    const wordCount = currentText.split(/\s+/).filter(w => w.length > 0).length;

    startSession({
      goalType,
      goalTarget: numericTarget,
      currentWordCount: wordCount
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-elevated)] p-6 rounded-xl shadow-2xl max-w-md w-full border border-[var(--border-primary)] animate-scale-in">
        <h2 className="text-xl font-serif font-bold text-[var(--text-primary)] mb-4">
          Start Focus Session
        </h2>

        <div className="space-y-4 mb-6">
          <div className="flex gap-2 p-1 bg-[var(--surface-secondary)] rounded-lg">
            <button
              onClick={() => { setGoalType('time'); setTarget('30'); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                goalType === 'time'
                  ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Timer
            </button>
            <button
              onClick={() => { setGoalType('words'); setTarget('500'); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                goalType === 'words'
                  ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Word Goal
            </button>
            <button
              onClick={() => { setGoalType('none'); setTarget('0'); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                goalType === 'none'
                  ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Open Ended
            </button>
          </div>

          {goalType !== 'none' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {goalType === 'time' ? 'Duration (minutes)' : 'Word Count Target'}
              </label>
              <input
                type="number"
                min="1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--interactive-accent)] outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--interactive-bg)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-[var(--interactive-accent)] text-[var(--text-inverse)] font-medium rounded-lg hover:bg-[var(--interactive-accent-hover)] shadow-lg shadow-[var(--interactive-accent)]/20 transition-all active:scale-95"
          >
            Enter Zone
          </button>
        </div>
      </div>
    </div>
  );
};
