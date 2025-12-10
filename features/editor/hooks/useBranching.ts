/**
 * useBranching - Hook for chapter branching (multiverse editing)
 *
 * Manages creation, switching, and merging of content branches.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Branch } from '@/types/schema';

export interface UseBranchingOptions {
  initialBranches?: Branch[];
  mainContent: string;
  onBranchesChange?: (branches: Branch[]) => void;
  onContentChange?: (content: string) => void;
}

export interface UseBranchingResult {
  branches: Branch[];
  activeBranchId: string | null;
  currentContent: string;
  hasUnsavedChanges: boolean;
  
  // Actions
  createBranch: (name: string, content?: string) => string;
  switchBranch: (branchId: string | null, force?: boolean) => void;
  mergeBranch: (branchId: string) => { success: boolean; error?: string };
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  updateBranchContent: (content: string) => void;
  saveChanges: () => void;
  checkConflict: (branchId: string) => boolean;
  
  // State helpers
  isOnMain: boolean;
  activeBranch: Branch | null;
}

export function useBranching(options: UseBranchingOptions): UseBranchingResult {
  const { 
    initialBranches = [], 
    mainContent, 
    onBranchesChange, 
    onContentChange 
  } = options;

  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [mainText, setMainText] = useState(mainContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep main content in sync with upstream changes
  useEffect(() => {
    // If we receive new main content from props, we update our local state
    // only if we are on main and haven't modified it locally?
    // Or we overwrite? Standard pattern is: local state initializes from prop,
    // then diverges. But here mainContent might update from outside.
    // For now, let's assume we update if we are not "dirty".
    // Or simplistically, just update it.
    // But wait, if we type, we update mainText.
    // If prop updates, it might overwrite our changes.
    // Let's assume prop updates are authoritative (e.g. initial load).
    // But to prevent overwrite loops, we might check equality.
    if (mainContent !== mainText && !hasUnsavedChanges) {
       setMainText(mainContent);
    }
  }, [mainContent, mainText, hasUnsavedChanges]);

  // Update branches with callback
  const updateBranches = useCallback((newBranches: Branch[]) => {
    setBranches(newBranches);
    onBranchesChange?.(newBranches);
  }, [onBranchesChange]);

  // Get current content based on active branch
  const activeBranch = useMemo(() => {
    if (!activeBranchId) return null;
    return branches.find(b => b.id === activeBranchId) || null;
  }, [activeBranchId, branches]);

  const currentContent = activeBranch?.content ?? mainText;

  const createBranch = useCallback((name: string, content?: string): string => {
    const id = crypto.randomUUID();
    const newBranch: Branch = {
      id,
      name,
      content: content || currentContent,
      baseContent: mainText, // Snapshot of main when branch created
      createdAt: Date.now(),
    };
    updateBranches([...branches, newBranch]);
    return id;
  }, [branches, currentContent, mainText, updateBranches]);

  const switchBranch = useCallback((branchId: string | null, force: boolean = false) => {
    if (hasUnsavedChanges && !force) {
      // Caller should handle this state (e.g. show confirmation)
      throw new Error("Unsaved changes present");
    }

    if (branchId === null) {
      // Switching to main
      setActiveBranchId(null);
      setHasUnsavedChanges(false);
      onContentChange?.(mainText);
    } else {
      const branch = branches.find(b => b.id === branchId);
      if (branch) {
        setActiveBranchId(branchId);
        setHasUnsavedChanges(false);
        onContentChange?.(branch.content);
      }
    }
  }, [branches, mainText, onContentChange, hasUnsavedChanges]);

  const checkConflict = useCallback((branchId: string): boolean => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return false;

    // Conflict exists if mainText has changed since branch creation (baseContent)
    // We treat undefined baseContent as no conflict (legacy branches)
    if (branch.baseContent !== undefined && branch.baseContent !== mainText) {
      return true;
    }
    return false;
  }, [branches, mainText]);

  const mergeBranch = useCallback((branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      if (checkConflict(branchId)) {
          return { success: false, error: 'Merge conflict: Main content has changed.' };
      }

      // Merge branch content into main
      setMainText(branch.content);
      onContentChange?.(branch.content);
      setHasUnsavedChanges(true); // Merging changes main, so it's a change
      
      // Switch back to main
      setActiveBranchId(null);
      
      // Optionally remove the merged branch
      // updateBranches(branches.filter(b => b.id !== branchId));
      return { success: true };
    }
    return { success: false, error: 'Branch not found' };
  }, [branches, onContentChange, checkConflict]);

  const deleteBranch = useCallback((branchId: string) => {
    // If deleting the active branch, switch to main first
    if (activeBranchId === branchId) {
      setActiveBranchId(null);
      setHasUnsavedChanges(false);
      onContentChange?.(mainText);
    }
    updateBranches(branches.filter(b => b.id !== branchId));
  }, [branches, activeBranchId, mainText, onContentChange, updateBranches]);

  const renameBranch = useCallback((branchId: string, newName: string) => {
    updateBranches(
      branches.map(b => 
        b.id === branchId ? { ...b, name: newName } : b
      )
    );
  }, [branches, updateBranches]);

  const updateBranchContent = useCallback((content: string) => {
    if (content !== currentContent) {
        setHasUnsavedChanges(true);
    }

    if (activeBranchId) {
      // Update active branch
      updateBranches(
        branches.map(b => 
          b.id === activeBranchId 
            ? { ...b, content } 
            : b
        )
      );
    } else {
      // Update main
      setMainText(content);
    }
    onContentChange?.(content);
  }, [activeBranchId, branches, onContentChange, updateBranches, currentContent]);

  const saveChanges = useCallback(() => {
      setHasUnsavedChanges(false);
  }, []);

  return {
    branches,
    activeBranchId,
    currentContent,
    hasUnsavedChanges,
    createBranch,
    switchBranch,
    mergeBranch,
    deleteBranch,
    renameBranch,
    updateBranchContent,
    saveChanges,
    checkConflict,
    isOnMain: !activeBranchId,
    activeBranch,
  };
}

export default useBranching;
