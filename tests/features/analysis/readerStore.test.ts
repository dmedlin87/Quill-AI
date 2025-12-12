import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_READERS } from '@/types/personas';

const { mockGenerateReactions } = vi.hoisted(() => ({
  mockGenerateReactions: vi.fn(),
}));

vi.mock('@/services/agent/readerService', () => ({
  readerService: {
    generateReactions: mockGenerateReactions,
  },
}));

describe('useReaderStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const { useReaderStore } = await import('@/features/analysis/readerStore');
    useReaderStore.setState({
      activePersona: DEFAULT_READERS[0],
      reactions: [],
      isReading: false,
      isVisible: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setActivePersona updates persona when found and no-ops when missing', async () => {
    const { useReaderStore } = await import('@/features/analysis/readerStore');

    useReaderStore.getState().setActivePersona('skeptic');
    expect(useReaderStore.getState().activePersona.id).toBe('skeptic');

    useReaderStore.getState().setActivePersona('not-a-persona');
    expect(useReaderStore.getState().activePersona.id).toBe('skeptic');
  });

  it('toggleVisibility flips isVisible', async () => {
    const { useReaderStore } = await import('@/features/analysis/readerStore');

    expect(useReaderStore.getState().isVisible).toBe(false);

    useReaderStore.getState().toggleVisibility();
    expect(useReaderStore.getState().isVisible).toBe(true);

    useReaderStore.getState().toggleVisibility();
    expect(useReaderStore.getState().isVisible).toBe(false);
  });

  it('generateReactions sets isReading true then stores reactions and resets isReading', async () => {
    const { useReaderStore } = await import('@/features/analysis/readerStore');

    const reactions = [{ id: '1' } as any];
    mockGenerateReactions.mockResolvedValue(reactions);

    const promise = useReaderStore.getState().generateReactions('hello', 'ctx');

    expect(useReaderStore.getState().isReading).toBe(true);

    await promise;

    expect(mockGenerateReactions).toHaveBeenCalledWith(
      'hello',
      useReaderStore.getState().activePersona,
      'ctx',
    );
    expect(useReaderStore.getState().reactions).toEqual(reactions);
    expect(useReaderStore.getState().isReading).toBe(false);
  });

  it('generateReactions logs error, preserves reactions, and resets isReading on failure', async () => {
    const { useReaderStore } = await import('@/features/analysis/readerStore');

    useReaderStore.setState({ reactions: [{ id: 'existing' } as any] });

    mockGenerateReactions.mockRejectedValue(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await useReaderStore.getState().generateReactions('hello');

    expect(consoleError).toHaveBeenCalledWith('Reader Store Error:', expect.any(Error));
    expect(useReaderStore.getState().reactions).toEqual([{ id: 'existing' }]);
    expect(useReaderStore.getState().isReading).toBe(false);
  });

  it('clearReactions clears reactions', async () => {
    const { useReaderStore } = await import('@/features/analysis/readerStore');

    useReaderStore.setState({ reactions: [{ id: 'existing' } as any] });
    useReaderStore.getState().clearReactions();

    expect(useReaderStore.getState().reactions).toEqual([]);
  });
});
