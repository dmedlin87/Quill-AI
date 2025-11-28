import { useState, useRef, useEffect, useCallback } from 'react';
import { generateSpeech } from '../services/geminiService';

export function useTextToSpeech() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const stop = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async (text: string) => {
    stop(); // Stop any current playback
    setIsPlaying(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const audioBuffer = await generateSpeech(text);
      if (abortControllerRef.current?.signal.aborted) return;

      if (audioBuffer) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
            setIsPlaying(false);
            if (ctx.state !== 'closed') ctx.close();
            audioContextRef.current = null;
        };
        source.start();
      } else {
        throw new Error("Failed to generate audio");
      }
    } catch (e: any) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error(e);
      setError("Could not read text aloud.");
      setIsPlaying(false);
    }
  }, [stop]);

  return { isPlaying, error, play, stop };
}