import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUsage, UsageProvider } from '@/features/shared/context/UsageContext';
import { getModelPricing } from '@/config/models';

vi.mock('@/config/models', () => ({
  getModelPricing: vi.fn(),
}));

describe('UsageContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    // Default mock behavior
    (getModelPricing as any).mockReturnValue({ inputPrice: 1.0, outputPrice: 2.0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when useUsage is called outside of provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const preventDefault = (e: ErrorEvent) => {
      if (e.error?.message === 'useUsage must be used within UsageProvider') {
        e.preventDefault();
      }
    };
    window.addEventListener('error', preventDefault);

    expect(() => renderHook(() => useUsage())).toThrowError(
      'useUsage must be used within UsageProvider'
    );

    window.removeEventListener('error', preventDefault);
    consoleError.mockRestore();
  });

  it('provides usage tracking when wrapped with provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    expect(typeof result.current.trackUsage).toBe('function');
    expect(result.current.promptTokens).toBe(0);
  });

  it('loads usage from localStorage on mount', () => {
    const storedUsage = {
      prompt: 100,
      response: 50,
      requests: 5,
      cost: 0.005,
    };
    localStorage.setItem('quillai_usage', JSON.stringify(storedUsage));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    expect(result.current.promptTokens).toBe(100);
    expect(result.current.responseTokens).toBe(50);
    expect(result.current.totalRequestCount).toBe(5);
    expect(result.current.totalCost).toBe(0.005);
    // Session cost should be 0 initially because baseline is set to totalCost
    expect(result.current.sessionCost).toBe(0);
  });

  it('resets invalid localStorage data', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('quillai_usage', 'invalid-json');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useUsage(), { wrapper });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse usage stats'),
        expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

    it('resets incorrect shape in localStorage', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('quillai_usage', 'null'); // JSON.parse('null') is null

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    renderHook(() => useUsage(), { wrapper });

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid usage stats shape'));
    consoleWarnSpy.mockRestore();
  });

  it('validates numeric types in localStorage', () => {
    const corruptedUsage = {
      prompt: "NaN",
      response: Infinity,
      requests: "five",
      cost: null
    };
    localStorage.setItem('quillai_usage', JSON.stringify(corruptedUsage));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    // Should fall back to 0 for non-finite/non-numeric values
    expect(result.current.promptTokens).toBe(0);
    expect(result.current.responseTokens).toBe(0); // Infinity is not finite
    expect(result.current.totalRequestCount).toBe(0);
    expect(result.current.totalCost).toBe(0);
  });

  it('tracks usage and updates cost correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    // Mock pricing: $1 per 1M input tokens, $2 per 1M output tokens
    (getModelPricing as any).mockReturnValue({ inputPrice: 1.0, outputPrice: 2.0 });

    act(() => {
      result.current.trackUsage(
        { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000, totalTokenCount: 2_000_000 } as any,
        'test-model'
      );
    });

    expect(result.current.promptTokens).toBe(1_000_000);
    expect(result.current.responseTokens).toBe(1_000_000);
    expect(result.current.totalRequestCount).toBe(1);

    // Cost: 1 * 1.0 + 1 * 2.0 = 3.0
    expect(result.current.totalCost).toBeCloseTo(3.0);
    expect(result.current.sessionCost).toBeCloseTo(3.0);
  });

  it('handles tracking with missing modelId', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    act(() => {
      result.current.trackUsage(
        { promptTokenCount: 100 } as any,
        '' // missing modelId
      );
    });

    expect(result.current.promptTokens).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('trackUsage called without a modelId')
    );

    consoleWarnSpy.mockRestore();
  });

  it('handles tracking with unknown modelId (no pricing)', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });
    (getModelPricing as any).mockReturnValue(undefined);

    act(() => {
      result.current.trackUsage(
        { promptTokenCount: 100 } as any,
        'unknown-model'
      );
    });

    expect(result.current.promptTokens).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No pricing configured')
    );

    consoleWarnSpy.mockRestore();
  });

  it('handles UsageMetadata with missing candidatesTokenCount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    act(() => {
        // Fallback calculation: total - prompt
        result.current.trackUsage(
            { promptTokenCount: 100, totalTokenCount: 150 } as any, // missing candidatesTokenCount
            'test-model'
        );
    });

    expect(result.current.responseTokens).toBe(50);
  });

  it('resets usage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    act(() => {
      result.current.trackUsage(
        { promptTokenCount: 100 } as any,
        'test-model'
      );
    });

    expect(result.current.totalRequestCount).toBe(1);

    act(() => {
      result.current.resetUsage();
    });

    expect(result.current.totalRequestCount).toBe(0);
    expect(result.current.promptTokens).toBe(0);
    expect(result.current.totalCost).toBe(0);
  });

  it('persists usage to localStorage on update', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    act(() => {
        result.current.trackUsage({ promptTokenCount: 100 } as any, 'test-model');
    });

    const stored = JSON.parse(localStorage.getItem('quillai_usage') || '{}');
    expect(stored.prompt).toBe(100);
  });

  it('ignores null usage object', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UsageProvider>{children}</UsageProvider>
    );

    const { result } = renderHook(() => useUsage(), { wrapper });

    act(() => {
        result.current.trackUsage(null as any, 'test-model');
    });

    expect(result.current.promptTokens).toBe(0);
  });
});
