import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useUsage, UsageProvider } from '@/features/shared/context/UsageContext';

describe('UsageContext', () => {
  it('throws when useUsage is called outside of provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const preventDefault = (e: ErrorEvent) => {
      if (e.error?.message === 'useUsage must be used within UsageProvider') {
        e.preventDefault();
      }
    };
    window.addEventListener('error', preventDefault);

    // Prevent unhandled error noise in jsdom
    const errorHandler = (e: Event) => e.preventDefault();
    window.addEventListener('error', errorHandler);

    expect(() => renderHook(() => useUsage())).toThrowError(
      'useUsage must be used within UsageProvider'
    );

    window.removeEventListener('error', errorHandler);
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
});
