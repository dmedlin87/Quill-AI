import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CommandHistory,
  getCommandHistory,
  resetCommandHistory,
} from '@/services/commands/history';
import type { ExecutedCommand } from '@/services/commands/types';

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'test-uuid-123');
vi.stubGlobal('crypto', { randomUUID: mockUUID });

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
vi.stubGlobal('sessionStorage', mockSessionStorage);

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
    history = new CommandHistory();
  });

  describe('constructor', () => {
    it('creates empty history by default', () => {
      expect(history.getAll()).toEqual([]);
    });

    it('accepts initial history', () => {
      const initial: ExecutedCommand[] = [
        {
          id: 'cmd-1',
          toolName: 'navigate',
          params: { query: 'test' },
          result: 'Found',
          success: true,
          reversible: false,
          timestamp: Date.now(),
        },
      ];
      const historyWithInitial = new CommandHistory(initial);
      expect(historyWithInitial.getAll()).toHaveLength(1);
    });

    it('trims initial history to MAX_HISTORY_SIZE', () => {
      const initial: ExecutedCommand[] = Array.from({ length: 60 }, (_, i) => ({
        id: `cmd-${i}`,
        toolName: 'test',
        params: {},
        result: 'ok',
        success: true,
        reversible: false,
        timestamp: Date.now() + i,
      }));
      const historyWithInitial = new CommandHistory(initial);
      expect(historyWithInitial.getAll()).toHaveLength(50);
    });
  });

  describe('record', () => {
    it('records a command with auto-generated id and timestamp', () => {
      const entry = history.record({
        toolName: 'navigate',
        params: { query: 'find Sarah' },
        result: 'Found at position 100',
        success: true,
        reversible: false,
      });

      expect(entry.id).toBe('test-uuid-123');
      expect(entry.timestamp).toBeDefined();
      expect(entry.toolName).toBe('navigate');
      expect(history.getAll()).toHaveLength(1);
    });

    it('trims history when exceeding MAX_HISTORY_SIZE', () => {
      // Record 55 commands
      for (let i = 0; i < 55; i++) {
        history.record({
          toolName: `cmd-${i}`,
          params: {},
          result: 'ok',
          success: true,
          reversible: false,
        });
      }
      expect(history.getAll()).toHaveLength(50);
    });

    it('notifies listeners on record', () => {
      const listener = vi.fn();
      history.subscribe(listener);

      history.record({
        toolName: 'test',
        params: {},
        result: 'ok',
        success: true,
        reversible: false,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('getRecent', () => {
    beforeEach(() => {
      for (let i = 0; i < 15; i++) {
        history.record({
          toolName: `cmd-${i}`,
          params: {},
          result: `result-${i}`,
          success: true,
          reversible: false,
        });
      }
    });

    it('returns last N commands', () => {
      const recent = history.getRecent(5);
      expect(recent).toHaveLength(5);
      expect(recent[4].result).toBe('result-14');
    });

    it('defaults to 10 when no argument provided', () => {
      const recent = history.getRecent();
      expect(recent).toHaveLength(10);
    });

    it('returns all if N > stack size', () => {
      const recent = history.getRecent(100);
      expect(recent).toHaveLength(15);
    });
  });

  describe('getAll', () => {
    it('returns a copy of the stack', () => {
      history.record({
        toolName: 'test',
        params: {},
        result: 'ok',
        success: true,
        reversible: false,
      });

      const all = history.getAll();
      expect(all).toHaveLength(1);

      // Modifying returned array should not affect internal state
      all.push({} as ExecutedCommand);
      expect(history.getAll()).toHaveLength(1);
    });
  });

  describe('getByTool', () => {
    beforeEach(() => {
      history.record({ toolName: 'navigate', params: {}, result: 'ok', success: true, reversible: false });
      history.record({ toolName: 'edit', params: {}, result: 'ok', success: true, reversible: true });
      history.record({ toolName: 'navigate', params: {}, result: 'ok', success: true, reversible: false });
    });

    it('filters by tool name', () => {
      expect(history.getByTool('navigate')).toHaveLength(2);
      expect(history.getByTool('edit')).toHaveLength(1);
      expect(history.getByTool('unknown')).toHaveLength(0);
    });
  });

  describe('getSuccessful', () => {
    beforeEach(() => {
      history.record({ toolName: 'a', params: {}, result: 'ok', success: true, reversible: false });
      history.record({ toolName: 'b', params: {}, result: 'error', success: false, reversible: false });
      history.record({ toolName: 'c', params: {}, result: 'ok', success: true, reversible: false });
    });

    it('returns only successful commands', () => {
      expect(history.getSuccessful()).toHaveLength(2);
    });
  });

  describe('getFailed', () => {
    beforeEach(() => {
      history.record({ toolName: 'a', params: {}, result: 'ok', success: true, reversible: false });
      history.record({ toolName: 'b', params: {}, result: 'error', success: false, reversible: false });
    });

    it('returns only failed commands', () => {
      expect(history.getFailed()).toHaveLength(1);
      expect(history.getFailed()[0].toolName).toBe('b');
    });
  });

  describe('getReversible', () => {
    beforeEach(() => {
      history.record({ toolName: 'a', params: {}, result: 'ok', success: true, reversible: true });
      history.record({ toolName: 'b', params: {}, result: 'ok', success: true, reversible: false });
      history.record({ toolName: 'c', params: {}, result: 'error', success: false, reversible: true });
    });

    it('returns only reversible successful commands', () => {
      const reversible = history.getReversible();
      expect(reversible).toHaveLength(1);
      expect(reversible[0].toolName).toBe('a');
    });
  });

  describe('clear', () => {
    it('clears all history', () => {
      history.record({ toolName: 'test', params: {}, result: 'ok', success: true, reversible: false });
      expect(history.getAll()).toHaveLength(1);

      history.clear();
      expect(history.getAll()).toHaveLength(0);
    });

    it('notifies listeners on clear', () => {
      const listener = vi.fn();
      history.subscribe(listener);
      history.clear();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('formatForPrompt', () => {
    it('returns empty string when no history', () => {
      expect(history.formatForPrompt()).toBe('');
    });

    it('formats recent commands for prompt', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      history.record({
        toolName: 'navigate',
        params: { query: 'find Sarah' },
        result: 'Found Sarah at position 100',
        success: true,
        reversible: false,
      });

      const formatted = history.formatForPrompt(5);
      expect(formatted).toContain('[RECENT AGENT ACTIONS]');
      expect(formatted).toContain('navigate');
      expect(formatted).toContain('✓');
      
      vi.useRealTimers();
    });

    it('shows failure icon for failed commands', () => {
      history.record({
        toolName: 'edit',
        params: {},
        result: 'Failed to edit',
        success: false,
        reversible: false,
      });

      const formatted = history.formatForPrompt();
      expect(formatted).toContain('✗');
    });

    it('truncates long results', () => {
      history.record({
        toolName: 'test',
        params: {},
        result: 'A'.repeat(100),
        success: true,
        reversible: false,
      });

      const formatted = history.formatForPrompt();
      expect(formatted).toContain('...');
    });

    it('formats params preview correctly', () => {
      history.record({
        toolName: 'navigate',
        params: { query: 'This is a very long query that should be truncated', other: 123 },
        result: 'ok',
        success: true,
        reversible: false,
      });

      const formatted = history.formatForPrompt();
      expect(formatted).toContain('query:');
    });
  });

  describe('subscribe', () => {
    it('adds listener and returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = history.subscribe(listener);

      history.record({ toolName: 'a', params: {}, result: 'ok', success: true, reversible: false });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      history.record({ toolName: 'b', params: {}, result: 'ok', success: true, reversible: false });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('persist', () => {
    it('saves history to sessionStorage', () => {
      history.record({ toolName: 'test', params: {}, result: 'ok', success: true, reversible: false });
      history.persist();

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'quill_command_history',
        expect.any(String)
      );
    });

    it('handles storage errors gracefully', () => {
      mockSessionStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });

      expect(() => history.persist()).not.toThrow();
    });
  });

  describe('restore', () => {
    it('restores history from sessionStorage', () => {
      const stored: ExecutedCommand[] = [
        {
          id: 'cmd-1',
          toolName: 'navigate',
          params: {},
          result: 'ok',
          success: true,
          reversible: false,
          timestamp: Date.now(),
        },
      ];
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(stored));

      const restored = CommandHistory.restore();
      expect(restored.getAll()).toHaveLength(1);
    });

    it('returns empty history when nothing stored', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      const restored = CommandHistory.restore();
      expect(restored.getAll()).toHaveLength(0);
    });

    it('handles parse errors gracefully', () => {
      mockSessionStorage.getItem.mockReturnValueOnce('invalid json');
      const restored = CommandHistory.restore();
      expect(restored.getAll()).toHaveLength(0);
    });
  });
});

describe('Singleton helpers', () => {
  beforeEach(() => {
    resetCommandHistory();
  });

  describe('getCommandHistory', () => {
    it('returns same instance on multiple calls', () => {
      const h1 = getCommandHistory();
      const h2 = getCommandHistory();
      expect(h1).toBe(h2);
    });

// Note: Testing restore on first call in isolation is difficult because
    // the singleton persists across tests. The restore functionality is
    // thoroughly tested in the CommandHistory.restore describe block.
  });

  describe('resetCommandHistory', () => {
    it('creates a new empty history instance', () => {
      const h1 = getCommandHistory();
      h1.record({ toolName: 'test', params: {}, result: 'ok', success: true, reversible: false });

      resetCommandHistory();
      const h2 = getCommandHistory();

      expect(h2.getAll()).toHaveLength(0);
      expect(h1).not.toBe(h2);
    });
  });
});
