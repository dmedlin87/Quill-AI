import { useCallback, useEffect, useState } from 'react';
import type { Branch, Chapter } from '@/types/schema';
import { useProjectStore } from '@/features/project';

interface UseEditorBranchingResult {
  branches: Branch[];
  activeBranchId: string | null;
  isOnMain: boolean;
  createBranch: (name: string) => void;
  switchBranch: (branchId: string | null) => void;
  mergeBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
}

export const useEditorBranching = (
  activeChapter: Chapter | undefined,
  currentText: string,
  updateText: (text: string) => void,
): UseEditorBranchingResult => {
  const { updateChapterBranchState } = useProjectStore(state => ({
    updateChapterBranchState: state.updateChapterBranchState,
  }));

  const activeChapterId = activeChapter?.id;

  const [branches, setBranches] = useState<Branch[]>(activeChapter?.branches || []);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    activeChapter?.activeBranchId ?? null,
  );
  const [mainContent, setMainContent] = useState<string>(activeChapter?.content || '');

  const persistBranchState = useCallback(
    (
      nextBranches: Branch[],
      nextActiveBranchId: string | null,
      nextContent?: string,
    ): Promise<void> => {
      if (!activeChapterId) return Promise.resolve();

      return updateChapterBranchState(activeChapterId, {
        branches: nextBranches,
        activeBranchId: nextActiveBranchId,
        ...(nextContent !== undefined ? { content: nextContent } : {}),
      });
    },
    [activeChapterId, updateChapterBranchState],
  );

  useEffect(() => {
    if (activeChapter) {
      setBranches(activeChapter.branches || []);
      setActiveBranchId(activeChapter.activeBranchId ?? null);
      setMainContent(activeChapter.content || '');
    } else {
      // No active chapter: default branching state
      setBranches([]);
      setActiveBranchId(null);
      setMainContent('');
    }
  }, [activeChapter]);

  const createBranch = useCallback(
    (name: string) => {
      const newBranch: Branch = {
        id: crypto.randomUUID(),
        name,
        content: currentText,
        createdAt: Date.now(),
      };

      setBranches(prev => {
        const nextBranches = [...prev, newBranch];
        persistBranchState(nextBranches, activeBranchId);
        return nextBranches;
      });
    },
    [activeBranchId, currentText, persistBranchState],
  );

  const switchBranch = useCallback(
    (branchId: string | null) => {
      if (branchId === null) {
        // Switch to main
        setActiveBranchId(null);
        updateText(mainContent);
        persistBranchState(branches, null);
        return;
      }

      const branch = branches.find(b => b.id === branchId);
      if (branch) {
        setActiveBranchId(branchId);
        updateText(branch.content);
        persistBranchState(branches, branchId);
      }
    },
    [branches, mainContent, persistBranchState, updateText],
  );

  const mergeBranch = useCallback(
    (branchId: string) => {
      const branch = branches.find(b => b.id === branchId);
      if (branch) {
        setMainContent(branch.content);
        updateText(branch.content);
        setActiveBranchId(null);
        persistBranchState(branches, null, branch.content);
      }
    },
    [branches, persistBranchState, updateText],
  );

  const deleteBranch = useCallback(
    (branchId: string) => {
      if (activeBranchId === branchId) {
        setActiveBranchId(null);
        updateText(mainContent);
      }

      setBranches(prev => {
        const nextBranches = prev.filter(b => b.id !== branchId);
        persistBranchState(nextBranches, activeBranchId === branchId ? null : activeBranchId);
        return nextBranches;
      });
    },
    [activeBranchId, mainContent, persistBranchState, updateText],
  );

  const renameBranch = useCallback((branchId: string, newName: string) => {
    setBranches(prev => {
      const nextBranches = prev.map(b => (b.id === branchId ? { ...b, name: newName } : b));
      persistBranchState(nextBranches, activeBranchId);
      return nextBranches;
    });
  }, [activeBranchId, persistBranchState]);

  useEffect(() => {
    if (activeBranchId === null) {
      setMainContent(prev => (prev === currentText ? prev : currentText));
      return;
    }

    setBranches(prev => {
      let hasChanges = false;

      const nextBranches = prev.map(branch => {
        if (branch.id === activeBranchId && branch.content !== currentText) {
          hasChanges = true;
          return { ...branch, content: currentText };
        }
        return branch;
      });

      if (hasChanges) {
        persistBranchState(nextBranches, activeBranchId);
      }

      return hasChanges ? nextBranches : prev;
    });
  }, [activeBranchId, currentText, persistBranchState]);

  const isOnMain = !activeBranchId;

  return {
    branches,
    activeBranchId,
    isOnMain,
    createBranch,
    switchBranch,
    mergeBranch,
    deleteBranch,
    renameBranch,
  };
};
