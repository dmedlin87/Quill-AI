import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarTab, MainView } from '@/types';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';
import { useEditorActions } from '@/features/core/context/EditorContext';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category: 'navigation' | 'editor' | 'ai' | 'settings';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
  </svg>
);

/**
 * CommandPalette - VS Code-style command palette for quick actions
 * Opens with Ctrl+K / Cmd+K
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { 
    openTabWithPanel, 
    toggleView, 
    toggleTheme, 
    toggleSidebar,
    setToolsCollapsed,
    resetToProjectDashboard,
  } = useLayoutStore();

  const { toggleZenMode } = useEditorActions();

  // Define all available commands
  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-chat',
      label: 'Open AI Chat',
      description: 'Talk to your AI writing assistant',
      category: 'navigation',
      shortcut: '',
      action: () => { openTabWithPanel(SidebarTab.CHAT); onClose(); },
    },
    {
      id: 'nav-analysis',
      label: 'Open Analysis Panel',
      description: 'View manuscript analysis results',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.ANALYSIS); onClose(); },
    },
    {
      id: 'nav-history',
      label: 'Open History',
      description: 'Browse edit history and versions',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.HISTORY); onClose(); },
    },
    {
      id: 'nav-memory',
      label: 'Open Memory Manager',
      description: 'View AI memory and context',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.MEMORY); onClose(); },
    },
    {
      id: 'nav-graph',
      label: 'Open Character Graph',
      description: 'Visualize character relationships',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.GRAPH); onClose(); },
    },
    {
      id: 'nav-lore',
      label: 'Open Lore Bible',
      description: 'Manage world-building details',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.LORE); onClose(); },
    },
    {
      id: 'nav-voice',
      label: 'Open Voice Mode',
      description: 'Dictate and transcribe',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.VOICE); onClose(); },
    },
    {
      id: 'nav-settings',
      label: 'Open Settings',
      description: 'Configure your workspace',
      category: 'navigation',
      action: () => { openTabWithPanel(SidebarTab.SETTINGS); onClose(); },
    },
    {
      id: 'nav-storyboard',
      label: 'Toggle Storyboard View',
      description: 'Switch between editor and storyboard',
      category: 'navigation',
      action: () => { toggleView(); onClose(); },
    },
    {
      id: 'nav-library',
      label: 'Return to Library',
      description: 'Go back to project selection',
      category: 'navigation',
      action: () => { resetToProjectDashboard(); onClose(); },
    },

    // Editor
    {
      id: 'editor-zen',
      label: 'Toggle Zen Mode',
      description: 'Distraction-free writing',
      category: 'editor',
      shortcut: 'Ctrl+Shift+Z',
      action: () => { toggleZenMode(); onClose(); },
    },
    {
      id: 'editor-find',
      label: 'Find & Replace',
      description: 'Search and replace text',
      category: 'editor',
      shortcut: 'Ctrl+F',
      action: () => { onClose(); /* Will trigger via keyboard */ },
    },
    {
      id: 'editor-sidebar',
      label: 'Toggle Chapter Sidebar',
      description: 'Show or hide the chapter list',
      category: 'editor',
      action: () => { toggleSidebar(); onClose(); },
    },
    {
      id: 'editor-tools',
      label: 'Toggle Tools Panel',
      description: 'Show or hide the right panel',
      category: 'editor',
      action: () => { setToolsCollapsed(true); onClose(); },
    },

    // Settings
    {
      id: 'settings-theme',
      label: 'Toggle Dark/Light Mode',
      description: 'Switch color theme',
      category: 'settings',
      action: () => { toggleTheme(); onClose(); },
    },
  ], [openTabWithPanel, toggleView, toggleTheme, toggleSidebar, setToolsCollapsed, resetToProjectDashboard, toggleZenMode, onClose]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => filteredCommands, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    editor: 'Editor',
    ai: 'AI Actions',
    settings: 'Settings',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          
          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101]"
          >
            <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-secondary)]">
                <span className="text-[var(--text-tertiary)]">
                  <SearchIcon />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a command or search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none text-sm"
                />
                <kbd className="px-2 py-0.5 bg-[var(--surface-secondary)] text-[var(--text-muted)] text-xs rounded border border-[var(--border-secondary)]">
                  ESC
                </kbd>
              </div>

              {/* Command List */}
              <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                {flatCommands.length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                    No commands found
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, cmds]) => (
                    <div key={category} className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {categoryLabels[category] || category}
                      </div>
                      {cmds.map((cmd) => {
                        const globalIndex = flatCommands.findIndex(c => c.id === cmd.id);
                        const isSelected = globalIndex === selectedIndex;
                        
                        return (
                          <button
                            key={cmd.id}
                            data-index={globalIndex}
                            onClick={() => cmd.action()}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                              isSelected 
                                ? 'bg-[var(--interactive-accent)] text-white' 
                                : 'text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                            }`}
                          >
                            <div>
                              <div className="text-sm font-medium">{cmd.label}</div>
                              {cmd.description && (
                                <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd className={`px-1.5 py-0.5 text-[10px] rounded ${
                                isSelected 
                                  ? 'bg-white/20 text-white' 
                                  : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                              }`}>
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-[var(--border-secondary)] bg-[var(--surface-secondary)]/50">
                <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-primary)] rounded border border-[var(--border-secondary)]">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-primary)] rounded border border-[var(--border-secondary)]">Enter</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-primary)] rounded border border-[var(--border-secondary)]">Esc</kbd>
                    Close
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
