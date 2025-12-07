import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechIntent } from '@/features/voice/hooks/useSpeechIntent';

// Mock SpeechRecognition instances
let mockInstance: any = null;
const createMockRecognizer = () => ({
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onresult: null as any,
  onerror: null as any,
  onend: null as any,
  lang: '',
  continuous: false,
  interimResults: false,
});

class MockSpeechRecognition {
  start: any;
  stop: any;
  abort: any;
  onresult: any;
  onerror: any;
  onend: any;
  lang = '';
  continuous = false;
  interimResults = false;
  
  constructor() {
    mockInstance = createMockRecognizer();
    this.start = mockInstance.start;
    this.stop = mockInstance.stop;
    this.abort = mockInstance.abort;
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
    expect(mockInstance?.start).toHaveBeenCalled();
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
    expect(mockInstance?.stop).toHaveBeenCalled();
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

  it('returns mode from options', () => {
    const { result } = renderHook(() => useSpeechIntent({ mode: 'text' }));
    
    expect(result.current.mode).toBe('text');
  });

  it('defaults mode to voice', () => {
    const { result } = renderHook(() => useSpeechIntent());
    
    expect(result.current.mode).toBe('voice');
  });

  it('initially has empty transcript', () => {
    const { result } = renderHook(() => useSpeechIntent());
    
    expect(result.current.transcript).toBe('');
  });

  it('initially has no error', () => {
    const { result } = renderHook(() => useSpeechIntent());
    
    expect(result.current.error).toBeNull();
  });
});
