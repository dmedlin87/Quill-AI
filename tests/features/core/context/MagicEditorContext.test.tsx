
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MagicEditorContext, {
  MagicEditorProvider,
  useMagicEditorContext,
  useMagicEditorState,
  useMagicEditorActions,
  createEmptyMagicEditorState,
  type MagicEditorState,
  type MagicEditorActions
} from '@/features/core/context/MagicEditorContext';

describe('MagicEditorContext', () => {
  const mockState: MagicEditorState = createEmptyMagicEditorState();
  const mockActions: MagicEditorActions = {
    handleRewrite: vi.fn(),
    handleHelp: vi.fn(),
    applyVariation: vi.fn(),
    closeMagicBar: vi.fn(),
  };

  describe('createEmptyMagicEditorState', () => {
    it('returns default state', () => {
      const state = createEmptyMagicEditorState();

      expect(state.magicVariations).toEqual([]);
      expect(state.activeMagicMode).toBeNull();
      expect(state.magicHelpResult).toBeNull();
      expect(state.magicHelpType).toBeNull();
      expect(state.isMagicLoading).toBe(false);
      expect(state.magicError).toBeNull();
    });
  });

  describe('MagicEditorProvider', () => {
    it('provides state and actions to children', () => {
      const TestComponent = () => {
        const { state, actions } = useMagicEditorContext();
        return (
          <div>
            <div data-testid="is-loading">{state.isMagicLoading.toString()}</div>
            <div data-testid="hasActions">{Boolean(actions).toString()}</div>
          </div>
        );
      };

      render(
        <MagicEditorProvider state={mockState} actions={mockActions}>
          <TestComponent />
        </MagicEditorProvider>
      );

      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('hasActions')).toHaveTextContent('true');
    });
  });

  describe('Hooks', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MagicEditorProvider state={mockState} actions={mockActions}>
        {children}
      </MagicEditorProvider>
    );

    describe('useMagicEditorContext', () => {
      it('returns context value when used within provider', () => {
        const { result } = renderHook(() => useMagicEditorContext(), { wrapper });
        expect(result.current.state).toEqual(mockState);
        expect(result.current.actions).toEqual(mockActions);
      });

      it('throws error when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useMagicEditorContext())).toThrow('useMagicEditorContext must be used within a MagicEditorProvider');
        spy.mockRestore();
      });
    });

    describe('useMagicEditorState', () => {
      it('returns only state', () => {
        const { result } = renderHook(() => useMagicEditorState(), { wrapper });
        expect(result.current).toEqual(mockState);
      });
    });

    describe('useMagicEditorActions', () => {
      it('returns only actions', () => {
        const { result } = renderHook(() => useMagicEditorActions(), { wrapper });
        expect(result.current).toEqual(mockActions);
      });
    });
  });
});
