/**
 * Test Utilities for Behavioral Rigor
 *
 * Provides helpers that enforce the test rigor guidelines:
 * - Strict assertions
 * - Deterministic timing
 * - Proper cleanup
 */

import { vi, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Setup fake timers with proper async support.
 * Call in beforeEach of tests that need deterministic timing.
 */
export function setupFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
}

/**
 * Cleanup function to be called in afterEach.
 * Ensures complete isolation between tests.
 */
export function cleanupTest() {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
}

/**
 * Advance timers and flush microtasks.
 * Use instead of raw vi.advanceTimersByTime for async code.
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/**
 * Wait for all pending promises to resolve.
 * Use when you need to wait for async operations without specific timing.
 */
export async function flushPromises(): Promise<void> {
  await vi.runAllTimersAsync();
}

/**
 * Assert that a value is exactly equal to expected.
 * Throws descriptive error if not.
 */
export function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  expect(actual, message).toStrictEqual(expected);
}

/**
 * Assert that a function was called with exact arguments.
 * More descriptive than expect().toHaveBeenCalledWith().
 */
export function assertCalledWithExact(
  mockFn: ReturnType<typeof vi.fn>,
  ...expectedArgs: unknown[]
): void {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
  const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
  expect(lastCall).toStrictEqual(expectedArgs);
}

/**
 * Assert that a mock was called exactly N times.
 */
export function assertCallCount(
  mockFn: ReturnType<typeof vi.fn>,
  expectedCount: number
): void {
  expect(mockFn).toHaveBeenCalledTimes(expectedCount);
}

/**
 * Assert that a mock was never called.
 */
export function assertNotCalled(mockFn: ReturnType<typeof vi.fn>): void {
  expect(mockFn).not.toHaveBeenCalled();
}

/**
 * Create a deferred promise for testing async flows.
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Wait for a condition to be true, with timeout.
 * Prefer this over waitFor when using fake timers.
 */
export async function waitForCondition(
  condition: () => boolean,
  { timeout = 1000, interval = 10 }: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
    await advanceTimersAndFlush(interval);
  }
}

/**
 * Type-safe mock factory that preserves function signatures.
 */
export function createTypedMock<T extends (...args: any[]) => any>(
  implementation?: T
): ReturnType<typeof vi.fn<T>> {
  return vi.fn(implementation);
}

/**
 * Assert that an element has specific text content (exact match).
 */
export function assertTextContent(element: HTMLElement, expected: string): void {
  expect(element.textContent).toBe(expected);
}

/**
 * Assert that an element has specific attribute value.
 */
export function assertAttribute(
  element: HTMLElement,
  attribute: string,
  expected: string
): void {
  expect(element.getAttribute(attribute)).toBe(expected);
}

/**
 * Global afterEach hook for automatic cleanup.
 * Import this in test files that need automatic cleanup.
 */
export function setupAutoCleanup(): void {
  afterEach(() => {
    cleanupTest();
  });
}
