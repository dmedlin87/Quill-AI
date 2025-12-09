import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAgentOrchestrator } from '@/features/agent/hooks/useAgentOrchestrator';

const createMockSmartContext = () => ({
  context: 'SMART-CONTEXT',
  tokenCount: 100,
  sectionsIncluded: ['manuscript'],
  sectionsTruncated: [],
  sectionsOmitted: [],
  budget: {
    totalTokens: 8000,
    sections: {
      manuscript: 0.2,
      intelligence: 0.2,
      analysis: 0.2,
      memory: 0.2,
      lore: 0.1,
      history: 0.1,
    },
  },
});

const {
  mockCreateAgentSession,
  mockSendMessage,
  mockUseAppBrain,
  mockExecuteAgentToolCall,
  mockGetSmartAgentContext,
  mockEmitToolExecuted,
  mockEventBus,
  brainValue,
} = vi.hoisted(() => {
  const mockSendMessage = vi.fn();
  const mockCreateAgentSession = vi.fn(() => ({
    sendMessage: mockSendMessage,
  }));

  const brainValue = {
    state: {
      manuscript: {
        projectId: 'p1',
        projectTitle: 'Test Project',
        chapters: [
          { id: 'ch1', title: 'Chapter 1', content: 'Once upon a time', order: 0, updatedAt: Date.now() },
        ],
        activeChapterId: 'ch1',
        currentText: 'Once upon a time',
        branches: [],
        activeBranchId: null,
        setting: undefined,
      },
      lore: {
        characters: [],
        worldRules: [],
        manuscriptIndex: null,
      },
      analysis: {
        result: null,
        status: 'idle',
        inlineComments: [],
      },
      intelligence: {
        hud: null,
        full: null,
        entities: null,
        timeline: null,
        style: null,
        heatmap: null,
        lastProcessedAt: 0,
      },
      ui: {
        cursor: { position: 0, scene: null, paragraph: null },
        selection: null,
        activePanel: 'chat',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone: { status: 'idle', mode: 'voice', lastTranscript: null, error: null },
      },
      session: {
        chatHistory: [],
        currentPersona: null,
        pendingToolCalls: [],
        lastAgentAction: null,
        isProcessing: false,
      },
    },
    actions: {},
    context: {
      getCompressedContext: () => 'COMPRESSED-CONTEXT',
    },
  };

  const mockUseAppBrain = vi.fn(() => brainValue);

  const mockExecuteAgentToolCall = vi.fn(async () => ({
    success: true,
    message: 'tool-ok',
  }));

  const mockGetSmartAgentContext = vi.fn(async () => createMockSmartContext());
  const mockEmitToolExecuted = vi.fn();
  const mockEventBus = {
    getChangeLog: vi.fn(() => []),
    subscribeForOrchestrator: vi.fn(() => () => {}),
  };

  return {
    mockCreateAgentSession,
    mockSendMessage,
    mockUseAppBrain,
    mockExecuteAgentToolCall,
    mockGetSmartAgentContext,
    mockEmitToolExecuted,
    mockEventBus,
    brainValue,
  };
});

vi.mock('@/services/gemini/agent', () => ({
  createAgentSession: mockCreateAgentSession,
}));

vi.mock('@/features/core', () => ({
  useAppBrain: mockUseAppBrain,
  useAppBrainState: (selector: any, _shallow?: any) => selector(brainValue.state),
  useAppBrainActions: () => brainValue.actions,
}));

vi.mock('@/services/gemini/toolExecutor', () => ({
  executeAgentToolCall: mockExecuteAgentToolCall,
}));

vi.mock('@/services/appBrain', () => ({
  emitToolExecuted: mockEmitToolExecuted,
  eventBus: mockEventBus,
  getSmartAgentContext: mockGetSmartAgentContext,
}));

vi.mock('@/features/settings', () => ({
  useSettingsStore: (selector: any) => selector({
    critiqueIntensity: 'standard',
    experienceLevel: 'intermediate',
    autonomyMode: 'copilot',
  }),
}));

