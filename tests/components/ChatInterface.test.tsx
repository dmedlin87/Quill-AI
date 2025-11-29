import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const { mockCreateAgentSession, mockSendMessage } = vi.hoisted(() => {
  const sendMessage = vi.fn();
  return {
    mockSendMessage: sendMessage,
    mockCreateAgentSession: vi.fn(() => ({ sendMessage })),
  };
});

vi.mock('@/services/gemini/agent', () => ({
  createAgentSession: mockCreateAgentSession,
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

describe('ChatInterface', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ text: '', functionCalls: [] });
    mockCreateAgentSession.mockClear();
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

    const input = await screen.findByPlaceholderText(/Type \/ to use tools/i);
    const sendButton = screen.getAllByRole('button').at(-1);

    fireEvent.change(input, { target: { value: 'Hello agent' } });
    if (sendButton) {
      fireEvent.click(sendButton);
    }

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

    const input = await screen.findByPlaceholderText(/Type \/ to use tools/i);
    const sendButton = screen.getAllByRole('button').at(-1);

    fireEvent.change(input, { target: { value: 'Please edit' } });
    if (sendButton) {
      fireEvent.click(sendButton);
    }

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

    const input = await screen.findByPlaceholderText(/Type \/ to use tools/i);
    const sendButton = screen.getAllByRole('button').at(-1);

    fireEvent.change(input, { target: { value: 'Trigger error' } });
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    await waitFor(() => {
      expect(
        screen.getByText('Sorry, I encountered an error connecting to the Agent.'),
      ).toBeInTheDocument();
    });
  });
});
