/**
 * Voice Session Hook
 * 
 * Extracts all audio processing and Gemini Live connection logic
 * from VoiceMode.tsx for clean separation of concerns.
 * 
 * Handles:
 * - Microphone input capture
 * - Audio playback scheduling
 * - Visual frequency analysis
 * - Gemini Live API connection
 */

import { useState, useRef, useCallback, useEffect, MutableRefObject } from 'react';
import { connectLiveSession, type LiveSessionClient } from '../services/gemini/audio';

export interface VolumeData {
  inputVolume: number;
  outputVolume: number;
  inputFrequency: Uint8Array | null;
  outputFrequency: Uint8Array | null;
}

export interface UseVoiceSessionResult {
  // State
  isConnected: boolean;
  isAiSpeaking: boolean;
  volumeData: VolumeData;
  error: string | null;
  
  // Actions
  startSession: () => Promise<void>;
  stopSession: () => void;
  
  // Refs for visualizer
  inputAnalyserRef: MutableRefObject<AnalyserNode | null>;
  outputAnalyserRef: MutableRefObject<AnalyserNode | null>;
}

export function useVoiceSession(): UseVoiceSessionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeData, setVolumeData] = useState<VolumeData>({
    inputVolume: 0,
    outputVolume: 0,
    inputFrequency: null,
    outputFrequency: null
  });

  // Connection state ref for use in animation loop (avoids stale closure)
  const isConnectedRef = useRef(false);
  const wasAiSpeakingRef = useRef(false);

  // Audio context refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionClientRef = useRef<LiveSessionClient | null>(null);

  // Audio scheduling
  const nextStartTimeRef = useRef<number>(0);

  // Visualization analyzers
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Stop the session and clean up all resources
   */
  const stopSession = useCallback(() => {
    // 1. Cancel animation loop first
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 2. Update refs immediately
    isConnectedRef.current = false;

    // 3. Update state
    setIsConnected(false);
    setIsAiSpeaking(false);
    setError(null);
    wasAiSpeakingRef.current = false;

    // 4. Cleanup input
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 5. Cleanup output
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // 6. Cleanup session
    if (sessionClientRef.current) {
      sessionClientRef.current.disconnect();
      sessionClientRef.current = null;
    }

    // 7. Reset analyser refs
    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
  }, []);

  /**
   * Internal visualization loop
   */
  const startVisualizer = useCallback(() => {
    const updateVolume = () => {
      if (
        !isConnectedRef.current ||
        !inputAnalyserRef.current ||
        !outputAnalyserRef.current
      ) {
        return;
      }

      const inputFreq = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
      inputAnalyserRef.current.getByteFrequencyData(inputFreq);

      const outputFreq = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      outputAnalyserRef.current.getByteFrequencyData(outputFreq);

      const getAvg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const inputVol = getAvg(inputFreq);
      const outputVol = getAvg(outputFreq);

      // Determine if AI is speaking
      const aiActive = outputVol > 10;

      // Only update state if changed
      if (aiActive !== wasAiSpeakingRef.current) {
        wasAiSpeakingRef.current = aiActive;
        setIsAiSpeaking(aiActive);
      }

      setVolumeData({
        inputVolume: inputVol,
        outputVolume: outputVol,
        inputFrequency: inputFreq,
        outputFrequency: outputFreq
      });

      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();
  }, []);

  /**
   * Start a new voice session
   */
  const startSession = useCallback(async () => {
    try {
      setError(null);

      // 1. Setup microphone input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000 
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Input analyser for visuals
      const inputAnalyser = audioContext.createAnalyser();
      inputAnalyser.fftSize = 512;
      inputAnalyser.smoothingTimeConstant = 0.8;
      inputAnalyserRef.current = inputAnalyser;
      source.connect(inputAnalyser);

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 2. Setup playback output
      const playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 24000 
      });
      playbackContextRef.current = playbackContext;
      nextStartTimeRef.current = playbackContext.currentTime;

      // Output analyser for visuals
      const outputAnalyser = playbackContext.createAnalyser();
      outputAnalyser.fftSize = 512;
      outputAnalyser.smoothingTimeConstant = 0.8;
      outputAnalyserRef.current = outputAnalyser;
      outputAnalyser.connect(playbackContext.destination);

      // 3. Connect to Gemini Live
      const client = await connectLiveSession(
        (audioBuffer) => {
          if (!playbackContextRef.current || !outputAnalyserRef.current) return;

          const ctx = playbackContextRef.current;
          const bufferSource = ctx.createBufferSource();
          bufferSource.buffer = audioBuffer;
          bufferSource.connect(outputAnalyserRef.current);

          const currentTime = ctx.currentTime;
          if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
          }

          bufferSource.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
        },
        () => {
          // Session ended callback
          stopSession();
        }
      );
      sessionClientRef.current = client;

      // 4. Handle input data
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        client.sendAudio(inputData);
      };

      isConnectedRef.current = true;
      setIsConnected(true);
      startVisualizer();

    } catch (e) {
      console.error('[useVoiceSession] Failed to start:', e);
      setError(e instanceof Error ? e.message : 'Failed to start voice session');
      stopSession();
    }
  }, [stopSession, startVisualizer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return {
    isConnected,
    isAiSpeaking,
    volumeData,
    error,
    startSession,
    stopSession,
    inputAnalyserRef,
    outputAnalyserRef
  };
}
