import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDreamingService, startDreamingService, stopDreamingService } from '../../../services/appBrain/dreamingService';
import { eventBus, emitIdleStatusChanged, emitDreamingStateChanged } from '../../../services/appBrain/eventBus';
import { runDreamingCycle } from '../../../services/memory/dreaming';

// Mock dependencies
vi.mock('../../../services/appBrain/eventBus', () => ({
  eventBus: {
    subscribeAll: vi.fn(),
  },
  emitIdleStatusChanged: vi.fn(),
  emitDreamingStateChanged: vi.fn(),
}));

vi.mock('../../../services/memory/dreaming', () => ({
  runDreamingCycle: vi.fn(),
}));

describe('DreamingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    stopDreamingService();
  });

  it('should be a singleton', () => {
    const instance1 = getDreamingService();
    const instance2 = getDreamingService();
    expect(instance1).toBe(instance2);
  });

  it('should start and subscribe to events', () => {
    startDreamingService();
    expect(eventBus.subscribeAll).toHaveBeenCalled();
  });

  it('should stop and unsubscribe from events', () => {
    const unsubscribeMock = vi.fn();
    vi.mocked(eventBus.subscribeAll).mockReturnValue(unsubscribeMock);

    startDreamingService();
    stopDreamingService();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should trigger dreaming after idle timeout', async () => {
    startDreamingService();

    // Simulate CHAPTER_CHANGED to set projectId
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'CHAPTER_CHANGED', payload: { projectId: 'test-project' } });

    // Fast-forward time to trigger idle
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(emitIdleStatusChanged).toHaveBeenCalledWith(true);
    expect(emitDreamingStateChanged).toHaveBeenCalledWith(true);
    expect(runDreamingCycle).toHaveBeenCalledWith('test-project', expect.any(AbortSignal));
  });

  it('should reset idle timer on TEXT_CHANGED', async () => {
    startDreamingService();

    // Simulate CHAPTER_CHANGED to set projectId
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'CHAPTER_CHANGED', payload: { projectId: 'test-project' } });

    // Advance time almost to the limit
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);

    // Simulate TEXT_CHANGED
    callback({ type: 'TEXT_CHANGED' });

    // Advance past the original deadline
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    // Should NOT have triggered dreaming yet (total 6 mins passed, but reset at 4 mins)
    // Wait... if reset at 4 mins, it needs another 5 mins. So 4+2=6 mins total. 2 mins after reset.
    // So it should NOT have run yet.
    expect(runDreamingCycle).not.toHaveBeenCalled();

    // Advance enough time to trigger
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 100);
    expect(runDreamingCycle).toHaveBeenCalled();
  });

  it('should interrupt dreaming if TEXT_CHANGED occurs during dreaming', async () => {
    let resolveDreaming: () => void;
    vi.mocked(runDreamingCycle).mockReturnValue(new Promise((resolve) => {
      resolveDreaming = resolve as any;
    }));

    startDreamingService();

    // Set project ID
    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'CHAPTER_CHANGED', payload: { projectId: 'test-project' } });

    // Trigger dreaming
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    expect(emitDreamingStateChanged).toHaveBeenCalledWith(true);

    // Simulate interruption
    callback({ type: 'TEXT_CHANGED' });

    expect(emitDreamingStateChanged).toHaveBeenCalledWith(false);
    // The abort signal should have been triggered. We can verify if runDreamingCycle was called with a signal that is now aborted.
    // However, since we mock runDreamingCycle, we can't easily check the signal state *after* the call unless we captured it.
    // But interrupt() sets isActive to false and calls abort().
  });

  it('should not start dreaming if no projectId is set', async () => {
    // Reset any state from previous tests because singleton persists
    stopDreamingService();
    // Re-initialize a fresh start
    startDreamingService();

    // Explicitly make sure no projectId is set in the singleton
    // Note: Since it's a singleton, we might need to rely on the fact that stop() doesn't clear projectId?
    // Let's check the implementation. stop() doesn't clear projectId.
    // Ideally we should be able to clear it or start with a fresh instance, but it is a singleton.
    // However, in this test file, we can't easily access the private `projectId`.
    // But wait, in the failing test output, it says runDreamingCycle was called with "test-project".
    // This means the projectId persisted from previous tests.

    // We can simulate a CHAPTER_CHANGED with null/undefined if the type allows, or we just rely on the fact
    // that the singleton state persists across tests if not properly reset.
    // The `stop()` method only clears the timer and subscriptions, but not the projectId.
    // We should probably update the service to allow resetting state or reset it in `beforeEach`.
    // Or we can simulate a CHAPTER_CHANGED event with a different project ID or verify that if we
    // DON'T send an event, it uses the old one? No, the test expects it NOT to run.

    // To fix this test, we need to ensure projectId is null.
    // Since we cannot access the private property, and `stop()` doesn't clear it.
    // We can simulate a CHAPTER_CHANGED with a null/empty project ID if the code handles it?
    // Looking at DreamingService.ts:
    // if (event.type === 'CHAPTER_CHANGED') { this.projectId = event.payload.projectId; ... }
    // We can send a dummy event to clear it if we change the service code or the test strategy.

    // But wait, the test failure shows it WAS called with 'test-project'.
    // This confirms state pollution.
    // Let's modify the DreamingService to allow resetting state for testing, OR
    // just emit an event to clear it?
    // But payload.projectId is likely string.

    // Let's try to mock the singleton instance reset?
    // Or just accept that we need to clear it via an event.

    // Actually, let's fix the DreamingService to clear projectId on stop?
    // Or add a reset method for testing.
    // For now, let's just emit a 'CHAPTER_CHANGED' with an empty string or something, assuming the check `if (!this.projectId)` handles empty string.

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'CHAPTER_CHANGED', payload: { projectId: '' } });

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

    expect(runDreamingCycle).not.toHaveBeenCalled();
  });

  it('should handle errors in runDreamingCycle gracefully', async () => {
    vi.mocked(runDreamingCycle).mockRejectedValue(new Error('Dream failed'));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    startDreamingService();

    const callback = vi.mocked(eventBus.subscribeAll).mock.calls[0][0];
    callback({ type: 'CHAPTER_CHANGED', payload: { projectId: 'test-project' } });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Dreaming cycle failed'), expect.any(Error));
    // Should reset and be ready again
    expect(emitDreamingStateChanged).toHaveBeenLastCalledWith(false);
  });
});
