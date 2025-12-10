import { describe, it, expect, vi } from 'vitest';

describe('eventBus loadChangeLog import behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loads the persisted array when valid JSON exists', async () => {
    vi.resetModules();
    const stored = [
      {
        type: 'TEXT_CHANGED',
        payload: { length: 1, delta: 1 },
        timestamp: 123,
      },
    ];

    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(JSON.stringify(stored));

    const { eventBus } = await import('@/services/appBrain/eventBus');
    const log = eventBus.getChangeLog();

    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('TEXT_CHANGED');
    expect(getItemSpy).toHaveBeenCalledWith('quillai_change_log');
  });

  it('yields an empty array when stored JSON is not an array', async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');

    const { eventBus } = await import('@/services/appBrain/eventBus');
    expect(eventBus.getChangeLog()).toHaveLength(0);
  });

  it('yields an empty array when nothing is stored', async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    const { eventBus } = await import('@/services/appBrain/eventBus');
    expect(eventBus.getChangeLog()).toHaveLength(0);
  });

  it('warns and recovers when stored JSON is malformed', async () => {
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{');

    const { eventBus } = await import('@/services/appBrain/eventBus');
    expect(eventBus.getChangeLog()).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
