import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDreamingService, startDreamingService, stopDreamingService } from '../../../services/appBrain/dreamingService';
import { eventBus } from '../../../services/appBrain/eventBus';
import { runDreamingCycle } from '../../../services/memory/dreaming';

vi.mock('../../../services/appBrain/eventBus', () => ({
  eventBus: {
    subscribeAll: vi.fn(),
  },
  emitDreamingStateChanged: vi.fn(),
  emitIdleStatusChanged: vi.fn(),
}));

vi.mock('../../../services/memory/dreaming', () => ({
  runDreamingCycle: vi.fn(),
}));

describe('Dreaming Service', () => {
  let service: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    service = getDreamingService();
    // Reset private state
    service.stop();
    service['projectId'] = null;
    service['isActive'] = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be a singleton', () => {
    expect(getDreamingService()).toBe(service);
  });

  it('should subscribe to events on start', () => {
    const subscribeMock = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockImplementation(subscribeMock);

    startDreamingService();
    expect(subscribeMock).toHaveBeenCalled();
  });

  it('should unsubscribe on stop', () => {
    const unsubscribeMock = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockReturnValue(unsubscribeMock);

    startDreamingService();
    stopDreamingService();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should update projectId on CHAPTER_CHANGED', () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    startDreamingService();

    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });

    expect(service['projectId']).toBe('p1');
  });

  it('should reset idle timer on TEXT_CHANGED', () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    startDreamingService();

    // Fast forward almost to threshold
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Simulate activity
    handler({ type: 'TEXT_CHANGED' });

    // Fast forward past initial threshold
    vi.advanceTimersByTime(2 * 60 * 1000);

    // Should NOT have triggered dreaming yet because it was reset
    expect(runDreamingCycle).not.toHaveBeenCalled();

    // Fast forward to new threshold
    vi.advanceTimersByTime(3 * 60 * 1000 + 100);
    // Now it should trigger? Wait, logic is 5 min reset.
    // 4 min -> reset (0) -> 2 min (total 6) -> not triggered.
    // +3 min (total 9) -> triggered (5 min from reset).
  });

  it('should begin dreaming after idle threshold', async () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    startDreamingService();
    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });

    expect(runDreamingCycle).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(runDreamingCycle).toHaveBeenCalledWith('p1', expect.any(AbortSignal));
  });

  it('should not begin dreaming if no projectId', async () => {
    startDreamingService();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    expect(runDreamingCycle).not.toHaveBeenCalled();
  });

  it('should not begin dreaming if already active', async () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    startDreamingService();
    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });
    service['isActive'] = true;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(runDreamingCycle).not.toHaveBeenCalled();
  });

  it('should handle dreaming interruption', async () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    startDreamingService();
    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });

    // Mock long running dreaming
    vi.mocked(runDreamingCycle).mockImplementation(async (id, signal) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (signal?.aborted) throw new Error('AbortError');
      return { summarized: 0, removed: 0 };
    });

    // Start dreaming
    service.beginDreaming();
    expect(service['isActive']).toBe(true);

    // Interrupt via text change
    handler({ type: 'TEXT_CHANGED' });

    expect(service['isActive']).toBe(false);
  });

  it('should handle dreaming errors gracefully', async () => {
    let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(runDreamingCycle).mockRejectedValue(new Error('Unknown error'));

    startDreamingService();
    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });

    await service.beginDreaming();

    expect(consoleSpy).toHaveBeenCalled();
    expect(service['isActive']).toBe(false);
  });

  it('should ignore AbortError', async () => {
     let handler: (event: any) => void = () => {};
    vi.mocked(eventBus.subscribeAll).mockImplementation((cb) => {
      handler = cb;
      return () => {};
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    vi.mocked(runDreamingCycle).mockRejectedValue(abortError);

    startDreamingService();
    handler({ type: 'CHAPTER_CHANGED', payload: { projectId: 'p1' } });

    await service.beginDreaming();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(service['isActive']).toBe(false);
  });
});
