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

class MockAudioWorkletNode {
    port = mockAudioWorkletNodeImpl.port;
    constructor() {}
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

    constructor() {}
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
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        return setTimeout(() => cb(0), 16) as any;
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
    expect(mockAudioContextImpl.close).toHaveBeenCalled();
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
  });
});
