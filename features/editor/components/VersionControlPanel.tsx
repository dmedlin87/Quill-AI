/**
 * VersionControlPanel - Chapter Branching System for Quill AI 3.0
 * 
 * Multiverse editing: create, switch, and merge content branches.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Branch } from '@/types/schema';

interface VersionControlPanelProps {
  branches: Branch[];
  activeBranchId: string | null;
  mainContent: string;
  onCreateBranch: (name: string, content: string) => void;
  onSwitchBranch: (branchId: string | null) => void;
  onMergeBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => void;
  onRenameBranch: (branchId: string, newName: string) => void;
}

interface DiffStats {
  additions: number;
  deletions: number;
  changed: number;
}

/**
 * Simple diff stats calculator
 */
function calculateDiffStats(original: string, modified: string): DiffStats {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  let additions = 0;
  let deletions = 0;
  let changed = 0;
  
  const originalSet = new Set(originalLines);
  const modifiedSet = new Set(modifiedLines);
  
  modifiedLines.forEach(line => {
    if (!originalSet.has(line)) additions++;
  });
  
  originalLines.forEach(line => {
    if (!modifiedSet.has(line)) deletions++;
  });
  
  changed = Math.min(additions, deletions);
  additions = additions - changed;
  deletions = deletions - changed;
  
  return { additions, deletions, changed };
}

export const VersionControlPanel: React.FC<VersionControlPanelProps> = ({
  branches,
  activeBranchId,
  mainContent,
  onCreateBranch,
  onSwitchBranch,
  onMergeBranch,
  onDeleteBranch,
  onRenameBranch,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showMergePreview, setShowMergePreview] = useState<string | null>(null);
  const diffStatsByBranch = useMemo(
    () =>
      branches.reduce<Record<string, DiffStats>>((acc, branch) => {
        acc[branch.id] = calculateDiffStats(mainContent, branch.content);
        return acc;
      }, {}),
    [branches, mainContent]
  );

  const handleCreateBranch = useCallback(() => {
    if (!newBranchName.trim()) return;
    onCreateBranch(newBranchName.trim(), mainContent);
    setNewBranchName('');
    setIsCreating(false);
  }, [newBranchName, mainContent, onCreateBranch]);

  const handleStartEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setEditName(branch.name);
  };

  const handleSaveEdit = (branchId: string) => {
    if (editName.trim()) {
      onRenameBranch(branchId, editName.trim());
    }
    setEditingId(null);
  };

  const activeBranch = branches.find(b => b.id === activeBranchId);
  const isOnMain = !activeBranchId;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h3 className="font-semibold text-gray-800">Chapter Branches</h3>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Experiment with alternate versions of your chapter
        </p>
      </div>

      {/* Main Branch */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => onSwitchBranch(null)}
          aria-label="Switch to Main branch"
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
            isOnMain
              ? 'bg-indigo-50 border-2 border-indigo-300'
              : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${isOnMain ? 'bg-indigo-500' : 'bg-gray-300'}`} />
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">Main</span>
              {isOnMain && (
                <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">Original chapter content</p>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Branch List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {branches.map(branch => {
          const isActive = branch.id === activeBranchId;
          const stats = diffStatsByBranch[branch.id];
          const showPreview = showMergePreview === branch.id;

          return (
            <div
              key={branch.id}
              className={`rounded-lg border transition-all ${
                isActive
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Branch Header */}
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                  
                  {editingId === branch.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleSaveEdit(branch.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(branch.id)}
                      className="flex-1 text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{branch.name}</span>
                        {isActive && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(branch.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Diff Stats */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {stats.additions > 0 && (
                      <span className="text-green-600" aria-label={`${stats.additions} additions`}>+{stats.additions}</span>
                    )}
                    {stats.deletions > 0 && (
                      <span className="text-red-500" aria-label={`${stats.deletions} deletions`}>-{stats.deletions}</span>
                    )}
                    {stats.changed > 0 && (
                      <span className="text-amber-500" aria-label={`${stats.changed} changes`}>~{stats.changed}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2 ml-6">
                  {!isActive && (
                    <button
                      onClick={() => onSwitchBranch(branch.id)}
                      aria-label={`Switch to branch ${branch.name}`}
                      className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    onClick={() => setShowMergePreview(showPreview ? null : branch.id)}
                    aria-label={showPreview ? `Hide preview for branch ${branch.name}` : `Merge branch ${branch.name}`}
                    className="text-xs px-2 py-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  >
                    {showPreview ? 'Hide Preview' : 'Merge'}
                  </button>
                  <button
                    onClick={() => handleStartEdit(branch)}
                    aria-label={`Rename branch ${branch.name}`}
                    className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onDeleteBranch(branch.id)}
                    aria-label={`Delete branch ${branch.name}`}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Merge Preview */}
              {showPreview && (
                <div className="px-3 pb-3 border-t border-gray-100 mt-2 pt-2">
                  <p className="text-xs text-gray-500 mb-2">
                    This will replace the main content with this branch's content.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onMergeBranch(branch.id);
                        setShowMergePreview(null);
                      }}
                      className="flex-1 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                    >
                      Confirm Merge
                    </button>
                    <button
                      onClick={() => setShowMergePreview(null)}
                      className="text-xs px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {branches.length === 0 && !isCreating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No branches yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a branch to experiment with alternate versions</p>
          </div>
        )}
      </div>

      {/* Create Branch */}
      <div className="px-4 py-3 border-t border-gray-100">
        {isCreating ? (
          <div className="space-y-2">
            <input
              type="text"
              aria-label="New branch name"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="Branch name (e.g., 'Darker Ending')"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateBranch();
                if (e.key === 'Escape') setIsCreating(false);
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                className="flex-1 text-sm px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                Create Branch
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewBranchName('');
                }}
                className="text-sm px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Branch
          </button>
        )}
      </div>
    </div>
  );
};

export default VersionControlPanel;
