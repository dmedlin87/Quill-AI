import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useTextToSpeech } from '@/features/voice/hooks/useTextToSpeech';
import { generateSpeech } from '@/services/gemini/audio';

vi.mock('@/services/gemini/audio', () => ({
  generateSpeech: vi.fn(async () => ({}) as any),
}));

const mockBufferSource = () => {
  const source: any = {
    connect: vi.fn(),
    start: vi.fn(),
    onended: null as (() => void) | null,
    buffer: null as unknown,
  };
  return source;
};

describe('useTextToSpeech', () => {
  let createBufferSource: ReturnType<typeof mockBufferSource>;
  const close = vi.fn();

  beforeEach(() => {
    createBufferSource = mockBufferSource();
    // @ts-expect-error test-only audio context
    global.AudioContext = vi.fn().mockImplementation(() => ({
      state: 'running',
      createBufferSource: () => createBufferSource,
      destination: {},
      close,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('plays synthesized audio and resets when playback ends', async () => {
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.play('Hello world');
    });

    expect(result.current.isPlaying).toBe(true);
    expect(createBufferSource.start).toHaveBeenCalled();

    act(() => {
      createBufferSource.onended?.();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(close).toHaveBeenCalled();
  });

  it('surfaces errors from the audio pipeline', async () => {
    vi.mocked(generateSpeech).mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.play('bad');
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe('Could not read text aloud.');
  });

  it('stops playback and aborts pending requests', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.play('stop me');
    });

    await act(async () => {
      result.current.stop();
    });

    expect(abortSpy).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });
});
