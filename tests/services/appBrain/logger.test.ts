/**
 * AppBrain Logger Tests
 * 
 * Tests for the unified logging system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  appBrainLogger,
  createServiceLogger,
  LogLevel,
  type LogEntry,
} from '@/services/appBrain/logger';

describe('AppBrainLogger', () => {
  beforeEach(() => {
    appBrainLogger.setLevel(LogLevel.DEBUG);
    appBrainLogger.clearHandlers();
  });

  afterEach(() => {
    appBrainLogger.setLevel(LogLevel.INFO);
    appBrainLogger.clearHandlers();
  });

  describe('log levels', () => {
    it('respects log level settings', () => {
      const debugSpy = vi.spyOn(console, 'debug');
      const infoSpy = vi.spyOn(console, 'info');

      appBrainLogger.setLevel(LogLevel.INFO);

      appBrainLogger.debug('TestService', 'Debug message');
      appBrainLogger.info('TestService', 'Info message');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();

      debugSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('SILENT level suppresses all logs', () => {
      const errorSpy = vi.spyOn(console, 'error');

      appBrainLogger.setLevel(LogLevel.SILENT);
      appBrainLogger.error('TestService', 'Error message');

      expect(errorSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('getLevel returns current level', () => {
      appBrainLogger.setLevel(LogLevel.WARN);
      expect(appBrainLogger.getLevel()).toBe(LogLevel.WARN);
    });
  });

  describe('custom handlers', () => {
    it('calls custom handlers with log entries', () => {
      const handler = vi.fn();
      appBrainLogger.addHandler(handler);

      appBrainLogger.info('TestService', 'Test message', { projectId: 'test-123' });

      expect(handler).toHaveBeenCalledTimes(1);
      const entry: LogEntry = handler.mock.calls[0][0];
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.service).toBe('TestService');
      expect(entry.message).toBe('Test message');
      expect(entry.context?.projectId).toBe('test-123');
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('addHandler returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = appBrainLogger.addHandler(handler);

      appBrainLogger.info('TestService', 'First message');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      appBrainLogger.info('TestService', 'Second message');
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('handler errors do not break logging', () => {
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      appBrainLogger.addHandler(badHandler);
      appBrainLogger.addHandler(goodHandler);

      const errorSpy = vi.spyOn(console, 'error');

      expect(() => {
        appBrainLogger.info('TestService', 'Test message');
      }).not.toThrow();

      expect(goodHandler).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('log methods', () => {
    it('debug logs with correct level', () => {
      const debugSpy = vi.spyOn(console, 'debug');
      appBrainLogger.debug('TestService', 'Debug message');

      expect(debugSpy).toHaveBeenCalled();
      expect(debugSpy.mock.calls[0][0]).toContain('[AppBrain]');
      expect(debugSpy.mock.calls[0][0]).toContain('[TestService]');

      debugSpy.mockRestore();
    });

    it('info logs with correct level', () => {
      const infoSpy = vi.spyOn(console, 'info');
      appBrainLogger.info('TestService', 'Info message');

      expect(infoSpy).toHaveBeenCalled();

      infoSpy.mockRestore();
    });

    it('warn logs with correct level', () => {
      const warnSpy = vi.spyOn(console, 'warn');
      appBrainLogger.warn('TestService', 'Warn message');

      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('error logs with correct level and includes error object', () => {
      const errorSpy = vi.spyOn(console, 'error');
      const testError = new Error('Test error');

      appBrainLogger.error('TestService', 'Error message', { error: testError });

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('context formatting', () => {
    it('formats context as JSON', () => {
      const infoSpy = vi.spyOn(console, 'info');

      appBrainLogger.info('TestService', 'Test message', {
        projectId: 'test-123',
        chapterId: 'chapter-1',
      });

      expect(infoSpy).toHaveBeenCalled();
      const contextArg = infoSpy.mock.calls[0][1];
      expect(contextArg).toContain('test-123');
      expect(contextArg).toContain('chapter-1');

      infoSpy.mockRestore();
    });
  });
});

describe('createServiceLogger', () => {
  beforeEach(() => {
    appBrainLogger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    appBrainLogger.setLevel(LogLevel.INFO);
  });

  it('creates a scoped logger for a service', () => {
    const infoSpy = vi.spyOn(console, 'info');
    const serviceLogger = createServiceLogger('MyService');

    serviceLogger.info('Test message');

    expect(infoSpy).toHaveBeenCalled();
    expect(infoSpy.mock.calls[0][0]).toContain('[MyService]');

    infoSpy.mockRestore();
  });

  it('scoped logger has all log methods', () => {
    const serviceLogger = createServiceLogger('MyService');

    expect(typeof serviceLogger.debug).toBe('function');
    expect(typeof serviceLogger.info).toBe('function');
    expect(typeof serviceLogger.warn).toBe('function');
    expect(typeof serviceLogger.error).toBe('function');
  });
});
