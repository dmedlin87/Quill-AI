import { describe, it, expect, vi } from 'vitest';
import {
  createAbortCoordination,
  isAbortError,
  combineAbortSignals,
} from '@/services/core/abortCoordinator';

describe('abortCoordinator', () => {
  describe('createAbortCoordination', () => {
    it('creates an internal controller without external signal', () => {
      const { internalController, teardown } = createAbortCoordination();

      expect(internalController).toBeInstanceOf(AbortController);
      expect(internalController.signal.aborted).toBe(false);
      expect(teardown).toBeNull();
    });

    it('aborts internal controller when external signal is already aborted', () => {
      const externalController = new AbortController();
      externalController.abort();

      const { internalController, teardown } = createAbortCoordination(
        externalController.signal
      );

      expect(internalController.signal.aborted).toBe(true);
      expect(teardown).toBeNull();
    });

    it('links external signal to internal controller', async () => {
      const externalController = new AbortController();

      const { internalController, teardown } = createAbortCoordination(
        externalController.signal
      );

      expect(internalController.signal.aborted).toBe(false);

      externalController.abort();

      // Allow microtask queue to process
      await Promise.resolve();

      expect(internalController.signal.aborted).toBe(true);
      expect(teardown).not.toBeNull();
    });

    it('teardown removes the event listener', async () => {
      const externalController = new AbortController();

      const { internalController, teardown } = createAbortCoordination(
        externalController.signal
      );

      // Call teardown before aborting
      teardown?.();

      externalController.abort();

      // Allow microtask queue to process
      await Promise.resolve();

      // Internal controller should NOT be aborted because we removed the listener
      expect(internalController.signal.aborted).toBe(false);
    });
  });

  describe('isAbortError', () => {
    it('returns true for DOMException with AbortError name', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for regular Error', () => {
      const error = new Error('Something went wrong');
      expect(isAbortError(error)).toBe(false);
    });

    it('returns false for DOMException with different name', () => {
      const error = new DOMException('Network error', 'NetworkError');
      expect(isAbortError(error)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAbortError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAbortError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isAbortError('AbortError')).toBe(false);
    });
  });

  describe('combineAbortSignals', () => {
    it('creates a combined controller from multiple signals', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const { internalController, teardown } = combineAbortSignals([
        controller1.signal,
        controller2.signal,
      ]);

      expect(internalController.signal.aborted).toBe(false);
      expect(teardown).not.toBeNull();
    });

    it('aborts when first signal is aborted', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const { internalController } = combineAbortSignals([
        controller1.signal,
        controller2.signal,
      ]);

      controller1.abort();
      await Promise.resolve();

      expect(internalController.signal.aborted).toBe(true);
    });

    it('aborts when any signal is aborted', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const { internalController } = combineAbortSignals([
        controller1.signal,
        controller2.signal,
      ]);

      controller2.abort();
      await Promise.resolve();

      expect(internalController.signal.aborted).toBe(true);
    });

    it('is already aborted if any input signal was aborted', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      controller1.abort();

      const { internalController } = combineAbortSignals([
        controller1.signal,
        controller2.signal,
      ]);

      expect(internalController.signal.aborted).toBe(true);
    });

    it('handles empty signals array', () => {
      const { internalController, teardown } = combineAbortSignals([]);

      expect(internalController.signal.aborted).toBe(false);
      expect(teardown).toBeNull();
    });

    it('teardown removes all event listeners', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const { internalController, teardown } = combineAbortSignals([
        controller1.signal,
        controller2.signal,
      ]);

      teardown?.();

      controller1.abort();
      await Promise.resolve();

      expect(internalController.signal.aborted).toBe(false);
    });
  });
});
