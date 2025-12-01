import type { ExecutedCommand } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Command History - Tracks agent tool executions for context and debugging
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY_SIZE = 50;
const HISTORY_STORAGE_KEY = 'quill_command_history';

export class CommandHistory {
  private stack: ExecutedCommand[] = [];
  private listeners: Set<(history: ExecutedCommand[]) => void> = new Set();

  constructor(initialHistory?: ExecutedCommand[]) {
    if (initialHistory) {
      this.stack = initialHistory.slice(-MAX_HISTORY_SIZE);
    }
  }

  /**
   * Record a command execution
   */
  record(cmd: Omit<ExecutedCommand, 'id' | 'timestamp'>): ExecutedCommand {
    const entry: ExecutedCommand = {
      ...cmd,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.stack.push(entry);

    // Trim to max size
    if (this.stack.length > MAX_HISTORY_SIZE) {
      this.stack = this.stack.slice(-MAX_HISTORY_SIZE);
    }

    this.notifyListeners();
    return entry;
  }

  /**
   * Get the N most recent commands
   */
  getRecent(n: number = 10): ExecutedCommand[] {
    return this.stack.slice(-n);
  }

  /**
   * Get all commands
   */
  getAll(): ExecutedCommand[] {
    return [...this.stack];
  }

  /**
   * Get commands by tool name
   */
  getByTool(toolName: string): ExecutedCommand[] {
    return this.stack.filter((c) => c.toolName === toolName);
  }

  /**
   * Get only successful commands
   */
  getSuccessful(): ExecutedCommand[] {
    return this.stack.filter((c) => c.success);
  }

  /**
   * Get only failed commands
   */
  getFailed(): ExecutedCommand[] {
    return this.stack.filter((c) => !c.success);
  }

  /**
   * Get reversible commands (for potential undo)
   */
  getReversible(): ExecutedCommand[] {
    return this.stack.filter((c) => c.reversible && c.success);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.stack = [];
    this.notifyListeners();
  }

  /**
   * Format recent history for AI context prompt
   */
  formatForPrompt(n: number = 5): string {
    const recent = this.getRecent(n);

    if (recent.length === 0) {
      return '';
    }

    let output = '[RECENT AGENT ACTIONS]\n';

    recent.forEach((cmd, i) => {
      const ago = this.formatTimeAgo(cmd.timestamp);
      const status = cmd.success ? '✓' : '✗';
      const paramsPreview = this.formatParams(cmd.params);

      output += `${i + 1}. ${status} ${cmd.toolName}(${paramsPreview}) → ${cmd.result.slice(0, 60)}${cmd.result.length > 60 ? '...' : ''} [${ago}]\n`;
    });

    return output + '\n';
  }

  /**
   * Subscribe to history changes
   */
  subscribe(listener: (history: ExecutedCommand[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Persist to session storage
   */
  persist(): void {
    try {
      sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.stack));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Restore from session storage
   */
  static restore(): CommandHistory {
    try {
      const stored = sessionStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ExecutedCommand[];
        return new CommandHistory(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    return new CommandHistory();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private notifyListeners(): void {
    const snapshot = [...this.stack];
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  private formatParams(params: Record<string, unknown>): string {
    const entries = Object.entries(params);
    if (entries.length === 0) return '';

    return entries
      .slice(0, 2) // Show max 2 params
      .map(([k, v]) => {
        const value = typeof v === 'string' 
          ? `"${v.slice(0, 20)}${(v as string).length > 20 ? '...' : ''}"` 
          : String(v);
        return `${k}: ${value}`;
      })
      .join(', ');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance for app-wide use
// ─────────────────────────────────────────────────────────────────────────────

let globalHistory: CommandHistory | null = null;

export const getCommandHistory = (): CommandHistory => {
  if (!globalHistory) {
    globalHistory = CommandHistory.restore();
  }
  return globalHistory;
};

export const resetCommandHistory = (): void => {
  globalHistory = new CommandHistory();
};
