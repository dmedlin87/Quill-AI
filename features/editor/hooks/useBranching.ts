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
  
  // Actions
  createBranch: (name: string, content?: string) => string;
  switchBranch: (branchId: string | null) => void;
  mergeBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  updateBranchContent: (content: string) => void;
  
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

  // Keep main content in sync with upstream changes
  useEffect(() => {
    setMainText(mainContent);
  }, [mainContent]);

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
      createdAt: Date.now(),
    };
    updateBranches([...branches, newBranch]);
    return id;
  }, [branches, currentContent, updateBranches]);

  const switchBranch = useCallback((branchId: string | null) => {
    if (branchId === null) {
      // Switching to main
      setActiveBranchId(null);
      onContentChange?.(mainText);
    } else {
      const branch = branches.find(b => b.id === branchId);
      if (branch) {
        setActiveBranchId(branchId);
        onContentChange?.(branch.content);
      }
    }
  }, [branches, mainText, onContentChange]);

  const mergeBranch = useCallback((branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      // Merge branch content into main
      setMainText(branch.content);
      onContentChange?.(branch.content);
      
      // Switch back to main
      setActiveBranchId(null);
      
      // Optionally remove the merged branch
      // updateBranches(branches.filter(b => b.id !== branchId));
    }
  }, [branches, onContentChange]);

  const deleteBranch = useCallback((branchId: string) => {
    // If deleting the active branch, switch to main first
    if (activeBranchId === branchId) {
      setActiveBranchId(null);
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
  }, [activeBranchId, branches, onContentChange, updateBranches]);

  return {
    branches,
    activeBranchId,
    currentContent,
    createBranch,
    switchBranch,
    mergeBranch,
    deleteBranch,
    renameBranch,
    updateBranchContent,
    isOnMain: !activeBranchId,
    activeBranch,
  };
}

export default useBranching;
