/**
 * Tests for testUtils.ts helper functions
 * Covers lines 45-153 for improved branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupFakeTimers,
  cleanupTest,
  advanceTimersAndFlush,
  flushPromises,
  assertStrictEqual,
  assertCalledWithExact,
  assertCallCount,
  assertNotCalled,
  createDeferred,
  waitForCondition,
  createTypedMock,
  assertTextContent,
  assertAttribute,
  setupAutoCleanup,
} from './testUtils';

describe('testUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('setupFakeTimers', () => {
    it('should enable fake timers with shouldAdvanceTime option', () => {
      vi.useRealTimers();
      setupFakeTimers();
      expect(vi.isFakeTimers()).toBe(true);
    });
  });

  describe('cleanupTest', () => {
    it('should clear and restore all mocks', () => {
      const mockFn = vi.fn();
      mockFn();
      expect(mockFn).toHaveBeenCalled();

      cleanupTest();
      // After cleanup, mocks should be cleared
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('advanceTimersAndFlush', () => {
    it('should advance timers by specified milliseconds', async () => {
      let executed = false;
      setTimeout(() => {
        executed = true;
      }, 100);

      expect(executed).toBe(false);
      await advanceTimersAndFlush(100);
      expect(executed).toBe(true);
    });

    it('should not execute timer callbacks before time elapses', async () => {
      let executed = false;
      setTimeout(() => {
        executed = true;
      }, 100);

      await advanceTimersAndFlush(50);
      expect(executed).toBe(false);
    });
  });

  describe('flushPromises', () => {
    it('should flush all pending timers and promises', async () => {
      let count = 0;
      setTimeout(() => count++, 10);
      setTimeout(() => count++, 20);
      setTimeout(() => count++, 30);

      await flushPromises();
      expect(count).toBe(3);
    });
  });

  describe('assertStrictEqual', () => {
    it('should pass for strictly equal values', () => {
      assertStrictEqual(42, 42);
      assertStrictEqual('hello', 'hello');
      assertStrictEqual({ a: 1 }, { a: 1 });
    });

    it('should pass for equal arrays', () => {
      assertStrictEqual([1, 2, 3], [1, 2, 3]);
    });

    it('should accept optional message parameter', () => {
      assertStrictEqual(true, true, 'should be true');
    });

    it('should fail for non-equal values', () => {
      expect(() => assertStrictEqual(42, 43)).toThrow();
    });
  });

  describe('assertCalledWithExact', () => {
    it('should pass when mock was called with exact arguments', () => {
      const mockFn = vi.fn();
      mockFn('arg1', 'arg2');
      assertCalledWithExact(mockFn, 'arg1', 'arg2');
    });

    it('should pass for calls with no arguments', () => {
      const mockFn = vi.fn();
      mockFn();
      assertCalledWithExact(mockFn);
    });

    it('should pass for calls with complex objects', () => {
      const mockFn = vi.fn();
      const obj = { nested: { value: 42 } };
      mockFn(obj, [1, 2, 3]);
      assertCalledWithExact(mockFn, obj, [1, 2, 3]);
    });

    it('should fail when arguments do not match', () => {
      const mockFn = vi.fn();
      mockFn('arg1');
      expect(() => assertCalledWithExact(mockFn, 'arg2')).toThrow();
    });
  });

  describe('assertCallCount', () => {
    it('should pass when mock was called expected number of times', () => {
      const mockFn = vi.fn();
      mockFn();
      mockFn();
      mockFn();
      assertCallCount(mockFn, 3);
    });

    it('should pass for zero call count', () => {
      const mockFn = vi.fn();
      assertCallCount(mockFn, 0);
    });

    it('should fail when call count does not match', () => {
      const mockFn = vi.fn();
      mockFn();
      expect(() => assertCallCount(mockFn, 5)).toThrow();
    });
  });

  describe('assertNotCalled', () => {
    it('should pass when mock was never called', () => {
      const mockFn = vi.fn();
      assertNotCalled(mockFn);
    });

    it('should fail when mock was called', () => {
      const mockFn = vi.fn();
      mockFn();
      expect(() => assertNotCalled(mockFn)).toThrow();
    });
  });

  describe('createDeferred', () => {
    it('should create a deferred promise that can be resolved', async () => {
      const deferred = createDeferred<string>();

      let resolved = false;
      deferred.promise.then((value) => {
        resolved = true;
        expect(value).toBe('test');
      });

      expect(resolved).toBe(false);
      deferred.resolve('test');
      await flushPromises();
      expect(resolved).toBe(true);
    });

    it('should create a deferred promise that can be rejected', async () => {
      const deferred = createDeferred<string>();

      let rejected = false;
      deferred.promise.catch((error) => {
        rejected = true;
        expect(error).toBe('error');
      });

      expect(rejected).toBe(false);
      deferred.reject('error');
      await flushPromises();
      expect(rejected).toBe(true);
    });

    it('should work with void type', async () => {
      const deferred = createDeferred<void>();
      let resolved = false;
      deferred.promise.then(() => {
        resolved = true;
      });

      deferred.resolve(undefined);
      await flushPromises();
      expect(resolved).toBe(true);
    });
  });

  describe('waitForCondition', () => {
    it('should resolve when condition becomes true', async () => {
      let flag = false;
      setTimeout(() => {
        flag = true;
      }, 50);

      await waitForCondition(() => flag, { timeout: 1000, interval: 10 });
      expect(flag).toBe(true);
    });

    it('should throw timeout error when condition never becomes true', async () => {
      await expect(
        waitForCondition(() => false, { timeout: 50, interval: 10 })
      ).rejects.toThrow('Condition not met within 50ms');
    });

    it('should use default timeout and interval', async () => {
      let flag = false;
      setTimeout(() => {
        flag = true;
      }, 20);

      await waitForCondition(() => flag);
      expect(flag).toBe(true);
    });

    it('should resolve immediately if condition is already true', async () => {
      await waitForCondition(() => true);
      // Should not throw
    });
  });

  describe('createTypedMock', () => {
    it('should create a mock function without implementation', () => {
      const mockFn = createTypedMock<(a: number) => number>();
      mockFn(5);
      expect(mockFn).toHaveBeenCalledWith(5);
    });

    it('should create a mock function with implementation', () => {
      const mockFn = createTypedMock<(a: number, b: number) => number>((a, b) => a + b);
      const result = mockFn(2, 3);
      expect(result).toBe(5);
      expect(mockFn).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('assertTextContent', () => {
    it('should pass when element has exact text content', () => {
      const element = document.createElement('div');
      element.textContent = 'Hello World';
      assertTextContent(element, 'Hello World');
    });

    it('should fail when text content does not match', () => {
      const element = document.createElement('div');
      element.textContent = 'Hello';
      expect(() => assertTextContent(element, 'Goodbye')).toThrow();
    });

    it('should handle empty text content', () => {
      const element = document.createElement('div');
      assertTextContent(element, '');
    });
  });

  describe('assertAttribute', () => {
    it('should pass when element has exact attribute value', () => {
      const element = document.createElement('div');
      element.setAttribute('data-testid', 'test-value');
      assertAttribute(element, 'data-testid', 'test-value');
    });

    it('should fail when attribute value does not match', () => {
      const element = document.createElement('div');
      element.setAttribute('id', 'actual');
      expect(() => assertAttribute(element, 'id', 'expected')).toThrow();
    });

    it('should handle various attribute types', () => {
      const element = document.createElement('input');
      element.setAttribute('type', 'text');
      element.setAttribute('placeholder', 'Enter text');
      assertAttribute(element, 'type', 'text');
      assertAttribute(element, 'placeholder', 'Enter text');
    });
  });

  describe('setupAutoCleanup', () => {
    it('should register afterEach hook', () => {
      // This is primarily for setup; calling it doesn't throw
      setupAutoCleanup();
      // The afterEach hook is registered but we can't easily test it fires
      // Just verify it doesn't throw
    });
  });
});
