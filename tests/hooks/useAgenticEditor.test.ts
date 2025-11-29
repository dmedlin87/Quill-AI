import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgenticEditor, type UseAgenticEditorOptions } from '@/features/agent/hooks/useAgenticEditor';
import type { ToolActionHandler } from '@/features/agent/hooks/useAgentService';
import type { EditorContext } from '@/types';

const mockSendMessage = vi.fn();
const mockResetSession = vi.fn();
const mockClearMessages = vi.fn();
let capturedToolHandler: ToolActionHandler | null = null;

vi.mock('@/features/agent/hooks/useAgentService', () => ({
  useAgentService: (_fullText: string, { onToolAction }: { onToolAction: ToolActionHandler }) => {
    capturedToolHandler = onToolAction;
    return {
      messages: [],
      agentState: { status: 'idle' as const },
      isProcessing: false,
      sendMessage: mockSendMessage,
      resetSession: mockResetSession,
      clearMessages: mockClearMessages,
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
    renderHook(() =>
      useAgenticEditor({
        editorActions,
        chapters: [],
        analysis: null,
        ...options,
      }),
    );

    if (!capturedToolHandler) throw new Error('Tool handler was not captured');
    return capturedToolHandler;
  };

  beforeEach(() => {
    currentText = 'The quick brown fox jumps over the lazy dog';
    capturedToolHandler = null;
    vi.clearAllMocks();
  });

  it('returns errors when update_manuscript arguments are missing or text is not found', async () => {
    const handleToolAction = renderEditorHook();

    await expect(handleToolAction('update_manuscript', { oldText: '', newText: 'Hi' })).resolves.toBe(
      'Error: Missing oldText or newText parameters',
    );

    await expect(handleToolAction('update_manuscript', { oldText: 'Missing text', newText: 'Hi' })).resolves.toBe(
      'Error: Could not find the text "Missing text..." in the document',
    );
  });

  it('short-circuits manuscript updates when the review callback rejects', async () => {
    const onPendingEdit = vi.fn().mockResolvedValue(false);
    const handleToolAction = renderEditorHook({ onPendingEdit });

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

  it('returns correct status for undo and redo tool outcomes', async () => {
    const handleToolAction = renderEditorHook();

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
    const handleToolAction = renderEditorHook();

    const context = await handleToolAction('get_text_context', { start: 4, end: 9 });
    expect(context).toBe('quick');

    const searchResult = await handleToolAction('search_text', { query: 'brown' });
    const parsed = JSON.parse(searchResult);

    expect(parsed).toMatchObject({ found: true, index: 10 });
    expect(parsed.context).toContain('brown');
  });
});
