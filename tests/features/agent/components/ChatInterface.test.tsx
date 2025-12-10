import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatInterface } from '@/features/agent/components/ChatInterface';
import { EditorContext, CharacterProfile } from '@/types';
import { Persona, DEFAULT_PERSONAS } from '@/types/personas';
import { clearSessionMemories } from '@/services/memory/sessionTracker';
import { RateLimitError, AIError } from '@/services/gemini/errors';

// Hoist mocks to be available in vi.mock
const { mockSendMessage, mockInitialize } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockInitialize: vi.fn(),
}));

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/services/gemini/agent', () => {
  return {
    QuillAgent: class {
      initialize = mockInitialize;
      sendMessage = mockSendMessage;
    }
  };
});

vi.mock('@/services/memory/sessionTracker', () => ({
  clearSessionMemories: vi.fn(),
  shouldRefreshContext: vi.fn(() => false),
  getSessionMemorySummary: vi.fn(() => ''),
}));

vi.mock('@/services/memory', () => ({
  getMemoriesForContext: vi.fn(() => Promise.resolve([])),
  getActiveGoals: vi.fn(() => Promise.resolve([])),
  formatMemoriesForPrompt: vi.fn(() => ''),
  formatGoalsForPrompt: vi.fn(() => ''),
}));

vi.mock('@/features/settings', () => ({
  useSettingsStore: {
    getState: () => ({
      critiqueIntensity: 'moderate',
      experienceLevel: 'intermediate',
      autonomyMode: 'semi-auto',
    }),
  },
  CritiqueIntensitySelector: () => <div>CritiqueSelector</div>,
  ExperienceSelector: () => <div>ExperienceSelector</div>,
}));

vi.mock('@/features/agent/components/PersonaSelector', () => ({
  PersonaSelector: ({ currentPersona, onSelectPersona }: any) => (
    <button onClick={() => onSelectPersona({ ...currentPersona, name: 'New Persona' })}>
      {currentPersona.name}
    </button>
  ),
}));

vi.mock('@/features/settings/components/RelevanceTuning', () => ({
  RelevanceTuning: () => <div>RelevanceTuning</div>,
}));

const mockEditorContext: EditorContext = {
  cursorPosition: 10,
  selection: null,
  totalLength: 100,
};

const mockPersona: Persona = DEFAULT_PERSONAS[0];

