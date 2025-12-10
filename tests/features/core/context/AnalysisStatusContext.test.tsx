
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AnalysisStatusProvider,
  useAnalysisStatusContext,
  useAnalysisStatusState,
  useAnalysisStatusActions,
  createEmptyAnalysisStatusState,
  AnalysisStatusState,
  AnalysisStatusActions,
} from '@/features/core/context/AnalysisStatusContext';

describe('AnalysisStatusContext', () => {
  const mockState: AnalysisStatusState = createEmptyAnalysisStatusState();
  const mockActions: AnalysisStatusActions = {
    runAnalysis: vi.fn(),
    runSelectionAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    handleAgentAction: vi.fn(),
    acceptDiff: vi.fn(),
    rejectDiff: vi.fn(),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AnalysisStatusProvider state={mockState} actions={mockActions}>
      {children}
    </AnalysisStatusProvider>
  );

  describe('AnalysisStatusProvider', () => {
    it('provides state and actions to consumers', () => {
      const { result } = renderHook(() => useAnalysisStatusContext(), { wrapper });

      expect(result.current.state).toBe(mockState);
      expect(result.current.actions).toBe(mockActions);
    });

    it('updates context value when props change', () => {
      const newState = { ...mockState, isAnalyzing: true };
      const newWrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisStatusProvider state={newState} actions={mockActions}>
          {children}
        </AnalysisStatusProvider>
      );

      const { result } = renderHook(() => useAnalysisStatusContext(), { wrapper: newWrapper });

      expect(result.current.state.isAnalyzing).toBe(true);
    });
  });

  describe('useAnalysisStatusContext', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test as React logs an error when a component throws during render
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        expect(() => renderHook(() => useAnalysisStatusContext())).toThrow(
          'useAnalysisStatusContext must be used within an AnalysisStatusProvider'
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('useAnalysisStatusState', () => {
    it('returns only the state', () => {
      const { result } = renderHook(() => useAnalysisStatusState(), { wrapper });
      expect(result.current).toBe(mockState);
    });

    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => renderHook(() => useAnalysisStatusState())).toThrow(
          'useAnalysisStatusContext must be used within an AnalysisStatusProvider'
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('useAnalysisStatusActions', () => {
    it('returns only the actions', () => {
      const { result } = renderHook(() => useAnalysisStatusActions(), { wrapper });
      expect(result.current).toBe(mockActions);
    });

    it('throws error when used outside provider', () => {
         const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => renderHook(() => useAnalysisStatusActions())).toThrow(
          'useAnalysisStatusContext must be used within an AnalysisStatusProvider'
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
  
  describe('createEmptyAnalysisStatusState', () => {
      it('returns correct default state', () => {
          const state = createEmptyAnalysisStatusState();
          expect(state.isAnalyzing).toBe(false);
          expect(state.analysisError).toBeNull();
          expect(state.analysisWarning).toBeNull();
          expect(state.isDreaming).toBe(false);
          expect(state.pendingDiff).toBeNull();
      })
  })
});
