
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  GrammarProvider,
  useGrammarContext,
  useGrammarState,
  useGrammarActions,
  createEmptyGrammarState,
  GrammarState,
  GrammarActions,
} from '@/features/core/context/GrammarContext';

describe('GrammarContext', () => {
  const mockState: GrammarState = createEmptyGrammarState();
  const mockActions: GrammarActions = {
    handleGrammarCheck: vi.fn(),
    applyGrammarSuggestion: vi.fn(),
    applyAllGrammarSuggestions: vi.fn(),
    dismissGrammarSuggestion: vi.fn(),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GrammarProvider state={mockState} actions={mockActions}>
      {children}
    </GrammarProvider>
  );

  describe('GrammarProvider', () => {
    it('provides state and actions to consumers', () => {
      const { result } = renderHook(() => useGrammarContext(), { wrapper });
      expect(result.current.state).toBe(mockState);
      expect(result.current.actions).toBe(mockActions);
    });

    it('updates context value when props change', () => {
        const newState = { ...mockState, grammarSuggestions: [{ id: '1', original: 'foo', replacement: 'bar', type: 'spelling', context: 'foo', start: 0, end: 3, message: 'spelling error' }] };
        const newWrapper = ({ children }: { children: React.ReactNode }) => (
            <GrammarProvider state={newState} actions={mockActions}>
                {children}
            </GrammarProvider>
        );
        const { result } = renderHook(() => useGrammarContext(), { wrapper: newWrapper });
        expect(result.current.state.grammarSuggestions).toHaveLength(1);
    });
  });

  describe('useGrammarContext', () => {
    it('throws error when used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(() => renderHook(() => useGrammarContext())).toThrow(
                'useGrammarContext must be used within a GrammarProvider'
            );
        } finally {
            consoleSpy.mockRestore();
        }
    });
  });

  describe('useGrammarState', () => {
    it('returns only state', () => {
      const { result } = renderHook(() => useGrammarState(), { wrapper });
      expect(result.current).toBe(mockState);
    });
  });

  describe('useGrammarActions', () => {
    it('returns only actions', () => {
      const { result } = renderHook(() => useGrammarActions(), { wrapper });
      expect(result.current).toBe(mockActions);
    });
  });

  describe('createEmptyGrammarState', () => {
      it('returns correct default state', () => {
          const state = createEmptyGrammarState();
          expect(state.grammarSuggestions).toEqual([]);
          expect(state.grammarHighlights).toEqual([]);
      })
  })
});
