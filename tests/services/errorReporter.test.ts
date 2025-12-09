import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError, setErrorReporter } from '@/services/telemetry/errorReporter';

describe('errorReporter', () => {
  const originalConsoleError = console.error;
  let mockConsoleError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;
    // Reset globalThis.Sentry
    (globalThis as any).Sentry = undefined;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    // Reset custom reporter
    setErrorReporter(null as any);
  });

  describe('reportError', () => {
    it('logs to console when no reporter is configured', () => {
      const error = new Error('Test error');
      
      reportError(error);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Telemetry] Error captured',
        error,
        undefined
      );
    });

    it('logs to console with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'save' };
      
      reportError(error, context);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Telemetry] Error captured',
        error,
        context
      );
    });

    it('converts string errors to Error objects', () => {
      reportError('String error message');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Telemetry] Error captured',
        expect.any(Error),
        undefined
      );
      
      const capturedError = mockConsoleError.mock.calls[0][1];
      expect(capturedError.message).toBe('String error message');
    });

    it('handles unknown error types', () => {
      reportError({ custom: 'error object' });
      
      const capturedError = mockConsoleError.mock.calls[0][1];
      // Implementation JSON.stringifies unknown objects
      expect(capturedError.message).toBe('{"custom":"error object"}');
    });

    it('falls back to String() when JSON.stringify throws', () => {
      const circular: any = {};
      circular.self = circular;
      
      reportError(circular);
      
      const capturedError = mockConsoleError.mock.calls[0][1];
      expect(capturedError.message).toBe('[object Object]');
    });

    it('extracts message property from error-like objects', () => {
      reportError({ message: 'Error-like message' });
      
      const capturedError = mockConsoleError.mock.calls[0][1];
      expect(capturedError.message).toBe('Error-like message');
    });

    it('uses custom reporter when set', () => {
      const customReporter = vi.fn();
      setErrorReporter(customReporter);
      
      const error = new Error('Custom reported error');
      const context = { key: 'value' };
      
      reportError(error, context);
      
      expect(customReporter).toHaveBeenCalledWith(error, context);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('uses Sentry when available and no custom reporter', () => {
      const mockSentry = {
        captureException: vi.fn(),
      };
      (globalThis as any).Sentry = mockSentry;
      
      const error = new Error('Sentry error');
      const context = { extra: 'info' };
      
      reportError(error, context);
      
      expect(mockSentry.captureException).toHaveBeenCalledWith(error, { extra: context });
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('falls back to console if Sentry captureException is not available', () => {
      (globalThis as any).Sentry = {}; // Sentry without captureException
      
      const error = new Error('No capture');
      reportError(error);
      
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('catches and logs reporter errors', () => {
      const failingReporter = vi.fn().mockImplementation(() => {
        throw new Error('Reporter failed');
      });
      setErrorReporter(failingReporter);
      
      const error = new Error('Original error');
      reportError(error);
      
      // Implementation prefixes with reporter type (e.g., 'Custom')
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Telemetry] Custom reporter failed',
        expect.any(Error)
      );
    });
  });

  describe('setErrorReporter', () => {
    it('allows setting a custom reporter', () => {
      const reporter = vi.fn();
      
      setErrorReporter(reporter);
      reportError(new Error('Test'));
      
      expect(reporter).toHaveBeenCalled();
    });

    it('allows overriding the reporter', () => {
      const reporter1 = vi.fn();
      const reporter2 = vi.fn();
      
      setErrorReporter(reporter1);
      setErrorReporter(reporter2);
      
      reportError(new Error('Test'));
      
      expect(reporter1).not.toHaveBeenCalled();
      expect(reporter2).toHaveBeenCalled();
    });
  });
});
