import React, { useEffect, useState } from 'react';
import { useFocusStore } from '../store/useFocusStore';
import { useEditor } from '@/features/shared';

// Icons
const TimerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const WordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
);

export const FocusHUD: React.FC = () => {
  const {
    startTime,
    endTime,
    goalType,
    goalTarget,
    startWordCount,
    isSessionActive,
    updateCurrentWordCount
  } = useFocusStore();

  const { currentText } = useEditor();
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [wordsWritten, setWordsWritten] = useState(0);
  const [progress, setProgress] = useState(0);

  // Sync words and calculate progress
  useEffect(() => {
    if (!isSessionActive) return;

    const currentWords = currentText.split(/\s+/).filter(w => w.length > 0).length;
    updateCurrentWordCount(currentWords);

    const written = Math.max(0, currentWords - startWordCount);
    setWordsWritten(written);

    if (goalType === 'words' && goalTarget > 0) {
      setProgress(Math.min(100, (written / goalTarget) * 100));
    }
  }, [currentText, isSessionActive, startWordCount, goalType, goalTarget, updateCurrentWordCount]);

  // Timer logic
  useEffect(() => {
    if (!isSessionActive || !startTime) return;

    const tick = () => {
      const now = Date.now();

      if (goalType === 'time' && endTime) {
        // Countdown
        const diff = Math.max(0, endTime - now);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);

        const totalDuration = endTime - startTime;
        const elapsed = now - startTime;
        setProgress(Math.min(100, (elapsed / totalDuration) * 100));
      } else {
        // Count up
        const diff = now - startTime;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    };

    tick(); // immediate
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isSessionActive, startTime, endTime, goalType]);

  if (!isSessionActive) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex items-center gap-4 animate-fade-in pointer-events-none">
      <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-full px-4 py-2 shadow-lg flex items-center gap-4 backdrop-blur-md bg-opacity-80">
        {/* Timer Section */}
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <TimerIcon />
          <span className="font-mono text-sm font-medium">{timeLeft}</span>
        </div>

        <div className="w-px h-4 bg-[var(--border-primary)]" />

        {/* Word Count Section */}
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <WordIcon />
          <span className="text-sm font-medium">+{wordsWritten}</span>
        </div>

        {/* Progress Ring or Bar */}
        {goalType !== 'none' && (
           <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-primary)]">
             <div className="w-16 h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
               <div
                 className="h-full bg-[var(--interactive-accent)] transition-all duration-1000 ease-out"
                 style={{ width: `${progress}%` }}
               />
             </div>
             <span className="text-xs text-[var(--text-tertiary)] w-8 text-right">{Math.round(progress)}%</span>
           </div>
        )}
      </div>
    </div>
  );
};
