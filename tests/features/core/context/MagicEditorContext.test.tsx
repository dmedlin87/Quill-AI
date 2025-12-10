
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  MagicEditorProvider,
  useMagicEditorContext,
  useMagicEditorState,
  useMagicEditorActions,
  createEmptyMagicEditorState,
  MagicEditorState,
  MagicEditorActions,
} from '@/features/core/context/MagicEditorContext';

describe('MagicEditorContext', () => {
  const mockState: MagicEditorState = createEmptyMagicEditorState();
  const mockActions: MagicEditorActions = {
    handleRewrite: vi.fn(),
    handleHelp: vi.fn(),
    applyVariation: vi.fn(),
    closeMagicBar: vi.fn(),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MagicEditorProvider state={mockState} actions={mockActions}>
      {children}
    </MagicEditorProvider>
  );

  describe('MagicEditorProvider', () => {
    it('provides state and actions to consumers', () => {
      const { result } = renderHook(() => useMagicEditorContext(), { wrapper });
      expect(result.current.state).toBe(mockState);
      expect(result.current.actions).toBe(mockActions);
    });

    it('updates context value when props change', () => {
        const newState = { ...mockState, isMagicLoading: true };
        const newWrapper = ({ children }: { children: React.ReactNode }) => (
            <MagicEditorProvider state={newState} actions={mockActions}>
                {children}
            </MagicEditorProvider>
        );
        const { result } = renderHook(() => useMagicEditorContext(), { wrapper: newWrapper });
        expect(result.current.state.isMagicLoading).toBe(true);
    });
  });

  describe('useMagicEditorContext', () => {
    it('throws error when used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(() => renderHook(() => useMagicEditorContext())).toThrow(
                'useMagicEditorContext must be used within a MagicEditorProvider'
            );
        } finally {
            consoleSpy.mockRestore();
        }
    });
  });

  describe('useMagicEditorState', () => {
    it('returns only state', () => {
      const { result } = renderHook(() => useMagicEditorState(), { wrapper });
      expect(result.current).toBe(mockState);
    });
  });

  describe('useMagicEditorActions', () => {
    it('returns only actions', () => {
      const { result } = renderHook(() => useMagicEditorActions(), { wrapper });
      expect(result.current).toBe(mockActions);
    });
  });

  describe('createEmptyMagicEditorState', () => {
      it('returns correct default state', () => {
          const state = createEmptyMagicEditorState();
          expect(state.magicVariations).toEqual([]);
          expect(state.activeMagicMode).toBeNull();
      })
  })
});
