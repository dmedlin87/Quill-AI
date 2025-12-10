import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useBranching from '@/features/editor/hooks/useBranching';
import { Branch } from '@/types/schema';

describe('useBranching', () => {
  const initialMainContent = 'Main content';

  // Helper to mock crypto.randomUUID
  beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        value: {
            randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
        }
    });
  });

  it('initializes with main content', () => {
    const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));
    expect(result.current.currentContent).toBe(initialMainContent);
    expect(result.current.isOnMain).toBe(true);
  });

  it('creates a new branch', () => {
    const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

    let branchId: string;
    act(() => {
      branchId = result.current.createBranch('New Branch');
    });

    expect(result.current.branches).toHaveLength(1);
    expect(result.current.branches[0].name).toBe('New Branch');
    expect(result.current.branches[0].content).toBe(initialMainContent);
  });

  it('switches between branches', () => {
    const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

    let branchId: string;
    act(() => {
      branchId = result.current.createBranch('Branch A');
    });

    act(() => {
        // @ts-ignore - variable initialized in act above
      result.current.switchBranch(branchId);
    });

    expect(result.current.activeBranchId).not.toBeNull();
    expect(result.current.isOnMain).toBe(false);

    act(() => {
      result.current.switchBranch(null);
    });

    expect(result.current.activeBranchId).toBeNull();
    expect(result.current.isOnMain).toBe(true);
  });

  it('detects dirty state and prevents switching without force', () => {
    const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

    let branchId: string;
    act(() => {
      branchId = result.current.createBranch('Branch A');
    });

    // Modify main content
    act(() => {
      result.current.updateBranchContent('Modified Main');
    });

    expect(result.current.hasUnsavedChanges).toBe(true);

    // Try to switch without force - should throw
    expect(() => {
        act(() => {
            // @ts-ignore
            result.current.switchBranch(branchId);
        });
    }).toThrow("Unsaved changes present");

    // Force switch
    act(() => {
        // @ts-ignore
      result.current.switchBranch(branchId, true);
    });

    expect(result.current.activeBranchId).not.toBeNull();
  });

  it('allows saving changes to clear dirty state', () => {
      const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

      act(() => {
          result.current.updateBranchContent('New Content');
      });

      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
          result.current.saveChanges();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('detects merge conflicts', () => {
      const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

      let branchId: string = '';
      act(() => {
          branchId = result.current.createBranch('Branch A');
      });

      // Modify main content AFTER branch creation
      act(() => {
          result.current.updateBranchContent('Main changed');
          // Do not save changes here, otherwise the effect will revert mainText to the prop
          // result.current.saveChanges();
      });

      // Check conflict
      const hasConflict = result.current.checkConflict(branchId);
      expect(hasConflict).toBe(true);

      // Attempt merge
      let mergeResult;
      act(() => {
          mergeResult = result.current.mergeBranch(branchId);
      });

      expect(mergeResult).toEqual({ success: false, error: 'Merge conflict: Main content has changed.' });
  });

  it('merges successfully when no conflict', () => {
    const { result } = renderHook(() => useBranching({ mainContent: initialMainContent }));

    let branchId: string = '';
    act(() => {
        branchId = result.current.createBranch('Branch A');
    });

    // Switch to branch and modify it
    act(() => {
        result.current.switchBranch(branchId);
    });

    act(() => {
        result.current.updateBranchContent('Branch Content');
        result.current.saveChanges();
    });

    // Switch back to main (required to call merge? No, merge takes ID)
    // But let's switch to main to simulate user flow
    act(() => {
        result.current.switchBranch(null);
    });

    // Merge
    let mergeResult;
    act(() => {
        mergeResult = result.current.mergeBranch(branchId);
    });

    expect(mergeResult).toEqual({ success: true });
    expect(result.current.currentContent).toBe('Branch Content');
  });
});
