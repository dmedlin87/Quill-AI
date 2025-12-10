import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechIntent } from '@/features/voice/hooks/useSpeechIntent';

// Mock SpeechRecognition instances
let mockInstance: any = null;

// We need to capture the instance so we can trigger events on it
class MockSpeechRecognition {
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  
  constructor() {
    mockInstance = this;
  }
}

describe('useSpeechIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance = null;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
  });

  it('reports supported when SpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechIntent());
    expect(result.current.supported).toBe(true);
  });

  it('starts listening on start()', () => {
    const { result } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });
    expect(result.current.isListening).toBe(true);
    expect(mockInstance.start).toHaveBeenCalled();
  });

  it('stops listening on stop()', () => {
    const { result } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });
    expect(result.current.isListening).toBe(false);
    expect(mockInstance.stop).toHaveBeenCalled();
  });

  it('sets error when speech not supported and start called', () => {
    delete (window as any).SpeechRecognition;
    const { result } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });
    expect(result.current.error).toContain('not supported');
    expect(result.current.isListening).toBe(false);
  });

  it('aggregates transcript results', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechIntent({ onTranscript }));
    
    act(() => {
      result.current.start();
    });

    const mockEvent = {
      resultIndex: 0,
      results: [
        [{ transcript: 'Hello ' }],
        [{ transcript: 'world', isFinal: true }]
      ]
    };
    (mockEvent.results[1] as any).isFinal = true; // Add properties not in array

    act(() => {
      if (mockInstance.onresult) {
        mockInstance.onresult(mockEvent);
      }
    });

    expect(result.current.transcript).toBe('Hello world');
    expect(onTranscript).toHaveBeenCalledWith('Hello world', true);
  });

  it('handles errors during recognition', () => {
    const { result } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });

    act(() => {
        if (mockInstance.onerror) {
            mockInstance.onerror({ error: 'network' });
        }
    });

    expect(result.current.error).toBe('network');
    expect(result.current.isListening).toBe(false);
  });

  it('resets listening state on end', () => {
    const { result } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });

    act(() => {
        if (mockInstance.onend) {
            mockInstance.onend();
        }
    });

    expect(result.current.isListening).toBe(false);
  });

  it('aborts on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeechIntent());
    act(() => {
      result.current.start();
    });

    unmount();
    expect(mockInstance.abort).toHaveBeenCalled();
  });

  it('returns mode from options', () => {
    const { result } = renderHook(() => useSpeechIntent({ mode: 'text' }));
    expect(result.current.mode).toBe('text');
  });

  it('defaults mode to voice', () => {
    const { result } = renderHook(() => useSpeechIntent());
    expect(result.current.mode).toBe('voice');
  });
});
