/**
 * StoryVersionsPanel - Writer-friendly branching/versioning for story chapters
 * 
 * Terminology adapted for non-technical writers:
 * - "Branch" → "Story Version" or "Version"
 * - "Main" → "Original"
 * - "Merge" → "Make This Main"
 * - "Switch" → "View"
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Branch } from '@/types/schema';
import { Button } from '@/features/shared/components/ui/Button';
import { Input } from '@/features/shared/components/ui/Input';

interface StoryVersionsPanelProps {
  branches: Branch[];
  activeBranchId: string | null;
  mainContent: string;
  chapterTitle?: string;
  onCreateBranch: (name: string) => void;
  onSwitchBranch: (branchId: string | null) => void;
  onMergeBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => void;
  onRenameBranch: (branchId: string, newName: string) => void;
}

interface DiffStats {
  additions: number;
  deletions: number;
  changed: number;
  totalWords: number;
}

const MAX_RECOMMENDED_VERSIONS = 10;

/**
 * Calculate simple diff stats between original and modified content
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
  
  const totalWords = modified.split(/\s+/).filter(w => w.length > 0).length;
  
  return { additions, deletions, changed, totalWords };
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const StoryVersionsPanel: React.FC<StoryVersionsPanelProps> = ({
  branches,
  activeBranchId,
  mainContent,
  chapterTitle,
  onCreateBranch,
  onSwitchBranch,
  onMergeBranch,
  onDeleteBranch,
  onRenameBranch,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'merge' | 'delete'; branchId: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Memoized diff stats per version
  const diffStatsByVersion = useMemo(
    () =>
      branches.reduce<Record<string, DiffStats>>((acc, branch) => {
        acc[branch.id] = calculateDiffStats(mainContent, branch.content);
        return acc;
      }, {}),
    [branches, mainContent]
  );

  const handleCreateVersion = useCallback(() => {
    if (!newVersionName.trim()) return;
    onCreateBranch(newVersionName.trim());
    setNewVersionName('');
    setIsCreating(false);
  }, [newVersionName, onCreateBranch]);

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

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    
    if (confirmAction.type === 'merge') {
      onMergeBranch(confirmAction.branchId);
    } else if (confirmAction.type === 'delete') {
      onDeleteBranch(confirmAction.branchId);
    }
    setConfirmAction(null);
  };

  const activeVersion = branches.find(b => b.id === activeBranchId);
  const isOnOriginal = !activeBranchId;
  const showVersionWarning = branches.length >= MAX_RECOMMENDED_VERSIONS;

  // Suggested version names for quick creation
  const suggestedNames = [
    'Happy Ending',
    'Dark Twist',
    'What If...',
    'Alternate Scene',
  ];

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header with Help Toggle */}
      <div className="px-5 py-4 border-b border-[var(--border-secondary)]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[var(--text-lg)] font-serif font-medium text-[var(--text-primary)]">
            Story Versions
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[var(--surface-secondary)] text-[var(--text-muted)] px-2 py-0.5 rounded-full">
              {branches.length} version{branches.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-6 h-6 rounded-full bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:bg-[var(--interactive-bg)] hover:text-[var(--text-primary)] flex items-center justify-center text-xs transition-colors"
              aria-label="Show help"
            >
              ?
            </button>
          </div>
        </div>
        {chapterTitle && (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">
            {chapterTitle}
          </p>
        )}
      </div>

      {/* Help Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[var(--surface-info)] border-b border-[var(--border-secondary)] overflow-hidden"
          >
            <div className="px-5 py-4 text-[var(--text-sm)]">
              <h4 className="font-medium text-[var(--text-primary)] mb-2">💡 How Story Versions Work</h4>
              <ul className="space-y-1 text-[var(--text-muted)]">
                <li>• <strong>Original</strong> is your main chapter content</li>
                <li>• <strong>Create a version</strong> to try a different direction</li>
                <li>• <strong>Switch</strong> between versions anytime - your changes are saved</li>
                <li>• <strong>Make Main</strong> replaces the original with a version</li>
                <li>• Each chapter has its own set of versions</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version Warning */}
      {showVersionWarning && (
        <div className="mx-5 mt-4 px-3 py-2 bg-[var(--surface-warning)] border border-[var(--border-warning)] rounded-lg text-xs text-[var(--text-warning)]">
          You have many versions. Consider merging or deleting unused ones.
        </div>
      )}

      {/* Original (Main) Version */}
      <div className="px-5 py-4 border-b border-[var(--border-secondary)]">
        <button
          onClick={() => onSwitchBranch(null)}
          className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
            isOnOriginal
              ? 'bg-[var(--interactive-accent)] text-white shadow-lg'
              : 'bg-[var(--surface-secondary)] hover:bg-[var(--interactive-bg)] text-[var(--text-primary)]'
          }`}
        >
          <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
            isOnOriginal ? 'bg-white' : 'bg-[var(--text-muted)]'
          }`} />
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Original</span>
              {isOnOriginal && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
            <p className={`text-xs ${isOnOriginal ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
              Your main chapter content
            </p>
          </div>
          <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {branches.map(version => {
          const isActive = version.id === activeBranchId;
          const stats = diffStatsByVersion[version.id];
          const isConfirmingThis = confirmAction?.branchId === version.id;

          return (
            <motion.div
              key={version.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border-2 transition-all ${
                isActive
                  ? 'bg-[var(--interactive-bg-active)] border-[var(--interactive-accent)]'
                  : 'bg-[var(--surface-primary)] border-[var(--border-secondary)] hover:border-[var(--border-primary)]'
              }`}
            >
              {/* Version Header */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 mt-1.5 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-[var(--interactive-accent)]' : 'bg-[var(--text-muted)]'
                  }`} />
                  
                  {editingId === version.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveEdit(version.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(version.id)}
                      className="flex-1"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {version.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-[var(--interactive-accent)] text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                        <span>{formatRelativeTime(version.createdAt)}</span>
                        <span>•</span>
                        <span>{stats.totalWords} words</span>
                        {(stats.additions > 0 || stats.deletions > 0 || stats.changed > 0) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {stats.additions > 0 && (
                                <span className="text-green-500">+{stats.additions}</span>
                              )}
                              {stats.deletions > 0 && (
                                <span className="text-red-400">-{stats.deletions}</span>
                              )}
                              {stats.changed > 0 && (
                                <span className="text-amber-500">~{stats.changed}</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!editingId && !isConfirmingThis && (
                  <div className="flex items-center gap-2 mt-3 ml-6">
                    {!isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSwitchBranch(version.id)}
                      >
                        View
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmAction({ type: 'merge', branchId: version.id })}
                    >
                      Make Main
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(version)}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmAction({ type: 'delete', branchId: version.id })}
                    >
                      Delete
                    </Button>
                  </div>
                )}

                {/* Confirm Dialog */}
                {isConfirmingThis && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 ml-6 p-3 bg-[var(--surface-secondary)] rounded-lg"
                  >
                    {confirmAction.type === 'merge' ? (
                      <>
                        <p className="text-sm text-[var(--text-primary)] mb-2">
                          <strong>Replace Original?</strong>
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mb-3">
                          This will make "{version.name}" your new main content. The version will be kept so you can undo.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[var(--text-primary)] mb-2">
                          <strong>Delete this version?</strong>
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mb-3">
                          "{version.name}" will be permanently removed. This cannot be undone.
                        </p>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={confirmAction.type === 'delete' ? 'danger' : 'primary'}
                        onClick={handleConfirmAction}
                      >
                        {confirmAction.type === 'merge' ? 'Yes, Replace' : 'Yes, Delete'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmAction(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Empty State */}
        {branches.length === 0 && !isCreating && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-[var(--surface-secondary)] rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-[var(--text-primary)] font-medium mb-2">No versions yet</h3>
            <p className="text-[var(--text-muted)] text-sm mb-4 max-w-xs mx-auto">
              Want to try a different ending or explore a "what if" scenario? Create a version to experiment safely.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedNames.slice(0, 2).map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setNewVersionName(name);
                    setIsCreating(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-[var(--surface-secondary)] hover:bg-[var(--interactive-bg)] text-[var(--text-secondary)] rounded-full transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Version Footer */}
      <div className="px-5 py-4 border-t border-[var(--border-secondary)] bg-[var(--surface-primary)]">
        <AnimatePresence mode="wait">
          {isCreating ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <Input
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="e.g., 'Darker Ending' or 'What If Sarah Lives'"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateVersion();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreateVersion}
                  disabled={!newVersionName.trim()}
                >
                  Create Version
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setNewVersionName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1">
                {suggestedNames.map(name => (
                  <button
                    key={name}
                    onClick={() => setNewVersionName(name)}
                    className="px-2 py-1 text-[10px] bg-[var(--surface-secondary)] hover:bg-[var(--interactive-bg)] text-[var(--text-muted)] rounded transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setIsCreating(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Try a New Direction
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StoryVersionsPanel;
