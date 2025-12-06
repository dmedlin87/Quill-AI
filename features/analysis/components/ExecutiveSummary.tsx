import React, { useCallback, useMemo } from 'react';
import { useTextToSpeech } from '@/features/voice';

export const ExecutiveSummary: React.FC<{ summary: string }> = ({ summary }) => {
  const { isPlaying, play, stop } = useTextToSpeech();
  const trimmedSummary = summary?.trim();
  const canPlay = Boolean(trimmedSummary);

  const buttonLabel = useMemo(
    () => (isPlaying ? 'Stop reading' : 'Read aloud'),
    [isPlaying]
  );
  const buttonTitle = canPlay ? buttonLabel : 'No summary available';

  const handleReadAloud = useCallback(() => {
    if (!canPlay) return;
    if (isPlaying) {
      stop();
    } else {
      play(trimmedSummary as string);
    }
  }, [canPlay, isPlaying, play, stop, trimmedSummary]);

  return (
    <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-serif font-bold text-indigo-900">Executive Summary</h3>
        <button 
          onClick={handleReadAloud}
          type="button"
          disabled={!canPlay}
          aria-pressed={isPlaying}
          aria-label={buttonLabel}
          className={`p-2 rounded-full transition-colors ${isPlaying ? 'text-indigo-600 bg-indigo-200 animate-pulse' : 'text-indigo-600 hover:bg-indigo-200'} ${!canPlay ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={buttonTitle}
        >
          {isPlaying ? (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
             </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
             </svg>
          )}
        </button>
      </div>
      <p className="text-indigo-800 leading-relaxed text-sm">
        {trimmedSummary || <span className="italic text-indigo-500">No summary available.</span>}
      </p>
    </div>
  );
};