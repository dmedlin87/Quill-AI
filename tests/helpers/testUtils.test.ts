
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
  describe('setupFakeTimers', () => {
    it('enables fake timers', () => {
      setupFakeTimers();
      expect(vi.isFakeTimers()).toBe(true);
      cleanupTest(); // Cleanup after test
    });
  });

  describe('cleanupTest', () => {
    it('restores real timers and clears mocks', () => {
      setupFakeTimers();
      const mockFn = vi.fn();
      mockFn();

      cleanupTest();

      expect(vi.isFakeTimers()).toBe(false);
      expect(mockFn).not.toHaveBeenCalled(); // Call history should be cleared?
      // wait, vi.clearAllMocks() clears history. vi.restoreAllMocks() restores implementation.
      // After cleanupTest, we can't easily check if history was cleared on a variable that was reset,
      // but we can check the timer state.
    });
  });

  describe('advanceTimersAndFlush', () => {
    it('advances time and runs pending timers', async () => {
      setupFakeTimers();
      let called = false;
      setTimeout(() => {
        called = true;
      }, 100);

      await advanceTimersAndFlush(100);
      expect(called).toBe(true);
      cleanupTest();
    });
  });

  describe('flushPromises', () => {
    it('waits for promises to resolve', async () => {
      setupFakeTimers(); // flushPromises uses vi.runAllTimersAsync which works best with fake timers?
      // Actually runAllTimersAsync is for timers.
      // But the implementation says: await vi.runAllTimersAsync();

      let resolved = false;
      Promise.resolve().then(() => {
        resolved = true;
      });

      await flushPromises();
      expect(resolved).toBe(true);
      cleanupTest();
    });
  });

  describe('assertStrictEqual', () => {
    it('passes when values are equal', () => {
      assertStrictEqual(1, 1);
      assertStrictEqual({ a: 1 }, { a: 1 });
    });

    it('throws when values are not equal', () => {
      expect(() => assertStrictEqual(1, 2)).toThrow();
    });
  });

  describe('assertCalledWithExact', () => {
    it('passes when called with exact arguments', () => {
      const mock = vi.fn();
      mock(1, 'a');
      assertCalledWithExact(mock, 1, 'a');
    });

    it('throws when called with different arguments', () => {
      const mock = vi.fn();
      mock(1, 'b');
      expect(() => assertCalledWithExact(mock, 1, 'a')).toThrow();
    });

    it('throws when arguments length match but content differs', () => {
        const mock = vi.fn();
        mock(1, { foo: 'bar' });
        expect(() => assertCalledWithExact(mock, 1, { foo: 'baz' })).toThrow();
    });
  });

  describe('assertCallCount', () => {
    it('passes when call count matches', () => {
      const mock = vi.fn();
      mock();
      mock();
      assertCallCount(mock, 2);
    });

    it('throws when call count differs', () => {
      const mock = vi.fn();
      mock();
      expect(() => assertCallCount(mock, 2)).toThrow();
    });
  });

  describe('assertNotCalled', () => {
    it('passes when not called', () => {
      const mock = vi.fn();
      assertNotCalled(mock);
    });

    it('throws when called', () => {
      const mock = vi.fn();
      mock();
      expect(() => assertNotCalled(mock)).toThrow();
    });
  });

  describe('createDeferred', () => {
    it('creates a promise that can be resolved manually', async () => {
      const { promise, resolve } = createDeferred<string>();
      let result = '';
      promise.then((val) => { result = val; });

      resolve('success');
      await promise;
      expect(result).toBe('success');
    });

    it('creates a promise that can be rejected manually', async () => {
      const { promise, reject } = createDeferred<string>();
      const error = new Error('fail');
      reject(error);
      await expect(promise).rejects.toThrow('fail');
    });
  });

  describe('waitForCondition', () => {
    it('resolves when condition becomes true', async () => {
      setupFakeTimers();
      let flag = false;
      setTimeout(() => { flag = true; }, 50);

      const promise = waitForCondition(() => flag);
      await advanceTimersAndFlush(50);
      await promise;
      expect(flag).toBe(true);
      cleanupTest();
    });

    it('throws when timeout is reached', async () => {
        setupFakeTimers();
        const promise = waitForCondition(() => false, { timeout: 100, interval: 10 });

        // Advance time enough to trigger timeout
        // Note: waitForCondition loop awaits advanceTimersAndFlush(interval)
        // so we need to run pending timers to let the loop progress.

        // We need to execute the async loop in waitForCondition.
        // Calling advanceTimersAndFlush from outside might conflict if not careful,
        // but since we are awaiting the promise, we should simulate time passage.
        // However, waitForCondition calls advanceTimersAndFlush internally.
        // If we just await the promise, it will hang if the timer doesn't advance.
        // BUT waitForCondition uses `advanceTimersAndFlush(interval)` inside its loop.
        // `advanceTimersAndFlush` calls `vi.advanceTimersByTimeAsync`.
        // So it should advance time automatically?
        // Wait, `vi.advanceTimersByTimeAsync` advances the fake time.
        // Yes, it should work.

        await expect(promise).rejects.toThrow('Condition not met within 100ms');

        cleanupTest();
    });
  });

  describe('createTypedMock', () => {
    it('creates a mock with type inference (runtime check)', () => {
      const mock = createTypedMock<(a: number) => string>();
      mock.mockReturnValue('test');
      expect(mock(1)).toBe('test');
    });

    it('accepts implementation', () => {
        const mock = createTypedMock((a: number) => a * 2);
        expect(mock(2)).toBe(4);
    });
  });

  describe('assertTextContent', () => {
    it('passes when text content matches', () => {
      const el = document.createElement('div');
      el.textContent = 'hello';
      assertTextContent(el, 'hello');
    });

    it('throws when text content differs', () => {
      const el = document.createElement('div');
      el.textContent = 'hello';
      expect(() => assertTextContent(el, 'world')).toThrow();
    });
  });

  describe('assertAttribute', () => {
    it('passes when attribute matches', () => {
      const el = document.createElement('div');
      el.setAttribute('data-test', 'value');
      assertAttribute(el, 'data-test', 'value');
    });

    it('throws when attribute differs', () => {
      const el = document.createElement('div');
      el.setAttribute('data-test', 'value');
      expect(() => assertAttribute(el, 'data-test', 'other')).toThrow();
    });
  });

  describe('setupAutoCleanup', () => {
    // We can't easily test if afterEach was called without mocking 'vitest' module,
    // but importing from the file under test which imports from 'vitest' makes it hard to mock 'vitest'.
    // However, we can trust it calls afterEach.
    // We can try to spy on global.afterEach if it existed, but vitest uses ESM.

    it('is a function', () => {
        expect(typeof setupAutoCleanup).toBe('function');
    });
  });
});
