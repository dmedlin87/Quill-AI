import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgenticEditor, type UseAgenticEditorOptions } from '@/features/agent/hooks/useAgenticEditor';
import type { ToolActionHandler } from '@/features/agent/hooks/useAgentService';
import type { EditorContext } from '@/types';

const mockSendMessage = vi.fn();
const mockResetSession = vi.fn();
const mockClearMessages = vi.fn();
let mockAgentState: { status: 'idle' | 'thinking' | 'executing' | 'error'; lastError?: string } = {
  status: 'idle',
};
let mockIsProcessing = false;
let capturedToolHandler: ToolActionHandler | null = null;
let simulateToolCall: { toolName: string; args: Record<string, unknown> } | null = null;

vi.mock('@/features/agent/hooks/useAgentService', () => ({
  useAgentService: (_fullText: string, { onToolAction }: { onToolAction: ToolActionHandler }) => {
    capturedToolHandler = onToolAction;
    return {
      messages: [],
      agentState: mockAgentState,
      isProcessing: mockIsProcessing,
      async sendMessage(message: string, context: EditorContext) {
        mockSendMessage(message, context);
        if (simulateToolCall) {
          await onToolAction(simulateToolCall.toolName, simulateToolCall.args);
        }
      },
      resetSession: mockResetSession,
      clearMessages: mockClearMessages,
      setPersona: vi.fn(),
    };
  },
}));

describe('useAgenticEditor tool actions', () => {
  let currentText = 'The quick brown fox jumps over the lazy dog';
  const editorActions = {
    updateText: vi.fn((text: string) => {
      currentText = text;
    }),
    undo: vi.fn(() => true),
    redo: vi.fn(() => true),
    getEditorContext: vi.fn((): EditorContext => ({
      cursorPosition: 0,
      selection: null,
      totalLength: currentText.length,
    })),
    getCurrentText: vi.fn(() => currentText),
  };

  const renderEditorHook = (options: Partial<UseAgenticEditorOptions> = {}) => {
    const { result } = renderHook(() =>
      useAgenticEditor({
        editorActions,
        chapters: [],
        analysis: null,
        ...options,
      }),
    );

    if (!capturedToolHandler) throw new Error('Tool handler was not captured');
    return { result, handleToolAction: capturedToolHandler };
  };

  beforeEach(() => {
    currentText = 'The quick brown fox jumps over the lazy dog';
    capturedToolHandler = null;
    mockAgentState = { status: 'idle' as const };
    mockIsProcessing = false;
    simulateToolCall = null;
    vi.clearAllMocks();
  });

  it('returns errors when update_manuscript arguments are missing or text is not found', async () => {
    const { handleToolAction } = renderEditorHook();

    await expect(handleToolAction('update_manuscript', { oldText: '', newText: 'Hi' })).resolves.toBe(
      'Error: Missing oldText or newText parameters',
    );

    await expect(handleToolAction('update_manuscript', { oldText: 'Missing text', newText: 'Hi' })).resolves.toBe(
      'Error: Could not find the text "Missing text..." in the document',
    );
  });

  it('short-circuits manuscript updates when the review callback rejects', async () => {
    const onPendingEdit = vi.fn().mockResolvedValue(false);
    const { handleToolAction } = renderEditorHook({ onPendingEdit });

    const result = await handleToolAction('update_manuscript', { oldText: 'quick', newText: 'slow' });

    expect(result).toBe('Edit rejected by user');
    expect(onPendingEdit).toHaveBeenCalledWith({
      oldText: 'quick',
      newText: 'slow',
      description: expect.stringContaining('Agent edit'),
    });
    expect(editorActions.updateText).not.toHaveBeenCalled();
    expect(currentText).toBe('The quick brown fox jumps over the lazy dog');
  });

  it('propagates errors from the review callback without applying edits', async () => {
    const error = new Error('Review failed');
    const onPendingEdit = vi.fn().mockRejectedValue(error);
    const { handleToolAction } = renderEditorHook({ onPendingEdit });

    await expect(
      handleToolAction('update_manuscript', { oldText: 'quick', newText: 'slow' }),
    ).rejects.toBe(error);

    expect(onPendingEdit).toHaveBeenCalled();
    expect(editorActions.updateText).not.toHaveBeenCalled();
  });

  it('returns correct status for undo and redo tool outcomes', async () => {
    const { handleToolAction } = renderEditorHook();

    editorActions.undo.mockReturnValueOnce(true);
    await expect(handleToolAction('undo_last_change', {})).resolves.toBe('Undid the last change');

    editorActions.undo.mockReturnValueOnce(false);
    await expect(handleToolAction('undo_last_change', {})).resolves.toBe('Nothing to undo');

    editorActions.redo.mockReturnValueOnce(true);
    await expect(handleToolAction('redo_last_change', {})).resolves.toBe('Redid the last change');

    editorActions.redo.mockReturnValueOnce(false);
    await expect(handleToolAction('redo_last_change', {})).resolves.toBe('Nothing to redo');
  });

  it('returns text slices and search results for context tools', async () => {
    const { handleToolAction } = renderEditorHook();

    const context = await handleToolAction('get_text_context', { start: 4, end: 9 });
    expect(context).toBe('quick');

    const searchResult = await handleToolAction('search_text', { query: 'brown' });
    const parsed = JSON.parse(searchResult);

    expect(parsed).toMatchObject({ found: true, index: 10 });
    expect(parsed.context).toContain('brown');
  });

  it('returns a helpful message when search_text query is not found', async () => {
    const { handleToolAction } = renderEditorHook();

    const result = await handleToolAction('search_text', { query: 'missing' });

    expect(result).toBe('Text "missing" not found in document');
  });

  it('returns an unknown tool message for unsupported tools', async () => {
    const { handleToolAction } = renderEditorHook();

    const result = await handleToolAction('nonexistent_tool', {});

    expect(result).toBe('Unknown tool: nonexistent_tool');
  });

  it('forwards sendMessage calls with editor context to the agent service', async () => {
    const { result } = renderEditorHook();

    await act(async () => {
      await result.current.sendMessage('Help me edit this');
    });

    expect(editorActions.getEditorContext).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const [messageArg, contextArg] = mockSendMessage.mock.calls[0];
    expect(messageArg).toBe('Help me edit this');
    expect(contextArg).toEqual({
      cursorPosition: 0,
      selection: null,
      totalLength: currentText.length,
    });
  });

  it('applies manuscript updates when the agent triggers update_manuscript via the service', async () => {
    simulateToolCall = {
      toolName: 'update_manuscript',
      args: { oldText: 'quick', newText: 'slow' },
    };

    const onPendingEdit = vi.fn().mockResolvedValue(true);
    const { result } = renderEditorHook({ onPendingEdit });

    await act(async () => {
      await result.current.sendMessage('Please revise this sentence');
    });

    expect(onPendingEdit).toHaveBeenCalledWith({
      oldText: 'quick',
      newText: 'slow',
      description: expect.stringContaining('Agent edit'),
    });

    expect(editorActions.updateText).toHaveBeenCalledWith(
      'The slow brown fox jumps over the lazy dog',
      'Agent: Manuscript update',
    );
  });

  it('exposes agent state and processing flag from the underlying service', () => {
    mockAgentState = { status: 'error', lastError: 'Boom' };
    mockIsProcessing = true;

    const { result } = renderEditorHook();

    expect(result.current.agentState).toEqual(mockAgentState);
    expect(result.current.isProcessing).toBe(true);
  });
});
