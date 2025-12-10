
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GrammarContext, {
  GrammarProvider,
  useGrammarContext,
  useGrammarState,
  useGrammarActions,
  createEmptyGrammarState,
  type GrammarState,
  type GrammarActions
} from '@/features/core/context/GrammarContext';

describe('GrammarContext', () => {
  const mockState: GrammarState = createEmptyGrammarState();
  const mockActions: GrammarActions = {
    handleGrammarCheck: vi.fn(),
    applyGrammarSuggestion: vi.fn(),
    applyAllGrammarSuggestions: vi.fn(),
    dismissGrammarSuggestion: vi.fn(),
  };

  describe('createEmptyGrammarState', () => {
    it('returns default state', () => {
      const state = createEmptyGrammarState();

      expect(state.grammarSuggestions).toEqual([]);
      expect(state.grammarHighlights).toEqual([]);
    });
  });

  describe('GrammarProvider', () => {
    it('provides state and actions to children', () => {
      const TestComponent = () => {
        const { state, actions } = useGrammarContext();
        return (
          <div>
            <div data-testid="suggestions-count">{state.grammarSuggestions.length}</div>
            <div data-testid="hasActions">{Boolean(actions).toString()}</div>
          </div>
        );
      };

      render(
        <GrammarProvider state={mockState} actions={mockActions}>
          <TestComponent />
        </GrammarProvider>
      );

      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('hasActions')).toHaveTextContent('true');
    });
  });

  describe('Hooks', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GrammarProvider state={mockState} actions={mockActions}>
        {children}
      </GrammarProvider>
    );

    describe('useGrammarContext', () => {
      it('returns context value when used within provider', () => {
        const { result } = renderHook(() => useGrammarContext(), { wrapper });
        expect(result.current.state).toEqual(mockState);
        expect(result.current.actions).toEqual(mockActions);
      });

      it('throws error when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useGrammarContext())).toThrow('useGrammarContext must be used within a GrammarProvider');
        spy.mockRestore();
      });
    });

    describe('useGrammarState', () => {
      it('returns only state', () => {
        const { result } = renderHook(() => useGrammarState(), { wrapper });
        expect(result.current).toEqual(mockState);
      });
    });

    describe('useGrammarActions', () => {
      it('returns only actions', () => {
        const { result } = renderHook(() => useGrammarActions(), { wrapper });
        expect(result.current).toEqual(mockActions);
      });
    });
  });
});
