
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AppBrainActionsProvider,
  useAppBrainActionsContext,
  createNoOpAppBrainActions,
  AppBrainActions,
} from '@/features/core/context/AppBrainActionsContext';

describe('AppBrainActionsContext', () => {
  const mockActions: AppBrainActions = createNoOpAppBrainActions();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppBrainActionsProvider actions={mockActions}>
      {children}
    </AppBrainActionsProvider>
  );

  describe('AppBrainActionsProvider', () => {
    it('provides actions to consumers', () => {
      const { result } = renderHook(() => useAppBrainActionsContext(), { wrapper });
      expect(result.current).toBe(mockActions);
    });

    it('updates context value when actions change', () => {
      const newActions = { ...mockActions, navigateToText: vi.fn() };
      const newWrapper = ({ children }: { children: React.ReactNode }) => (
        <AppBrainActionsProvider actions={newActions}>
          {children}
        </AppBrainActionsProvider>
      );

      const { result } = renderHook(() => useAppBrainActionsContext(), { wrapper: newWrapper });
      expect(result.current).toBe(newActions);
    });
  });

  describe('useAppBrainActionsContext', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => renderHook(() => useAppBrainActionsContext())).toThrow(
          'useAppBrainActionsContext must be used within an AppBrainActionsProvider'
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('createNoOpAppBrainActions', () => {
      it('creates actions that return safe defaults', async () => {
          const actions = createNoOpAppBrainActions();
          // Verify a few methods
          expect(await actions.navigateToText({ query: 'test', searchType: 'exact' })).toBe('');
          expect(await actions.updateManuscript({ searchText: 'test', replacementText: 'test', description: 'test' })).toBe('');
          expect(actions.scrollToPosition(100)).toBe(undefined);
      });
  });
});
