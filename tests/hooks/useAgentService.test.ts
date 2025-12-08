import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_PERSONAS } from '@/types/personas';
import type { EditorContext } from '@/types';

/**
 * @fileoverview Tests for useAgentService hook.
 *
 * Mocks DefaultAgentController entirely to avoid loading heavy Gemini dependencies
 * and focuses on testing the hook's state management, message handling, and
 * controller integration.
 */
const { MockDefaultAgentController, mockControllerInstance } = vi.hoisted(() => {
  const mockControllerInstance = {
    initializeChat: vi.fn(),
    sendMessage: vi.fn(),
    dispose: vi.fn(),
    abortCurrentRequest: vi.fn(),
    getCurrentPersona: vi.fn(),
    getState: vi.fn(() => ({ status: 'idle' })),
    resetSession: vi.fn(),
    setPersona: vi.fn(),
    // Internal event handlers - will be set during construction
    _events: null as any,
  };

  class MockDefaultAgentController {
    constructor(args: any) {
      mockControllerInstance._events = args.events;
      mockControllerInstance.getCurrentPersona.mockReturnValue(args.initialPersona);
    }
    initializeChat = mockControllerInstance.initializeChat;
    sendMessage = mockControllerInstance.sendMessage;
    dispose = mockControllerInstance.dispose;
    abortCurrentRequest = mockControllerInstance.abortCurrentRequest;
    getCurrentPersona = mockControllerInstance.getCurrentPersona;
    getState = mockControllerInstance.getState;
    resetSession = mockControllerInstance.resetSession;
    setPersona = mockControllerInstance.setPersona;
  }

  return { MockDefaultAgentController, mockControllerInstance };
});

// Mock the AgentController module entirely to avoid heavy imports
vi.mock('@/services/core/AgentController', () => ({
  DefaultAgentController: MockDefaultAgentController,
}));

// Mock settings store
vi.mock('@/features/settings', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      critiqueIntensity: 'standard',
      experienceLevel: 'intermediate',
      autonomyMode: 'copilot',
    }),
}));

// Mock memory context fetcher
vi.mock('@/services/core/agentSession', () => ({
  fetchMemoryContext: vi.fn(async () => '[AGENT MEMORY]'),
}));

// Now import the hook after mocks are set up
import { useAgentService } from '@/features/agent/hooks/useAgentService';

/**
 * @description Tests for useAgentService hook.
 */
describe('useAgentService', () => {
  /**
   * Standard editor context for tests.
   */
  const baseContext: EditorContext = {
    cursorPosition: 0,
    selection: null,
    totalLength: 20,
  };

  /**
   * Factory for creating test chapter data.
   * @param overrides Optional overrides for chapter data.
   */
  const makeChapter = (overrides = {}) => ({
    id: 'ch1',
    projectId: 'p1',
    title: 'Chapter 1',
    content: 'Hello world',
    order: 0,
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockControllerInstance.initializeChat.mockClear();
    mockControllerInstance.sendMessage.mockClear();
    mockControllerInstance.dispose.mockClear();
    mockControllerInstance._events = null;
  });

  it('initializes the controller with correct context on mount', async () => {
    const onToolAction = vi.fn();
    const chapters = [makeChapter()];

    renderHook(() =>
      useAgentService('Hello world', {
        chapters,
        analysis: null,
        onToolAction,
      }),
    );

    // Controller should be initialized
    await waitFor(() => {
      expect(mockControllerInstance.initializeChat).toHaveBeenCalled();
    });
  });

  it('delegates sendMessage to the controller', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('Hello agent', baseContext);
    });

    expect(mockControllerInstance.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hello agent',
        editorContext: baseContext,
      }),
    );
  });

  it('ignores empty or whitespace-only messages', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('   ', baseContext);
    });

    // sendMessage should not be called for whitespace
    expect(mockControllerInstance.sendMessage).not.toHaveBeenCalled();
  });

  it('updates state when controller emits state changes', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    // Simulate controller emitting state change
    await act(async () => {
      mockControllerInstance._events?.onStateChange?.({ status: 'thinking' });
    });

    expect(result.current.agentState.status).toBe('thinking');
    expect(result.current.isProcessing).toBe(true);

    // Simulate returning to idle
    await act(async () => {
      mockControllerInstance._events?.onStateChange?.({ status: 'idle' });
    });

    expect(result.current.agentState.status).toBe('idle');
    expect(result.current.isProcessing).toBe(false);
  });

  it('appends messages when controller emits onMessage', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    // Simulate controller emitting messages
    await act(async () => {
      mockControllerInstance._events?.onMessage?.({
        role: 'user',
        text: 'Test message',
        timestamp: new Date(),
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('Test message');
  });

  it('clears messages and calls resetSession', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    // Add some messages
    await act(async () => {
      mockControllerInstance._events?.onMessage?.({
        role: 'user',
        text: 'Message 1',
        timestamp: new Date(),
      });
      mockControllerInstance._events?.onMessage?.({
        role: 'model',
        text: 'Reply 1',
        timestamp: new Date(),
      });
    });

    expect(result.current.messages.length).toBe(2);

    // Clear messages
    await act(async () => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('switches persona and announces the change', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
        initialPersona: DEFAULT_PERSONAS[0],
      }),
    );

    const newPersona = DEFAULT_PERSONAS[1];

    await act(async () => {
      result.current.setPersona(newPersona);
    });

    expect(result.current.currentPersona).toBe(newPersona);
  });

  it('applies a rolling message limit', async () => {
    const onToolAction = vi.fn();
    const messageLimit = 3;

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
        messageLimit,
      }),
    );

    // Add more messages than the limit
    await act(async () => {
      for (let i = 1; i <= 5; i++) {
        mockControllerInstance._events?.onMessage?.({
          role: 'user',
          text: `Message ${i}`,
          timestamp: new Date(),
        });
      }
    });

    expect(result.current.messages.length).toBe(messageLimit);
    expect(result.current.messages[0].text).toBe('Message 3');
    expect(result.current.messages[2].text).toBe('Message 5');
  });

  it('disposes controller on unmount', async () => {
    const onToolAction = vi.fn();

    const { unmount } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    unmount();

    expect(mockControllerInstance.dispose).toHaveBeenCalled();
  });

  it('calls abortCurrentRequest on resetSession', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    await act(async () => {
      result.current.resetSession();
    });

    expect(mockControllerInstance.abortCurrentRequest).toHaveBeenCalled();
  });

  it('handles error state from controller', async () => {
    const onToolAction = vi.fn();

    const { result } = renderHook(() =>
      useAgentService('Hello world', {
        chapters: [makeChapter()],
        analysis: null,
        onToolAction,
      }),
    );

    // Simulate controller emitting error state
    await act(async () => {
      mockControllerInstance._events?.onStateChange?.({
        status: 'error',
        lastError: 'Connection failed',
      });
    });

    expect(result.current.agentState.status).toBe('error');
    expect(result.current.agentState.lastError).toBe('Connection failed');
    expect(result.current.isProcessing).toBe(false);
  });
});
