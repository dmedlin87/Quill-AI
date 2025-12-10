
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AppBrainStatusProvider,
  useAppBrainStatusContext,
  useIsAgentProcessing,
  usePendingToolCalls,
  useLastAgentAction,
  createEmptyAppBrainStatus,
  AppBrainStatus,
} from '@/features/core/context/AppBrainStatusContext';

describe('AppBrainStatusContext', () => {
  const mockStatus: AppBrainStatus = createEmptyAppBrainStatus();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppBrainStatusProvider status={mockStatus}>
      {children}
    </AppBrainStatusProvider>
  );

  describe('AppBrainStatusProvider', () => {
    it('provides status to consumers', () => {
      const { result } = renderHook(() => useAppBrainStatusContext(), { wrapper });
      expect(result.current).toBe(mockStatus);
    });

     it('updates context value when status changes', () => {
      const newStatus = { ...mockStatus, isProcessing: true };
      const newWrapper = ({ children }: { children: React.ReactNode }) => (
        <AppBrainStatusProvider status={newStatus}>
          {children}
        </AppBrainStatusProvider>
      );

      const { result } = renderHook(() => useAppBrainStatusContext(), { wrapper: newWrapper });
      expect(result.current.isProcessing).toBe(true);
    });
  });

  describe('useAppBrainStatusContext', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => renderHook(() => useAppBrainStatusContext())).toThrow(
          'useAppBrainStatusContext must be used within an AppBrainStatusProvider'
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('useIsAgentProcessing', () => {
    it('returns only isProcessing', () => {
      const { result } = renderHook(() => useIsAgentProcessing(), { wrapper });
      expect(result.current).toBe(false);
    });
  });

    describe('usePendingToolCalls', () => {
    it('returns only pendingToolCalls', () => {
      const { result } = renderHook(() => usePendingToolCalls(), { wrapper });
      expect(result.current).toEqual([]);
    });
  });

    describe('useLastAgentAction', () => {
    it('returns only lastAgentAction', () => {
      const { result } = renderHook(() => useLastAgentAction(), { wrapper });
      expect(result.current).toBeNull();
    });
  });

  describe('createEmptyAppBrainStatus', () => {
      it('returns correct default status', () => {
          const status = createEmptyAppBrainStatus();
          expect(status.isProcessing).toBe(false);
          expect(status.pendingToolCalls).toEqual([]);
          expect(status.lastAgentAction).toBeNull();
      })
  })
});
