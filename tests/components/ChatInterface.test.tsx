import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { RateLimitError, AIError } from '@/services/gemini/errors';

const { MockQuillAgent, mockCreateAgentSession, mockSendMessage, mockInitialize } = vi.hoisted(() => {
  const sendMessage = vi.fn();
  const initialize = vi.fn().mockResolvedValue(undefined);

  class QuillAgentMock {
    public initialize = initialize;
    public sendMessage = sendMessage;
  }

  const createAgentSession = vi.fn(function MockedQuillAgentConstructor() {
    return new QuillAgentMock();
  });

  return {
    MockQuillAgent: QuillAgentMock,
    mockCreateAgentSession: createAgentSession,
    mockSendMessage: sendMessage,
    mockInitialize: initialize,
  };
});

vi.mock('@/services/gemini/agent', () => ({
  QuillAgent: mockCreateAgentSession,
}));

import { ChatInterface } from '@/features/agent/components/ChatInterface';
import { DEFAULT_PERSONAS } from '@/types/personas';
import { EditorContext } from '@/types';

const baseContext: EditorContext = {
  cursorPosition: 0,
  selection: null,
  totalLength: 0,
};

const baseProps = {
  editorContext: baseContext,
  fullText: 'Example manuscript',
  onAgentAction: vi.fn().mockResolvedValue('action complete'),
  chapters: [],
};

const typeAndSend = async (text: string) => {
  let input: HTMLElement | null = null;
  await act(async () => {
    input = await screen.findByPlaceholderText(/Type \/ to use tools/i);
    const sendButton = screen.getAllByRole('button').at(-1);

    expect(sendButton).toBeTruthy();

    fireEvent.change(input!, { target: { value: text } });
    fireEvent.click(sendButton!);
  });

  return input!;
};

