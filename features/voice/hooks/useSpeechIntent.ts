import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechIntentOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  mode?: 'text' | 'voice';
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return (window.SpeechRecognition || (window as any).webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
};

export const useSpeechIntent = (options: UseSpeechIntentOptions = {}) => {
  const { onTranscript, mode = 'voice' } = options;
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.continuous = false;
    recognizer.interimResults = true;

    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      let aggregated = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        aggregated += event.results[i][0].transcript;
      }
      setTranscript(aggregated.trim());
      onTranscript?.(aggregated.trim(), event.results[event.results.length - 1].isFinal);
    };

    recognizer.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      setIsListening(false);
    };

    recognizer.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognizer;
    setError(null);
    setTranscript('');
    setIsListening(true);
    recognizer.start();
  }, [onTranscript]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {
    start,
    stop,
    isListening,
    error,
    transcript,
    mode,
    supported: Boolean(getSpeechRecognition()),
  };
};
