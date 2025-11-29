import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('audio-processor worklet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers the audio processor with AudioWorkletGlobalScope', async () => {
    const registerProcessor = vi.fn();

    class FakeWorkletProcessor {
      // minimal shape used by the processor
      public port = { postMessage: vi.fn() };
    }

    Object.assign(globalThis as any, {
      AudioWorkletProcessor: FakeWorkletProcessor,
      registerProcessor,
      sampleRate: 16_000,
    });

    await import('@/public/audio-processor.js');

    expect(registerProcessor).toHaveBeenCalledWith(
      'audio-processor',
      expect.any(Function),
    );
  });

  it('converts Float32 samples to Int16 and handles empty input in process', async () => {
    const registerProcessor = vi.fn();

    class FakeWorkletProcessor {
      public port = { postMessage: vi.fn() };
    }

    Object.assign(globalThis as any, {
      AudioWorkletProcessor: FakeWorkletProcessor,
      registerProcessor,
      sampleRate: 16_000,
    });

    await import('@/public/audio-processor.js');

    const ProcessorCtor = registerProcessor.mock.calls[0][1] as any;
    const instance = new ProcessorCtor();

    const result = instance.floatTo16BitPCM(new Float32Array([0, 1, -1, 2, -2]));
    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(5);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0x7fff);
    expect(result[2]).toBe(-0x8000);

    expect(instance.process([], [], {})).toBe(true);
    expect(instance.process([[]], [], {})).toBe(true);
    expect(instance.process([[new Float32Array([])]], [], {})).toBe(true);
  });
});