describe('ChatInterface', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mockSendMessage.mockReset();
    mockInitialize.mockReset();
    mockSendMessage.mockResolvedValue({ text: '', functionCalls: [] });
    mockCreateAgentSession.mockClear();
    baseProps.onAgentAction = vi.fn().mockResolvedValue('action complete');
  });

  it('renders with persona selector and input', async () => {
    render(<ChatInterface {...baseProps} />);

    expect(await screen.findByTitle(`Current: ${DEFAULT_PERSONAS[0].name}`)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type \/ to use tools/i)).toBeInTheDocument();
  });

  it('initializes the session with the introductory message', async () => {
    render(<ChatInterface {...baseProps} />);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        message: expect.stringContaining('I have loaded the manuscript'),
      });
    });
  });

  it('sends user messages and displays agent responses', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({ text: 'Agent reply', functionCalls: [] });

    render(<ChatInterface {...baseProps} />);

    await typeAndSend('Hello agent');

    await waitFor(() => {
      expect(screen.getByText('Hello agent')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Agent reply')).toBeInTheDocument();
    });

    expect(mockCreateAgentSession).toHaveBeenCalled();
    expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('appends a persona change message when switching personas', async () => {
    render(<ChatInterface {...baseProps} />);

    const personaButton = await screen.findByTitle(`Current: ${DEFAULT_PERSONAS[0].name}`);
    fireEvent.click(personaButton);

    const nextPersona = DEFAULT_PERSONAS[1];
    fireEvent.click(await screen.findByText(nextPersona.name));

    await waitFor(() => {
      expect(
        screen.getByText(`${nextPersona.icon} Switching to ${nextPersona.name} mode. ${nextPersona.role}.`),
      ).toBeInTheDocument();
    });
  });

  it('renders tool status messages and follow-up responses for function calls', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { id: '1', name: 'applyEdit', args: { text: 'Update' } },
        ],
      })
      .mockResolvedValueOnce({ text: 'Final response', functionCalls: [] });

    const onAgentAction = vi.fn().mockResolvedValue('Waiting for user review: Applied change');

    render(<ChatInterface {...baseProps} onAgentAction={onAgentAction} />);

    await typeAndSend('Please edit');

    await waitFor(() => {
      expect(screen.getByText(/🛠️ Suggesting Action: applyEdit/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/📝 Reviewing proposed edit/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Final response')).toBeInTheDocument();
    });

    expect(onAgentAction).toHaveBeenCalledWith('applyEdit', { text: 'Update' });
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
  });

  it('shows a fallback error message when sending fails', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockRejectedValueOnce(new Error('network fail'));

    render(<ChatInterface {...baseProps} />);

    await typeAndSend('Trigger error');

    await waitFor(() => {
      expect(
        screen.getByText('Sorry, I encountered an error connecting to the Agent.'),
      ).toBeInTheDocument();
    });
  });

  it('shows a cool-down message when a RateLimitError is thrown', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockRejectedValueOnce(new RateLimitError());

    render(<ChatInterface {...baseProps} />);

    await typeAndSend('Trigger rate limit');

    await waitFor(() => {
      expect(
        screen.getByText('The AI is cooling down. Please wait a moment.'),
      ).toBeInTheDocument();
    });
  });

  it('shows the AIError message when an AIError is thrown', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockRejectedValueOnce(new AIError('Something went wrong inside the agent'));

    render(<ChatInterface {...baseProps} />);

    await typeAndSend('Trigger AI error');

    await waitFor(() => {
      expect(
        screen.getByText('Something went wrong inside the agent'),
      ).toBeInTheDocument();
    });
  });

  // NEW: Tool execution loop with multi-turn conversation
  it('executes complete tool loop: user message → tool call → tool result → final response', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      // First response: tool call
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { id: 'tool-1', name: 'update_manuscript', args: { content: 'Fixed typo' } },
        ],
      })
      // Second response after tool result: final text
      .mockResolvedValueOnce({ text: 'I have fixed the typo for you.', functionCalls: [] });

    const onAgentAction = vi.fn().mockResolvedValue('Waiting for user review: Edit pending');

    render(<ChatInterface {...baseProps} onAgentAction={onAgentAction} />);

    await typeAndSend('Fix typo');

    // Step 1: Tool call message appears
    await waitFor(() => {
      expect(screen.getByText(/🛠️ Suggesting Action: update_manuscript/)).toBeInTheDocument();
    });

    // Step 2: onAgentAction is called
    await waitFor(() => {
      expect(onAgentAction).toHaveBeenCalledWith('update_manuscript', { content: 'Fixed typo' });
    });

    // Step 3: Review status appears
    await waitFor(() => {
      expect(screen.getByText(/📝 Reviewing proposed edit/)).toBeInTheDocument();
    });

    // Step 4: Tool result sent back to model
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.arrayContaining([
            expect.objectContaining({
              functionResponse: expect.objectContaining({
                id: 'tool-1',
                name: 'update_manuscript',
                response: { result: 'Waiting for user review: Edit pending' },
              }),
            }),
          ]),
        })
      );
    });

    // Step 5: Final response displayed
    await waitFor(() => {
      expect(screen.getByText('I have fixed the typo for you.')).toBeInTheDocument();
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(3); // init + user msg + tool response
  });

  // NEW: Tool execution failure handling
  it('handles tool execution failure and sends error back to model', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { id: 'tool-2', name: 'invalid_action', args: {} },
        ],
      })
      .mockResolvedValueOnce({ text: 'I apologize for the error.', functionCalls: [] });

    const onAgentAction = vi.fn().mockRejectedValue(new Error('Tool not found'));

    render(<ChatInterface {...baseProps} onAgentAction={onAgentAction} />);

    await typeAndSend('Do invalid action');

    // Error message should be displayed
    await waitFor(() => {
      expect(screen.getByText(/❌ Error: Tool not found/)).toBeInTheDocument();
    });

    // Error should be sent back to model as function response
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.arrayContaining([
            expect.objectContaining({
              functionResponse: expect.objectContaining({
                id: 'tool-2',
                name: 'invalid_action',
                response: { result: 'Tool not found' },
              }),
            }),
          ]),
        })
      );
    });

    // Agent should respond after error
    await waitFor(() => {
      expect(screen.getByText('I apologize for the error.')).toBeInTheDocument();
    });
  });

  // NEW: Multiple sequential tool calls
  it('handles multiple tool calls in sequence', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { id: 'tool-a', name: 'analyze', args: { type: 'grammar' } },
          { id: 'tool-b', name: 'applyEdit', args: { text: 'corrected' } },
        ],
      })
      .mockResolvedValueOnce({ text: 'All corrections applied.', functionCalls: [] });

    const onAgentAction = vi.fn()
      .mockResolvedValueOnce('Analysis complete')
      .mockResolvedValueOnce('Edit applied');

    render(<ChatInterface {...baseProps} onAgentAction={onAgentAction} />);

    await typeAndSend('Analyze and fix');

    // Both tool calls should appear
    await waitFor(() => {
      expect(screen.getByText(/🛠️ Suggesting Action: analyze/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/🛠️ Suggesting Action: applyEdit/)).toBeInTheDocument();
    });

    // Both tools should be executed
    await waitFor(() => {
      expect(onAgentAction).toHaveBeenCalledWith('analyze', { type: 'grammar' });
      expect(onAgentAction).toHaveBeenCalledWith('applyEdit', { text: 'corrected' });
    });

    // Both function responses sent back together
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.arrayContaining([
            expect.objectContaining({
              functionResponse: expect.objectContaining({ id: 'tool-a' }),
            }),
            expect.objectContaining({
              functionResponse: expect.objectContaining({ id: 'tool-b' }),
            }),
          ]),
        })
      );
    });
  });

  it('toggles deep mode and includes flag in prompt', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({ text: 'Done.', functionCalls: [] });

    render(<ChatInterface {...baseProps} />);

    const deepButton = await screen.findByTitle('Deep Mode: Enables Voice Analysis.');
    expect(deepButton).toHaveTextContent(/👻 Deep/);

    fireEvent.click(deepButton);
    expect(deepButton).toHaveTextContent(/🧠 Deep/);

    await typeAndSend('Deep analyze');

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[DEEP MODE]: ON'),
        }),
      );
    });
  });

  it('auto-sends initialMessage and calls onInitialMessageProcessed', async () => {
    vi.useFakeTimers();
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({ text: 'Auto reply', functionCalls: [] });

    const onInitialMessageProcessed = vi.fn();

    render(
      <ChatInterface
        {...baseProps}
        initialMessage="Auto-send me"
        onInitialMessageProcessed={onInitialMessageProcessed}
      />
    );

    // Advance the auto-send timer
    act(() => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Auto-send me'),
        }),
      );
    });

    expect(onInitialMessageProcessed).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // NEW: User context prompt construction
  it('constructs user context prompt with cursor position and selection', async () => {
    const contextWithSelection: EditorContext = {
      cursorPosition: 42,
      selection: { text: 'selected text', start: 30, end: 43 },
      totalLength: 100,
    };

    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({ text: 'Got it!', functionCalls: [] });

    render(<ChatInterface {...baseProps} editorContext={contextWithSelection} />);

    await typeAndSend('Check this');

    // Verify context is included in the message
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Cursor Index: 42'),
        })
      );
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Selection: "selected text"'),
        })
      );
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Total Text Length: 100'),
        })
      );
    });
  });

  // NEW: Persona initialization and switching
  it('reinitializes session when persona is changed', async () => {
    mockSendMessage.mockResolvedValue({ text: 'init', functionCalls: [] });

    render(<ChatInterface {...baseProps} />);

    // Wait for initial session
    await waitFor(() => {
      expect(mockCreateAgentSession).toHaveBeenCalledTimes(1);
    });

    const initialCalls = mockCreateAgentSession.mock.calls.length;

    // Change persona
    const personaButton = await screen.findByTitle(`Current: ${DEFAULT_PERSONAS[0].name}`);
    fireEvent.click(personaButton);

    const nextPersona = DEFAULT_PERSONAS[1];
    fireEvent.click(await screen.findByText(nextPersona.name));

    // Session should be reinitialized
    await waitFor(() => {
      expect(mockCreateAgentSession.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    // System message should appear
    await waitFor(() => {
      expect(
        screen.getByText(`${nextPersona.icon} Switching to ${nextPersona.name} mode. ${nextPersona.role}.`)
      ).toBeInTheDocument();
    });
  });

  // NEW: Empty message handling
  it('does not send empty or whitespace-only messages', async () => {
    mockSendMessage.mockResolvedValueOnce({ text: 'init', functionCalls: [] });

    render(<ChatInterface {...baseProps} />);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1); // Only init
    });

    // Try sending empty message
    const input = await screen.findByPlaceholderText(/Type \/ to use tools/i);
    const sendButton = screen.getAllByRole('button').at(-1);

    expect(sendButton).toBeTruthy();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(sendButton!);

    // Should still only have the init call
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  // NEW: Tool execution without "Waiting for user review"
  it('handles tool execution that does not require review', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ text: 'init', functionCalls: [] })
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { id: 'tool-3', name: 'getInfo', args: { query: 'test' } },
        ],
      })
      .mockResolvedValueOnce({ text: 'Here is the info.', functionCalls: [] });

    const onAgentAction = vi.fn().mockResolvedValue('Info retrieved successfully');

    render(<ChatInterface {...baseProps} onAgentAction={onAgentAction} />);

    await typeAndSend('Get info');

    // Tool action message should appear
    await waitFor(() => {
      expect(screen.getByText(/🛠️ Suggesting Action: getInfo/)).toBeInTheDocument();
    });

    // No review message should appear (no "Waiting for user review" in result)
    await waitFor(() => {
      expect(screen.queryByText(/📝 Reviewing/)).not.toBeInTheDocument();
    });

    // Final response should appear
    await waitFor(() => {
      expect(screen.getByText('Here is the info.')).toBeInTheDocument();
    });
  });
});
