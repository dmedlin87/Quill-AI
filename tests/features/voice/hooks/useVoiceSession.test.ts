import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVoiceSession } from '@/features/voice/hooks/useVoiceSession';

// Mock audio processor
const mockAudioWorkletNodeImpl = {
  port: {
    onmessage: null as any,
    close: vi.fn(),
    postMessage: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

let audioContextCreateCount = 0;
let workletCreateCount = 0;

class MockAudioWorkletNode {
    port = mockAudioWorkletNodeImpl.port;
    constructor() {
      workletCreateCount += 1;
    }
    connect() { return mockAudioWorkletNodeImpl.connect(); }
    disconnect() { return mockAudioWorkletNodeImpl.disconnect(); }
}

const mockAudioContextImpl = {
  state: 'running',
  close: vi.fn(),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  createAnalyser: vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  })),
  audioWorklet: {
    addModule: vi.fn().mockResolvedValue(undefined),
  },
  destination: {},
  currentTime: 0,
};

class MockAudioContext {
    state = 'running';
    audioWorklet = mockAudioContextImpl.audioWorklet;
    destination = {};
    currentTime = 0;

    constructor() {
      audioContextCreateCount += 1;
    }
    close() { return mockAudioContextImpl.close(); }
    createMediaStreamSource(s: any) { return mockAudioContextImpl.createMediaStreamSource(s); }
    createAnalyser() { return mockAudioContextImpl.createAnalyser(); }
    createBufferSource() { return mockAudioContextImpl.createBufferSource(); }
}

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
};

const mockLiveSessionClient = {
  sendAudio: vi.fn(),
  disconnect: vi.fn(),
};

// Mock dependencies
vi.mock('@/services/gemini/audio', () => ({
  connectLiveSession: vi.fn(() => Promise.resolve(mockLiveSessionClient)),
}));

describe('useVoiceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    audioContextCreateCount = 0;
    workletCreateCount = 0;

    // Reset mocks
    mockAudioContextImpl.audioWorklet.addModule.mockResolvedValue(undefined);
    mockAudioContextImpl.close.mockResolvedValue(undefined);

    // Mock AudioContext & AudioWorkletNode
    (window as any).AudioContext = MockAudioContext;
    (window as any).webkitAudioContext = MockAudioContext;
    (window as any).AudioWorkletNode = MockAudioWorkletNode;

    // Mock getUserMedia
    const mediaDevicesMock = {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    };
    (global.navigator as any).mediaDevices = mediaDevicesMock;

    // Mock requestAnimationFrame
    let animationFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        const id = animationFrameId++;
        setTimeout(() => cb(id), 0);
        return id as any;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        clearTimeout(id);
    });
  });

  afterEach(() => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
    delete (window as any).AudioWorkletNode;
  });

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useVoiceSession());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('starts session successfully', async () => {
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(mockAudioContextImpl.audioWorklet.addModule).toHaveBeenCalledWith('/audio-processor.js');
    expect(result.current.error).toBeNull();
  });

  it('handles start session errors', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('Permission denied'));
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => {
         expect(result.current.error).toBe('Permission denied');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('stops session and cleans up resources', async () => {
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.stopSession();
    });

    expect(result.current.isConnected).toBe(false);
    expect(mockLiveSessionClient.disconnect).toHaveBeenCalled();
    expect(mockAudioWorkletNodeImpl.port.close).toHaveBeenCalled();
    expect(mockAudioContextImpl.close).toHaveBeenCalledTimes(2);
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(result.current.inputAnalyserRef.current).toBeNull();
    expect(result.current.outputAnalyserRef.current).toBeNull();
  });

  it('processes audio from worklet', async () => {
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Simulate audio data from worklet
    const audioData = new Int16Array([100, -100]).buffer;
    act(() => {
      if (mockAudioWorkletNodeImpl.port.onmessage) {
        mockAudioWorkletNodeImpl.port.onmessage({
          data: { type: 'audio', audioData }
        } as MessageEvent);
      }
    });

    expect(mockLiveSessionClient.sendAudio).toHaveBeenCalled();
  });

  it('restarts session if startSession called while connected', async () => {
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Reset mocks to track second call
    mockAudioContextImpl.audioWorklet.addModule.mockClear();

    await act(async () => {
      await result.current.startSession({ restart: true });
    });

    await waitFor(() => {
        expect(mockAudioContextImpl.audioWorklet.addModule).toHaveBeenCalled();
        expect(result.current.isConnected).toBe(true);
    });

    expect(mockLiveSessionClient.disconnect).toHaveBeenCalled();
    expect(mockAudioContextImpl.close).toHaveBeenCalledTimes(2);
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(audioContextCreateCount).toBe(4);
    expect(workletCreateCount).toBe(2);
  });

  it('throws an error when Web Audio API is not available', async () => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;

    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Web Audio API not supported in this environment.');
    });

    expect(result.current.isConnected).toBe(false);
    expect(mockAudioContextImpl.createAnalyser).not.toHaveBeenCalled();
  });

  it('updates isAiSpeaking based on analyser output volume (AI speaking vs silence)', async () => {
    const { result } = renderHook(() => useVoiceSession());

    await act(async () => {
      await result.current.startSession();
    });

    // Wait for connection to be established
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Output analyser returns low volume first (AI not speaking)
    const firstAnalyserCall = mockAudioContextImpl.createAnalyser.mock.results[1]?.value as any;
    const originalGetByteFrequencyData = firstAnalyserCall.getByteFrequencyData;

    // First tick: low volume
    firstAnalyserCall.getByteFrequencyData = vi.fn((arr: Uint8Array) => {
      arr.fill(0); // avg = 0 => below threshold
    });

    // Execute one visualizer frame
    await act(async () => {
      // requestAnimationFrame callback is scheduled inside hook; trigger it manually
      const raf = (window.requestAnimationFrame as any as vi.Mock);
      const cb = raf.mock.calls[0]?.[0] as FrameRequestCallback;
      cb(0);
    });

    expect(result.current.isAiSpeaking).toBe(false);

    // Second tick: high volume (AI speaking)
    firstAnalyserCall.getByteFrequencyData = vi.fn((arr: Uint8Array) => {
      arr.fill(255); // avg > 10 => above threshold
    });

    await act(async () => {
      const raf = (window.requestAnimationFrame as any as vi.Mock);
      const cb = raf.mock.calls[1]?.[0] as FrameRequestCallback;
      cb(16);
    });

    expect(result.current.isAiSpeaking).toBe(true);

    // Restore original analyser behavior for any follow-up frames
    firstAnalyserCall.getByteFrequencyData = originalGetByteFrequencyData;
  });
});
