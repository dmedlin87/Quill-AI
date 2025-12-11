import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatInterface } from '@/features/agent/components/ChatInterface';
import { EditorContext, CharacterProfile } from '@/types';
import { Persona, DEFAULT_PERSONAS } from '@/types/personas';
import { clearSessionMemories } from '@/services/memory/sessionTracker';
import { RateLimitError, AIError } from '@/services/gemini/errors';
import { Chapter } from '@/types/schema';
import * as memoryService from '@/services/memory';

// Hoist mocks to be available in vi.mock
const { mockSendMessage, mockInitialize, mockAgentConstructor } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockInitialize: vi.fn(),
  mockAgentConstructor: vi.fn(),
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

vi.mock('@/config/api', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        ApiDefaults: {
            ...actual.ApiDefaults,
            maxAnalysisLength: 100, // Small limit for testing truncation
        },
    };
});

vi.mock('@/services/gemini/agent', () => {
  return {
    QuillAgent: class {
      constructor(params: any) {
        mockAgentConstructor(params);
      }
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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

    expect(clearSessionMemories).toHaveBeenCalled();
  });

  it('sends a message when user inputs text and clicks send', async () => {
    // We delay the response to verify "Thinking" state
    let resolveResponse: (value: any) => void;
    mockSendMessage.mockImplementation(async (args) => {
        if (isInitMessage(args)) return { text: 'Intro Ack' };
        return new Promise(resolve => {
            resolveResponse = resolve;
        });
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
    fireEvent.change(input, { target: { value: 'Hello agent' } });

    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    // Check for "Thinking" button state
    expect(screen.getByRole('button', { name: 'Thinking' })).toBeInTheDocument();

    await act(async () => {
        resolveResponse({ text: 'Agent response' });
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Hello agent'),
      }));
    });

    await waitFor(() => {
        expect(screen.getByText('Agent response')).toBeInTheDocument();
    });

    // Check for "Send" button state
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
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

  it('caps message history', async () => {
      render(
        <ChatInterface
          editorContext={mockEditorContext}
          fullText="Full text content"
          onAgentAction={vi.fn()}
          maxMessages={2} // Very small limit
        />
      );

      await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

      const input = screen.getByPlaceholderText(/Type \/ to use tools/);

      // Send 3 messages
      for (let i = 1; i <= 3; i++) {
        fireEvent.change(input, { target: { value: `Message ${i}` } });
        await act(async () => {
          fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        });
        await waitFor(() => screen.getByText(`Message ${i}`));
        await waitFor(() => screen.getByText('Agent response'));
      }

      await waitFor(() => {
          expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
          expect(screen.queryByText('Message 2')).not.toBeInTheDocument();
          expect(screen.getByText('Message 3')).toBeInTheDocument();
      });
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

    await waitFor(() => {
        expect(mockInitialize.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('renders in interview mode including character avatar', async () => {
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

    // Send a message to get a response from "Sherlock"
    const input = screen.getByPlaceholderText(/Type \/ to use tools/);
    fireEvent.change(input, { target: { value: 'Who are you?' } });
    await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => screen.getByText('Agent response'));

    // Verify avatar is present
    // The avatar has the first letter 'S'
    // It's in a div with "w-9 h-9"
    // We can verify by text content "S" in the message list area.
    // screen.getByText('S') might match multiple things?
    // The header also has an avatar "S".
    // We need to check for MULTIPLE "S" avatars?

    const avatars = screen.getAllByText('S', { selector: 'div' });
    // Should be at least 2 (header and message)
    expect(avatars.length).toBeGreaterThanOrEqual(2);

    // Also verify the small name label under avatar
    const nameLabels = screen.getAllByText('Sherlock');
    // Header name + message avatar name label
    expect(nameLabels.length).toBeGreaterThanOrEqual(2);

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

    const settingsButton = screen.getByTitle('Agent Settings');
    fireEvent.click(settingsButton);

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

  it('handles memory context fetching failure gracefully', async () => {
    vi.mocked(memoryService.getMemoriesForContext).mockRejectedValueOnce(new Error('Fetch failed'));

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
        projectId="test-project-fail"
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch memory context'),
        expect.any(Error)
    );
  });

  it('includes goals in memory context', async () => {
    vi.mocked(memoryService.getMemoriesForContext).mockResolvedValue(['mem1']);
    vi.mocked(memoryService.getActiveGoals).mockResolvedValue([{ id: 'g1', text: 'goal1' } as any]);
    vi.mocked(memoryService.formatMemoriesForPrompt).mockReturnValue('Memory Section');
    vi.mocked(memoryService.formatGoalsForPrompt).mockReturnValue('Goals Section');

    render(
      <ChatInterface
        editorContext={mockEditorContext}
        fullText="Full text content"
        onAgentAction={vi.fn()}
        projectId="test-project-goals"
      />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());

    expect(memoryService.getMemoriesForContext).toHaveBeenCalled();
    expect(memoryService.getActiveGoals).toHaveBeenCalled();
    expect(memoryService.formatGoalsForPrompt).toHaveBeenCalled();
  });

  it('truncates chapters when budget is exceeded', async () => {
    const longText = 'x'.repeat(200);
    const chapters: Chapter[] = [
        { id: '1', title: 'Ch1', content: longText } as any,
        { id: '2', title: 'Ch2', content: 'Small' } as any,
    ];

    render(
        <ChatInterface
            editorContext={mockEditorContext}
            fullText="Full text content"
            onAgentAction={vi.fn()}
            chapters={chapters}
            projectId="test-project"
        />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
    expect(mockAgentConstructor).toHaveBeenCalled();
    const params = mockAgentConstructor.mock.calls[mockAgentConstructor.mock.calls.length - 1][0];
    const context = params.fullManuscriptContext;

    expect(context.length).toBeLessThan(200);
    expect(context).toContain('[CHAPTER: Ch1]');
  });

  it('covers budget exhausted case', async () => {
    const longText = 'x'.repeat(100);
    const chapters: Chapter[] = [
        { id: '1', title: 'Ch1', content: longText } as any,
        { id: '2', title: 'Ch2', content: 'Should Not Be Here' } as any,
    ];

    render(
        <ChatInterface
            editorContext={mockEditorContext}
            fullText="Full text content"
            onAgentAction={vi.fn()}
            chapters={chapters}
            projectId="test-project"
        />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
    const params = mockAgentConstructor.mock.calls[mockAgentConstructor.mock.calls.length - 1][0];
    const context = params.fullManuscriptContext;

    expect(context).not.toContain('Should Not Be Here');
  });

  it('stops adding chapters when header size exceeds remaining budget', async () => {
    const chapters: Chapter[] = [
        { id: '1', title: 'Ch1', content: 'Short' } as any,
        { id: '2', title: 'Ch2', content: 'Short' } as any,
    ];

    render(
        <ChatInterface
            editorContext={mockEditorContext}
            fullText="Full text content"
            onAgentAction={vi.fn()}
            chapters={chapters}
            projectId="test-project"
        />
    );

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
    const params = mockAgentConstructor.mock.calls[mockAgentConstructor.mock.calls.length - 1][0];
    const context = params.fullManuscriptContext;

    expect(context).toContain('Ch1');
    expect(context).not.toContain('Ch2');
  });

  it('handles "active chapter" detection', async () => {
      const activeContent = "This is active";
      const chapters: Chapter[] = [
          { id: '1', title: 'ActiveChapter', content: activeContent } as any
      ];

      render(
        <ChatInterface
            editorContext={mockEditorContext}
            fullText={activeContent}
            onAgentAction={vi.fn()}
            chapters={chapters}
            projectId="test-project"
        />
      );

      await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
      const params = mockAgentConstructor.mock.calls[mockAgentConstructor.mock.calls.length - 1][0];
      const context = params.fullManuscriptContext;

      expect(context).toContain('(ACTIVE - You can edit this)');
  });

  it('ignores sending message if initialization is incomplete', async () => {
      // Mock initialization to take forever
      mockInitialize.mockReturnValue(new Promise(() => {}));

      render(
        <ChatInterface
            editorContext={mockEditorContext}
            fullText="Full"
            onAgentAction={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText(/Type \/ to use tools/);
      fireEvent.change(input, { target: { value: 'Early message' } });

      // Attempt send
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      // Should not call sendMessage because chatRef is null
      expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