// Helper to check if a message object is the init message
const isInitMessage = (args: any) => {
    const msg = args?.message || '';
    return typeof msg === 'string' && msg.includes('I have loaded the manuscript');
};

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default robust implementation
    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) {
            return { text: 'Intro Ack' };
        }
        return { text: 'Agent response' };
    });

    mockInitialize.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
      vi.restoreAllMocks();
  });

  it('renders correctly and initializes agent', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
        projectId="test-project"
      />
    );

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });

    // CritiqueSelector is only visible when settings panel is open, not testing it here
    expect(clearSessionMemories).toHaveBeenCalled();
  });

  it('sends a message when user inputs text and clicks send', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Hello agent' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Hello agent'),
      }));
    });

    await waitFor(() => {
        expect(screen.getByText('Agent response')).toBeInTheDocument();
    });
  });

  it('does not send empty message', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );
    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Should only have been called for init, not for empty message
    const nonInitCalls = mockSendMessage.mock.calls.filter(call => !isInitMessage(call[0]));
    expect(nonInitCalls.length).toBe(0);
  });

  it('handles tool calls correctly', async () => {
    const onAgentAction = vi.fn().mockResolvedValue('Action executed successfully');

    let userInteractionCount = 0;
    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) return { text: 'Intro Ack' };

        userInteractionCount++;
        if (userInteractionCount === 1) {
             return {
                text: 'I will help you.',
                functionCalls: [{ id: 'call1', name: 'edit_text', args: { text: 'new text' } }]
            };
        }
        if (userInteractionCount === 2) {
            return { text: 'Action complete.' };
        }
        return { text: 'Unexpected' };
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={onAgentAction}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Edit this text' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(onAgentAction).toHaveBeenCalledWith('edit_text', { text: 'new text' });
    });

    await waitFor(() => {
      expect(screen.getByText('Action complete.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles tool call errors gracefully', async () => {
    const onAgentAction = vi.fn().mockRejectedValue(new Error('Action failed'));

    let userInteractionCount = 0;
    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) return { text: 'Intro Ack' };

        userInteractionCount++;
        if (userInteractionCount === 1) {
            return {
                text: 'Thinking...',
                functionCalls: [{ id: 'call2', name: 'failing_tool', args: {} }]
            };
        }
        return { text: 'It failed.' };
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={onAgentAction}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Run failing tool' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(onAgentAction).toHaveBeenCalled();
    });

    await waitFor(() => {
        expect(screen.getByText(/Error: Action failed/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles tool call waiting for review status', async () => {
    const onAgentAction = vi.fn().mockResolvedValue('Waiting for user review');

    let userInteractionCount = 0;
    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) return { text: 'Intro Ack' };

        userInteractionCount++;
        if (userInteractionCount === 1) {
            return {
                text: 'Thinking...',
                functionCalls: [{ id: 'call3', name: 'review_tool', args: {} }]
            };
        }
        return { text: 'Review pending.' };
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={onAgentAction}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Run review tool' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText(/Reviewing proposed edit/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('toggles Deep Mode', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    // Use more specific selector to avoid matching the tooltip text
    const deepButton = screen.getByRole('button', { name: /Deep/ });
    await act(async () => {
        fireEvent.click(deepButton);
    });

    expect(deepButton).toHaveTextContent('Deep On');

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Test deep mode' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
        const calls = mockSendMessage.mock.calls;
        const userCalls = calls.filter(call => !isInitMessage(call[0]));
        expect(userCalls.length).toBeGreaterThan(0);
        const lastCall = userCalls[userCalls.length - 1][0];
        expect(lastCall.message).toContain('[DEEP MODE]: ON');
    });
  });

  it('handles persona change', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const personaButton = screen.getByText(mockPersona.name);

    await act(async () => {
        fireEvent.click(personaButton);
    });

    // Wait for the re-initialization to be triggered
    await waitFor(() => {
        // Should be called more than once (initial + switch, potentially doubled by strict mode)
        expect(mockInitialize.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('renders in interview mode', async () => {
    const interviewTarget: CharacterProfile = {
      id: 'char1',
      name: 'Sherlock',
      description: 'Detective',
      // other fields
    } as any;

    const onExitInterview = vi.fn();

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
        interviewTarget={interviewTarget}
        onExitInterview={onExitInterview}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    expect(screen.getByText('Sherlock')).toBeInTheDocument();
    expect(screen.getByText('Roleplay Active')).toBeInTheDocument();

    const exitButton = screen.getByText('Exit Interview');
    fireEvent.click(exitButton);
    expect(onExitInterview).toHaveBeenCalled();
  });

  it('handles initial message prop', async () => {
    const onInitialMessageProcessed = vi.fn();

    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) return { text: 'Intro Ack' };
        if (args.message.includes('Initial question')) {
            return { text: 'Response to initial message' };
        }
        return { text: 'Other' };
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
        initialMessage="Initial question"
        onInitialMessageProcessed={onInitialMessageProcessed}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getByText('Response to initial message')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
        expect(onInitialMessageProcessed).toHaveBeenCalled();
    });
  });

  it('toggles relevance settings', async () => {
    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    // First need to open the agent settings panel
    const settingsButton = screen.getByTitle('Agent Settings');
    fireEvent.click(settingsButton);

    // Now find and click the proactive suggestions toggle
    const toggleButton = screen.getByText('Proactive Suggestions');
    fireEvent.click(toggleButton);

    expect(screen.getByText('RelevanceTuning')).toBeInTheDocument();
  });

  it('shows a fallback error message when sending fails', async () => {
      mockSendMessage.mockImplementation(async (args) => {
          if (isInitMessage(args)) return { text: 'Intro Ack' };
          throw new Error('network fail');
      });

      render(
        <ChatInterface
          editorContext={mockEditorContext}
          fullText="Full text content"
          onAgentAction={vi.fn()}
        />
      );

      await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

      const input = screen.getByPlaceholderText(/Type \/ to use tools/);
      fireEvent.change(input, { target: { value: 'Fail this' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
          expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
      }, { timeout: 3000 });
  });

  it('shows a cool-down message when a RateLimitError is thrown', async () => {
    const error = new RateLimitError('Rate limit exceeded');
    mockSendMessage.mockImplementation(async (args) => {
          if (isInitMessage(args)) return { text: 'Intro Ack' };
          throw error;
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Spam' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText(/cooling down/)).toBeInTheDocument();
    });
  });

  it('shows the AIError message when an AIError is thrown', async () => {
    const error = new AIError('Something went wrong inside the agent');
    mockSendMessage.mockImplementation(async (args) => {
          if (isInitMessage(args)) return { text: 'Intro Ack' };
          throw error;
    });

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Crash it' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong inside the agent/)).toBeInTheDocument();
    });
  });

  it('handles case with no project ID for memory', async () => {
      render(
        <ChatInterface
          editorContext={mockEditorContext}
          fullText="Full text content"
          onAgentAction={vi.fn()}
          projectId={null}
        />
      );

      await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
  });
});
