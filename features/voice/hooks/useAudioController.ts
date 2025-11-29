/**
 * Audio Controller Hook
 * 
 * Centralized audio lifecycle management with AbortController pattern.
 * Prevents race conditions, memory leaks, and ghost audio playback.
 */

import { useRef, useCallback, useEffect } from 'react';

export interface AudioNode {
  source: AudioBufferSourceNode;
  startTime: number;
  duration: number;
}

export interface AudioControllerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export interface AudioControllerOptions {
  sampleRate?: number;
  onStateChange?: (state: AudioControllerState) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Creates an audio controller with strict lifecycle management.
 * 
 * Features:
 * - Immediate stop on unmount or state change
 * - AbortController pattern for async operations
 * - Proper AudioContext cleanup
 * - Scheduled playback queue for streaming audio
 */
export function useAudioController(options: AudioControllerOptions = {}) {
  const { 
    sampleRate = 24000, 
    onStateChange, 
    onEnded,
    onError 
  } = options;

  // Refs for audio resources
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  /**
   * Creates or retrieves the AudioContext.
   * Handles suspended state from autoplay policies.
   */
  const getOrCreateContext = useCallback(async (): Promise<AudioContext> => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      // Resume if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API not supported in this environment.');
    }

    const ctx = new AudioContextCtor({ sampleRate });
    
    audioContextRef.current = ctx;
    nextStartTimeRef.current = ctx.currentTime;
    
    return ctx;
  }, [sampleRate]);

  /**
   * Immediately stops all audio playback and cleans up resources.
   */
  const stop = useCallback(() => {
    // Signal abort to any pending operations
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Stop and disconnect all active sources
    activeNodesRef.current.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Node may already be stopped
      }
    });
    activeNodesRef.current.clear();

    // Close the audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;

    onStateChange?.({ isPlaying: false, currentTime: 0, duration: 0 });
  }, [onStateChange]);

  /**
   * Plays an AudioBuffer immediately or queued for streaming.
   */
  const playBuffer = useCallback(async (
    buffer: AudioBuffer,
    { queue = false }: { queue?: boolean } = {}
  ): Promise<void> => {
    try {
      const ctx = await getOrCreateContext();
      
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      // Track active node
      activeNodesRef.current.add(source);
      source.onended = () => {
        activeNodesRef.current.delete(source);
        
        // Check if all nodes finished
        if (activeNodesRef.current.size === 0) {
          isPlayingRef.current = false;
          onEnded?.();
          onStateChange?.({ isPlaying: false, currentTime: 0, duration: 0 });
        }
      };

      if (queue) {
        // Scheduled playback for streaming
        const currentTime = ctx.currentTime;
        if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
        }
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;
      } else {
        // Immediate playback
        source.start();
      }

      isPlayingRef.current = true;
      onStateChange?.({ 
        isPlaying: true, 
        currentTime: 0, 
        duration: buffer.duration 
      });

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Audio playback failed');
      onError?.(error);
      throw error;
    }
  }, [getOrCreateContext, onEnded, onStateChange, onError]);

  /**
   * Plays audio from a URL.
   */
  const playUrl = useCallback(async (url: string): Promise<void> => {
    // Create new abort controller for this operation
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      const ctx = await getOrCreateContext();
      
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      if (signal.aborted) return;
      
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (signal.aborted) return;
      
      await playBuffer(audioBuffer);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Intentional abort, don't report as error
      }
      const error = err instanceof Error ? err : new Error('Failed to load audio');
      onError?.(error);
      throw error;
    }
  }, [getOrCreateContext, playBuffer, onError]);

  /**
   * Creates an AbortSignal for external async operations.
   * Useful for coordinating with API calls.
   */
  const createAbortSignal = useCallback((): AbortSignal => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  /**
   * Gets the raw AudioContext for advanced use cases.
   * Caller is responsible for not creating resource leaks.
   */
  const getContext = useCallback(async (): Promise<AudioContext> => {
    return getOrCreateContext();
  }, [getOrCreateContext]);

  /**
   * Enqueue an AudioBuffer for seamless streaming playback.
   */
  const enqueueBuffer = useCallback(async (buffer: AudioBuffer): Promise<void> => {
    await playBuffer(buffer, { queue: true });
  }, [playBuffer]);

  // Cleanup on unmount - CRITICAL for preventing ghost audio
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    // State
    isPlaying: isPlayingRef.current,
    
    // Core actions
    stop,
    playBuffer,
    playUrl,
    enqueueBuffer,
    
    // Utilities
    createAbortSignal,
    getContext,
  };
}

/**
 * Creates an AnalyserNode for audio visualization.
 * Must be used within an active AudioContext.
 */
export function createAnalyser(
  context: AudioContext, 
  options: { fftSize?: number; smoothing?: number } = {}
): AnalyserNode {
  const { fftSize = 512, smoothing = 0.8 } = options;
  
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothing;
  
  return analyser;
}
