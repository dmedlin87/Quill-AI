import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ToolRunner } from '@/services/core/toolRunner';
import type { ToolResult } from '@/services/gemini/toolExecutor';
import { getOrCreateBedsideNote } from '@/services/memory';
import type { MemoryNote } from '@/services/memory/types';

vi.mock('@/services/memory', () => ({
  getOrCreateBedsideNote: vi.fn(),
}));

const mockExecute = vi.fn();
const mockOnMessage = vi.fn();
const mockOnStateChange = vi.fn();
const mockOnToolCallStart = vi.fn();
const mockOnToolCallEnd = vi.fn();

const getMocks = () => ({
  toolExecutor: { execute: mockExecute },
  getProjectId: vi.fn(() => 'project-1'),
  onMessage: mockOnMessage,
  onStateChange: mockOnStateChange,
  onToolCallStart: mockOnToolCallStart,
  onToolCallEnd: mockOnToolCallEnd,
});

describe('ToolRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const baseNote: MemoryNote = {
    id: 'note-1',
    scope: 'project',
    projectId: 'project-1',
    type: 'fact',
    text: 'old note',
    topicTags: [],
    importance: 0.5,
    createdAt: Date.now(),
  };

  describe('resetTurn', () => {
    it('clears significance flags', () => {
      const runner = new ToolRunner(getMocks());
      (runner as any).significantActionSeen = true;
      (runner as any).bedsideNoteUpdatedThisTurn = true;

      runner.resetTurn();

      expect((runner as any).significantActionSeen).toBe(false);
      expect((runner as any).bedsideNoteUpdatedThisTurn).toBe(false);
    });
  });

  describe('processToolCalls', () => {
    it('handles successful tool execution with reflection and events', async () => {
      const runner = new ToolRunner(getMocks());
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'done',
      } satisfies ToolResult);

      const responses = await runner.processToolCalls([
        {
          id: 'call-1',
          name: 'update_bedside_note',
          args: { text: 'hello' },
        },
      ]);

      expect(mockOnStateChange).toHaveBeenCalledWith({ status: 'executing', lastError: undefined });
      expect(mockOnMessage).toHaveBeenCalledWith(expect.objectContaining({
        role: 'model',
        text: '🔨 Suggesting Action: update_bedside_note...',
      }));
      expect(mockOnToolCallStart).toHaveBeenCalledWith({
        id: 'call-1',
        name: 'update_bedside_note',
        args: { text: 'hello' },
      });
      expect(mockExecute).toHaveBeenCalledWith('update_bedside_note', { text: 'hello' });
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual({
        id: 'call-1',
        name: 'update_bedside_note',
        response: { result: expect.stringContaining('done') },
      });
      expect(mockOnToolCallEnd).toHaveBeenCalledWith({
        id: 'call-1',
        name: 'update_bedside_note',
        result: { success: true, message: 'done' },
      });
    });

    it('emits review message when result mentions user review', async () => {
      const runner = new ToolRunner(getMocks());
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Waiting for user review',
      } satisfies ToolResult);

      await runner.processToolCalls([
        { id: 'call-2', name: 'update_manuscript', args: {} },
      ]);

      expect(mockOnMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Reviewing proposed edit'),
      }));
    });

    it('uses generated id when call id is missing', async () => {
      const runner = new ToolRunner(getMocks());
      const randomSpy = vi.fn().mockReturnValue('rand-1');
      const originalCrypto = globalThis.crypto;
      vi.stubGlobal('crypto', { randomUUID: randomSpy } as unknown as Crypto);
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'done',
      } satisfies ToolResult);

      const responses = await runner.processToolCalls([
        { name: 'update_manuscript', args: {} },
      ]);

      expect(randomSpy).toHaveBeenCalled();
      expect(mockOnToolCallStart).toHaveBeenCalledWith({
        id: 'rand-1',
        name: 'update_manuscript',
        args: {},
      });
      expect(mockOnToolCallEnd).toHaveBeenCalledWith({
        id: 'rand-1',
        name: 'update_manuscript',
        result: { success: true, message: 'done' },
      });
      expect(responses[0].id).toBe('rand-1');
      vi.stubGlobal('crypto', originalCrypto as Crypto);
    });

    it('does not append reflection for non-significant tools', async () => {
      const runner = new ToolRunner(getMocks());
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'done',
      } satisfies ToolResult);

      const responses = await runner.processToolCalls([
        { id: 'call-4', name: 'non_significant', args: {} },
      ]);

      expect(responses[0].response.result).toBe('done');
    });

    it('handles execution errors and surfaces them', async () => {
      const runner = new ToolRunner(getMocks());
      mockExecute.mockRejectedValueOnce(new Error('boom'));

      const responses = await runner.processToolCalls([
        { id: 'call-3', name: 'update_manuscript', args: {} },
      ]);

      expect(responses[0].response.result).toContain('Error executing update_manuscript');
      expect(mockOnMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Tool error: boom'),
      }));
      expect(mockOnStateChange).toHaveBeenCalledWith({ status: 'error', lastError: 'boom' });
      expect(mockOnToolCallEnd).toHaveBeenCalledWith({
        id: 'call-3',
        name: 'update_manuscript',
        result: { success: false, message: expect.stringContaining('Error executing update_manuscript'), error: 'boom' },
      });
    });
  });

  describe('maybeSuggestBedsideNoteRefresh', () => {
    it('skips when no project id or no significant action', async () => {
      const runner = new ToolRunner({ ...getMocks(), getProjectId: vi.fn(() => null) });
      await runner.maybeSuggestBedsideNoteRefresh('something');
      expect(getOrCreateBedsideNote).not.toHaveBeenCalled();
    });

    it('suggests update when conversation differs from note', async () => {
      const runner = new ToolRunner(getMocks());
      (runner as any).significantActionSeen = true;
      vi.mocked(getOrCreateBedsideNote).mockResolvedValueOnce({ ...baseNote, text: 'old note' });

      await runner.maybeSuggestBedsideNoteRefresh('new stuff');

      expect(getOrCreateBedsideNote).toHaveBeenCalledWith('project-1');
      expect(mockOnMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Bedside note may need an update'),
      }));
    });

    it('does not suggest when conversation is contained in note', async () => {
      const runner = new ToolRunner(getMocks());
      (runner as any).significantActionSeen = true;
      vi.mocked(getOrCreateBedsideNote).mockResolvedValueOnce({ ...baseNote, text: 'contains new stuff here' });

      await runner.maybeSuggestBedsideNoteRefresh('new stuff');

      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it('skips suggestion when bedside note already updated this turn', async () => {
      const runner = new ToolRunner(getMocks());
      (runner as any).significantActionSeen = true;
      (runner as any).bedsideNoteUpdatedThisTurn = true;

      await runner.maybeSuggestBedsideNoteRefresh('new stuff');

      expect(getOrCreateBedsideNote).not.toHaveBeenCalled();
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it('logs warning but does not throw on fetch failure', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runner = new ToolRunner(getMocks());
      (runner as any).significantActionSeen = true;
      vi.mocked(getOrCreateBedsideNote).mockRejectedValueOnce(new Error('fail'));

      await expect(runner.maybeSuggestBedsideNoteRefresh('new stuff')).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
