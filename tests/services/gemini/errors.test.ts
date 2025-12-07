import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIError,
  RateLimitError,
  AuthError,
  UnknownAIError,
  normalizeAIError,
} from '@/services/gemini/errors';

// Mock telemetry
vi.mock('@/services/telemetry/errorReporter', () => ({
  reportError: vi.fn(),
}));

describe('AIError', () => {
  it('creates error with default isRetryable false', () => {
    const error = new AIError('Test error');
    
    expect(error.message).toBe('Test error');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('AIError');
  });

  it('accepts isRetryable option', () => {
    const error = new AIError('Retry me', { isRetryable: true });
    
    expect(error.isRetryable).toBe(true);
  });

  it('stores cause', () => {
    const cause = new Error('Original');
    const error = new AIError('Wrapped', { cause });
    
    expect(error.cause).toBe(cause);
  });
});

describe('RateLimitError', () => {
  it('has isRetryable true', () => {
    const error = new RateLimitError();
    
    expect(error.isRetryable).toBe(true);
    expect(error.name).toBe('RateLimitError');
  });

  it('uses default message', () => {
    const error = new RateLimitError();
    
    expect(error.message).toContain('Rate limit');
  });

  it('accepts custom message', () => {
    const error = new RateLimitError('Custom rate limit msg');
    
    expect(error.message).toBe('Custom rate limit msg');
  });
});

describe('AuthError', () => {
  it('has isRetryable false', () => {
    const error = new AuthError();
    
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('AuthError');
  });

  it('uses default message', () => {
    const error = new AuthError();
    
    expect(error.message).toContain('Authentication');
  });
});

describe('UnknownAIError', () => {
  it('has isRetryable false', () => {
    const error = new UnknownAIError();
    
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('UnknownAIError');
  });
});

describe('normalizeAIError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AIError as-is', () => {
    const original = new RateLimitError('Already normalized');
    const result = normalizeAIError(original);
    
    expect(result).toBe(original);
  });

  it('converts 401 to AuthError', () => {
    const result = normalizeAIError({ status: 401, message: 'Unauthorized' });
    
    expect(result).toBeInstanceOf(AuthError);
    expect(result.message).toBe('Unauthorized');
  });

  it('converts 403 to AuthError', () => {
    const result = normalizeAIError({ code: 403, message: 'Forbidden' });
    
    expect(result).toBeInstanceOf(AuthError);
  });

  it('converts 429 to RateLimitError', () => {
    const result = normalizeAIError({ status: 429, message: 'Too many requests' });
    
    expect(result).toBeInstanceOf(RateLimitError);
    expect(result.isRetryable).toBe(true);
  });

  it('converts unknown errors to UnknownAIError', () => {
    const result = normalizeAIError({ status: 500, message: 'Server error' });
    
    expect(result).toBeInstanceOf(UnknownAIError);
  });

  it('handles string errors', () => {
    const result = normalizeAIError('String error message');
    
    expect(result.message).toBe('String error message');
  });

  it('uses default message for non-string/non-object', () => {
    const result = normalizeAIError(null);
    
    expect(result.message).toBe('Agent request failed.');
  });

  it('extracts status from nested cause', () => {
    const result = normalizeAIError({ cause: { status: 429 } });
    
    expect(result).toBeInstanceOf(RateLimitError);
  });

  it('extracts status from response object', () => {
    const result = normalizeAIError({ response: { status: 401 } });
    
    expect(result).toBeInstanceOf(AuthError);
  });
});
