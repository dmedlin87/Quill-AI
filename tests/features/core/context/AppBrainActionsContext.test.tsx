
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppBrainActionsContext, {
  AppBrainActionsProvider,
  useAppBrainActionsContext,
  createNoOpAppBrainActions,
  type AppBrainActions
} from '@/features/core/context/AppBrainActionsContext';

describe('AppBrainActionsContext', () => {
  const mockActions: AppBrainActions = createNoOpAppBrainActions();

  describe('createNoOpAppBrainActions', () => {
    it('returns an object with all expected methods', () => {
      const actions = createNoOpAppBrainActions();

      expect(typeof actions.navigateToText).toBe('function');
      expect(typeof actions.updateManuscript).toBe('function');
      expect(typeof actions.runAnalysis).toBe('function');
      expect(typeof actions.rewriteSelection).toBe('function');
    });

    it('all methods resolve to empty strings or void', async () => {
      const actions = createNoOpAppBrainActions();

      // Navigation
      expect(await actions.navigateToText({ chapterId: '1', text: 'test' })).toBe('');
      expect(await actions.jumpToChapter('1')).toBe('');
      expect(await actions.jumpToScene('1')).toBe('');
      expect(actions.scrollToPosition(0)).toBeUndefined();

      // Editing
      expect(await actions.updateManuscript({ chapterId: '1', changes: [] })).toBe('');
      expect(await actions.appendText('text')).toBe('');
      expect(await actions.undo()).toBe('');
      expect(await actions.redo()).toBe('');

      // Analysis
      expect(await actions.getCritiqueForSelection()).toBe('');
      expect(await actions.runAnalysis()).toBe('');

      // UI Control
      expect(await actions.switchPanel('panel')).toBe('');
      expect(await actions.toggleZenMode()).toBe('');
      expect(await actions.highlightText({ from: 0, to: 1 })).toBe('');
      expect(actions.setMicrophoneState('idle')).toBeUndefined();

      // Knowledge
      expect(await actions.queryLore('query')).toBe('');
      expect(await actions.getCharacterInfo('char')).toBe('');
      expect(await actions.getTimelineContext()).toBe('');

      // Generation
      expect(await actions.rewriteSelection({ mode: 'expand' })).toBe('');
      expect(await actions.continueWriting()).toBe('');
    });
  });

  describe('AppBrainActionsProvider', () => {
    it('provides actions to children', () => {
      const TestComponent = () => {
        const actions = useAppBrainActionsContext();
        return <div>{actions ? 'Has Actions' : 'No Actions'}</div>;
      };

      render(
        <AppBrainActionsProvider actions={mockActions}>
          <TestComponent />
        </AppBrainActionsProvider>
      );

      expect(screen.getByText('Has Actions')).toBeInTheDocument();
    });
  });

  describe('useAppBrainActionsContext', () => {
    it('returns actions when used within provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppBrainActionsProvider actions={mockActions}>
          {children}
        </AppBrainActionsProvider>
      );

      const { result } = renderHook(() => useAppBrainActionsContext(), { wrapper });
      expect(result.current).toEqual(mockActions);
    });

    it('throws error when used outside provider', () => {
      // Suppress console.error for the expected error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppBrainActionsContext());
      }).toThrow('useAppBrainActionsContext must be used within an AppBrainActionsProvider');

      spy.mockRestore();
    });
  });
});
