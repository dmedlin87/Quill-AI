import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import { useEditorBranching } from '@/features/editor';
import type { Chapter } from '@/types/schema';

// Mock useProjectStore
const mockUpdateChapterBranchState = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn((selector) => {
    const state = {
      updateChapterBranchState: mockUpdateChapterBranchState,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Date.now(),
});

const baseChapter: Chapter = {
  id: 'chapter-1',
  projectId: 'project-1',
  title: 'Test Chapter',
  content: 'Main text',
  order: 1,
  updatedAt: 0,
  branches: [
    {
      id: 'branch-1',
      name: 'Idea 1',
      content: 'Branch text',
      createdAt: 0,
    },
  ],
  activeBranchId: null,
};

describe('useEditorBranching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('switchBranch', () => {
    it('keeps main edits when switching away and back', () => {
      const updateText = vi.fn();
      const { result, rerender } = renderHook(
        ({ activeChapter, currentText }: { activeChapter: Chapter; currentText: string }) =>
          useEditorBranching(activeChapter, currentText, updateText),
        {
          initialProps: { activeChapter: baseChapter, currentText: baseChapter.content },
        },
      );

      rerender({ activeChapter: baseChapter, currentText: 'Edited main text' });

      act(() => result.current.switchBranch('branch-1'));
      expect(updateText).toHaveBeenCalledWith('Branch text');

      updateText.mockClear();
      act(() => result.current.switchBranch(null));
      expect(updateText).toHaveBeenCalledWith('Edited main text');
    });

    it('persists branch edits while active', () => {
      const updateText = vi.fn();
      const { result, rerender } = renderHook(
        ({ activeChapter, currentText }: { activeChapter: Chapter; currentText: string }) =>
          useEditorBranching(activeChapter, currentText, updateText),
        {
          initialProps: { activeChapter: baseChapter, currentText: baseChapter.content },
        },
      );

      act(() => result.current.switchBranch('branch-1'));
      updateText.mockClear();

      rerender({ activeChapter: baseChapter, currentText: 'Rewritten branch text' });

      act(() => result.current.switchBranch(null));
      expect(result.current.branches.find(branch => branch.id === 'branch-1')?.content).toBe(
        'Rewritten branch text',
      );
      expect(updateText).toHaveBeenCalledWith('Main text');

      updateText.mockClear();
      act(() => result.current.switchBranch('branch-1'));
      expect(updateText).toHaveBeenCalledWith('Rewritten branch text');
    });

    it('does nothing when switching to non-existent branch', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      act(() => result.current.switchBranch('non-existent-id'));
      expect(updateText).not.toHaveBeenCalled();
      expect(result.current.isOnMain).toBe(true);
    });
  });

  describe('createBranch', () => {
    it('creates a new branch with current content', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Current editor content', updateText),
      );

      expect(result.current.branches).toHaveLength(1);

      act(() => result.current.createBranch('New Branch'));

      expect(result.current.branches).toHaveLength(2);
      expect(result.current.branches[1].name).toBe('New Branch');
      expect(result.current.branches[1].content).toBe('Current editor content');
    });

    it('calls persistBranchState after creating branch', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Content', updateText),
      );

      act(() => result.current.createBranch('Persisted Branch'));

      expect(mockUpdateChapterBranchState).toHaveBeenCalled();
    });
  });

  describe('mergeBranch', () => {
    it('merges branch content to main', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      act(() => result.current.mergeBranch('branch-1'));

      expect(updateText).toHaveBeenCalledWith('Branch text');
      expect(result.current.isOnMain).toBe(true);
    });

    it('does nothing when merging non-existent branch', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      act(() => result.current.mergeBranch('non-existent'));

      expect(updateText).not.toHaveBeenCalled();
    });
  });

  describe('deleteBranch', () => {
    it('removes the branch from branches list', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      expect(result.current.branches).toHaveLength(1);

      act(() => result.current.deleteBranch('branch-1'));

      expect(result.current.branches).toHaveLength(0);
    });

    it('switches to main when deleting active branch', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      // Switch to branch first
      act(() => result.current.switchBranch('branch-1'));
      expect(result.current.isOnMain).toBe(false);
      updateText.mockClear();

      // Delete the active branch
      act(() => result.current.deleteBranch('branch-1'));

      expect(result.current.isOnMain).toBe(true);
      expect(updateText).toHaveBeenCalledWith('Main text');
    });
  });

  describe('renameBranch', () => {
    it('renames a branch', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      expect(result.current.branches[0].name).toBe('Idea 1');

      act(() => result.current.renameBranch('branch-1', 'Renamed Branch'));

      expect(result.current.branches[0].name).toBe('Renamed Branch');
    });
  });

  describe('isOnMain', () => {
    it('returns true when no branch is active', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      expect(result.current.isOnMain).toBe(true);
    });

    it('returns false when a branch is active', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(baseChapter, 'Main text', updateText),
      );

      act(() => result.current.switchBranch('branch-1'));

      expect(result.current.isOnMain).toBe(false);
    });
  });

  describe('no active chapter', () => {
    it('handles undefined activeChapter gracefully', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(undefined, '', updateText),
      );

      expect(result.current.branches).toHaveLength(0);
      expect(result.current.isOnMain).toBe(true);
      expect(result.current.activeBranchId).toBeNull();
    });

    it('createBranch still works without activeChapter', () => {
      const updateText = vi.fn();
      const { result } = renderHook(
        () => useEditorBranching(undefined, 'Some content', updateText),
      );

      act(() => result.current.createBranch('New Branch'));

      expect(result.current.branches).toHaveLength(1);
    });
  });
});

