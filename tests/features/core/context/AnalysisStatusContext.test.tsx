
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnalysisStatusContext, {
  AnalysisStatusProvider,
  useAnalysisStatusContext,
  useAnalysisStatusState,
  useAnalysisStatusActions,
  createEmptyAnalysisStatusState,
  type AnalysisStatusState,
  type AnalysisStatusActions
} from '@/features/core/context/AnalysisStatusContext';

describe('AnalysisStatusContext', () => {
  const mockState: AnalysisStatusState = createEmptyAnalysisStatusState();
  const mockActions: AnalysisStatusActions = {
    runAnalysis: vi.fn(),
    runSelectionAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    handleAgentAction: vi.fn(),
    acceptDiff: vi.fn(),
    rejectDiff: vi.fn()
  };

  describe('createEmptyAnalysisStatusState', () => {
    it('returns default state', () => {
      const state = createEmptyAnalysisStatusState();

      expect(state.isAnalyzing).toBe(false);
      expect(state.analysisError).toBeNull();
      expect(state.analysisWarning).toBeNull();
      expect(state.isDreaming).toBe(false);
      expect(state.pendingDiff).toBeNull();
    });
  });

  describe('AnalysisStatusProvider', () => {
    it('provides state and actions to children', () => {
      const TestComponent = () => {
        const { state, actions } = useAnalysisStatusContext();
        return (
          <div>
            <div data-testid="isAnalyzing">{state.isAnalyzing.toString()}</div>
            <div data-testid="hasActions">{Boolean(actions).toString()}</div>
          </div>
        );
      };

      render(
        <AnalysisStatusProvider state={mockState} actions={mockActions}>
          <TestComponent />
        </AnalysisStatusProvider>
      );

      expect(screen.getByTestId('isAnalyzing')).toHaveTextContent('false');
      expect(screen.getByTestId('hasActions')).toHaveTextContent('true');
    });
  });

  describe('Hooks', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AnalysisStatusProvider state={mockState} actions={mockActions}>
        {children}
      </AnalysisStatusProvider>
    );

    describe('useAnalysisStatusContext', () => {
      it('returns context value when used within provider', () => {
        const { result } = renderHook(() => useAnalysisStatusContext(), { wrapper });
        expect(result.current.state).toEqual(mockState);
        expect(result.current.actions).toEqual(mockActions);
      });

      it('throws error when used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Prevent jsdom from catching the error and failing the test
        const preventDefault = (e: ErrorEvent) => e.preventDefault();
        window.addEventListener('error', preventDefault);
        
        try {
          expect(() => renderHook(() => useAnalysisStatusContext())).toThrow(
            'useAnalysisStatusContext must be used within an AnalysisStatusProvider'
          );
        } finally {
          window.removeEventListener('error', preventDefault);
          consoleSpy.mockRestore();
        }
      });
    });

    describe('useAnalysisStatusState', () => {
      it('returns only state', () => {
        const { result } = renderHook(() => useAnalysisStatusState(), { wrapper });
        expect(result.current).toEqual(mockState);
      });
    });

    describe('useAnalysisStatusActions', () => {
      it('returns only actions', () => {
        const { result } = renderHook(() => useAnalysisStatusActions(), { wrapper });
        expect(result.current).toEqual(mockActions);
      });
    });
  });
});
