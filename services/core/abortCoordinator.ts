/**
 * Abort Coordination Utilities
 *
 * Provides a clean abstraction for coordinating external abort signals
 * with internal abort controllers. Useful for propagating cancellation
 * from UI components to underlying async operations.
 */

/**
 * Result of creating abort coordination between external and internal signals.
 */
export interface AbortCoordination {
  /** The internal abort controller that can be used to abort operations */
  internalController: AbortController;
  /** Cleanup function to remove event listeners (null if no external signal) */
  teardown: (() => void) | null;
}

/**
 * Creates an abort coordination that links an optional external signal to a new
 * internal abort controller. When the external signal is aborted, the internal
 * controller is also aborted.
 *
 * @param externalSignal - Optional external abort signal to listen to
 * @returns Coordination object with internal controller and teardown function
 *
 * @example
 * ```ts
 * const { internalController, teardown } = createAbortCoordination(
 *   userAbortSignal
 * );
 *
 * try {
 *   await fetchData({ signal: internalController.signal });
 * } finally {
 *   teardown?.();
 * }
 * ```
 */
export function createAbortCoordination(
  externalSignal?: AbortSignal
): AbortCoordination {
  const internalController = new AbortController();

  // If no external signal, return immediately
  if (!externalSignal) {
    return { internalController, teardown: null };
  }

  // If external signal is already aborted, abort internal immediately
  if (externalSignal.aborted) {
    internalController.abort();
    return { internalController, teardown: null };
  }

  // Link external signal to internal controller
  const onAbort = () => internalController.abort();
  externalSignal.addEventListener('abort', onAbort, { once: true });

  return {
    internalController,
    teardown: () => externalSignal.removeEventListener('abort', onAbort),
  };
}

/**
 * Checks if an error is an abort error (from AbortController).
 *
 * @param error - The error to check
 * @returns True if the error is an abort error
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Creates an abort signal that will be aborted after a timeout.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns An abort signal that will be aborted after the timeout
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Combines multiple abort signals into one. The resulting signal will be
 * aborted when any of the input signals is aborted.
 *
 * @param signals - Array of abort signals to combine
 * @returns Combined abort coordination
 */
export function combineAbortSignals(signals: AbortSignal[]): AbortCoordination {
  const internalController = new AbortController();
  const cleanupFns: (() => void)[] = [];

  for (const signal of signals) {
    if (signal.aborted) {
      internalController.abort();
      break;
    }

    const onAbort = () => internalController.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    cleanupFns.push(() => signal.removeEventListener('abort', onAbort));
  }

  return {
    internalController,
    teardown:
      cleanupFns.length > 0 ? () => cleanupFns.forEach(fn => fn()) : null,
  };
}