describe('useAgentOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockReset();
    mockCreateAgentSession.mockReset();
    mockCreateAgentSession.mockImplementation(() => ({
      sendMessage: mockSendMessage,
    }));
    mockExecuteAgentToolCall.mockReset();
    mockExecuteAgentToolCall.mockResolvedValue({ success: true, message: 'tool-ok' });
    mockGetSmartAgentContext.mockResolvedValue(createMockSmartContext());
    mockEmitToolExecuted.mockReset();
    mockEventBus.getChangeLog.mockReturnValue([]);
    mockEventBus.subscribeForOrchestrator.mockReturnValue(() => {});
  });

  it('respects autoReinit=false and does not reinitialize on context change', async () => {
    mockSendMessage.mockResolvedValue({ text: '' });

    const { result, rerender } = renderHook(() => useAgentOrchestrator({ autoReinit: false }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mockCreateAgentSession).toHaveBeenCalledTimes(1);

    act(() => {
      brainValue.state.ui.selection = { text: 'select', start: 0, end: 5 } as any;
    });
    rerender();

    // No additional session initialization when autoReinit is off
    expect(mockCreateAgentSession).toHaveBeenCalledTimes(1);
  });

  it('falls back to editor context when smart context fails and selection exists', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({ text: 'Fallback response' });

    mockGetSmartAgentContext.mockRejectedValueOnce(new Error('smart context down'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      brainValue.state.ui.selection = { text: 'sel', start: 1, end: 4 };
    });

    await act(async () => {
      await result.current.sendMessage('Needs fallback');
    });

    await waitFor(() => {
      expect(result.current.messages.some(m => m.text === 'Fallback response')).toBe(true);
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('emits failed tool executions when executeAgentToolCall returns error', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ id: 'call-err', name: 'update_manuscript', args: {} }],
      })
      .mockResolvedValueOnce({ text: 'After failure' });

    mockExecuteAgentToolCall.mockResolvedValueOnce({
      success: false,
      message: 'bad tool',
    });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Run failing tool');
    });

    await waitFor(() => {
      expect(result.current.state.lastToolCall).toEqual({
        name: 'update_manuscript',
        success: false,
      });
    });

    expect(mockEmitToolExecuted).toHaveBeenCalledWith('update_manuscript', false);
  });

  it('initializes session and marks isReady', async () => {
    mockSendMessage.mockResolvedValueOnce({ text: '' });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(result.current.state.status).toBe('idle');
    });

    expect(mockCreateAgentSession).toHaveBeenCalledTimes(1);
  });

  it('sends a message and transitions through thinking back to idle', async () => {
    // First call: initialization message
    mockSendMessage.mockResolvedValueOnce({ text: '' });
    // Second call: user request without tool calls
    mockSendMessage.mockResolvedValueOnce({ text: 'Agent reply' });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Help me',);
    });

    expect(mockGetSmartAgentContext).toHaveBeenCalledTimes(1);
    expect(mockGetSmartAgentContext).toHaveBeenCalledWith(
      brainValue.state,
      'p1',
      expect.objectContaining({ mode: 'text', queryType: expect.any(String) }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('idle');
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.messages.some(m => m.role === 'user')).toBe(true);
      expect(result.current.messages.some(m => m.role === 'model' && m.text === 'Agent reply' || m.text === 'Done.')).toBe(true);
    });
  });

  it('ignores empty or whitespace-only messages', async () => {
    // Init
    mockSendMessage.mockResolvedValueOnce({ text: '' });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const initialMessagesLength = result.current.messages.length;

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    // No additional chat calls beyond initialization
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(result.current.messages.length).toBe(initialMessagesLength);
  });

  it('handles a simple tool call round trip', async () => {
    // Init
    mockSendMessage.mockResolvedValueOnce({ text: '' });
    // First user send: returns one tool call
    mockSendMessage.mockResolvedValueOnce({
      text: '',
      functionCalls: [
        { id: 'call-1', name: 'update_manuscript', args: { foo: 'bar' } },
      ],
    });
    // Second send (after tool execution) returns final text
    mockSendMessage.mockResolvedValueOnce({ text: 'After tools' });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Run a tool');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.lastToolCall).toEqual({ name: 'update_manuscript', success: true });
    });

    expect(mockExecuteAgentToolCall).toHaveBeenCalledWith(
      'update_manuscript',
      { foo: 'bar' },
      brainValue.actions,
      'p1',
    );
  });

  it('reinitializes the agent session when context changes with autoReinit enabled', async () => {
    mockSendMessage.mockResolvedValue({ text: '' });

    const { result, rerender } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mockCreateAgentSession).toHaveBeenCalledTimes(1);

    act(() => {
      brainValue.state.analysis = {
        ...brainValue.state.analysis,
        result: 'New analysis ready',
      } as any;
    });

    rerender();

    await waitFor(() => {
      expect(mockCreateAgentSession).toHaveBeenCalledTimes(2);
    });
  });

  it('exposes voice mode flag when initialized in voice mode', async () => {
    mockSendMessage.mockResolvedValueOnce({ text: '' });

    const { result } = renderHook(() => useAgentOrchestrator({ mode: 'voice' }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isVoiceMode).toBe(true);
  });
 
  it('aborts an in-flight request without adding a final model message', async () => {
    let resolveSecond: ((value: any) => void) | undefined;

    mockSendMessage.mockResolvedValueOnce({ text: '' });
    mockSendMessage.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSecond = resolve;
        }),
    );

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      void result.current.sendMessage('Will abort');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('thinking');
    });

    act(() => {
      result.current.abort();
    });

    await act(async () => {
      resolveSecond?.({ text: 'Should not be shown', functionCalls: [] });
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('idle');
    });

    const modelMessages = result.current.messages.filter(m => m.role === 'model');
    expect(modelMessages.some(m => m.text === 'Should not be shown')).toBe(false);
  });

  it('prunes older messages when the limit is exceeded', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({ text: 'Reply 1' })
      .mockResolvedValueOnce({ text: 'Reply 2' });

    const { result } = renderHook(() => useAgentOrchestrator({ messageLimit: 3 }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('First');
      await result.current.sendMessage('Second');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(3);
    });

    const texts = result.current.messages.map(m => m.text);
    expect(texts).not.toContain('First');
    expect(texts).toContain('Second');
    expect(texts).toContain('Reply 2');
  });

  it('records failed tool executions when the tool call returns an error result', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ id: 'call-1', name: 'update_manuscript', args: { foo: 'bar' } }],
      })
      .mockResolvedValueOnce({ text: 'After failure' });

    mockExecuteAgentToolCall.mockResolvedValueOnce({
      success: false,
      message: 'tool failure',
    });

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Run a failing tool');
    });

    await waitFor(() => {
      expect(result.current.state.lastToolCall).toEqual({
        name: 'update_manuscript',
        success: false,
      });
    });

    expect(mockEmitToolExecuted).toHaveBeenCalledWith('update_manuscript', false);
  });

  it('captures exceptions from tool executions and surfaces a failure message', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ id: 'call-2', name: 'update_manuscript', args: { foo: 'bar' } }],
      })
      .mockResolvedValueOnce({ text: 'After error' });

    mockExecuteAgentToolCall.mockRejectedValueOnce(new Error('boom tool'));

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Trigger tool exception');
    });

    await waitFor(() => {
      expect(result.current.state.lastToolCall?.success).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.messages.some(m => m.text.includes('update_manuscript failed'))).toBe(true);
    });
    expect(mockEmitToolExecuted).toHaveBeenCalledWith('update_manuscript', false);
  });

  it('falls back to editor context when smart context resolution fails', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({ text: 'Fallback response' });

    mockGetSmartAgentContext.mockRejectedValueOnce(new Error('smart context down'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAgentOrchestrator());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.sendMessage('Needs fallback');
    });

    await waitFor(() => {
      expect(result.current.messages.some(m => m.text === 'Fallback response')).toBe(true);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AgentOrchestrator] Smart context unavailable, using editor fallback:'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
