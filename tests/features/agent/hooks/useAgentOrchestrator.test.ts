import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAgentOrchestrator } from '@/features/agent/hooks/useAgentOrchestrator';
import { createAgentSession } from '@/services/gemini/agent';
import { useAppBrainState, useAppBrainActions } from '@/features/core';
import { useSettingsStore } from '@/features/settings';
import { eventBus } from '@/services/appBrain';
import { executeAgentToolCall } from '@/services/gemini/toolExecutor';
import { runAgentToolLoop } from '@/services/core/agentToolLoop';
import { getSmartAgentContext } from '@/services/appBrain';
import { DEFAULT_PERSONAS } from '@/types/personas';

// Mocks
vi.mock('@/services/gemini/agent');
vi.mock('@/features/core');
vi.mock('@/features/settings');
vi.mock('@/services/appBrain', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        eventBus: {
            subscribeForOrchestrator: vi.fn(() => vi.fn()),
            getChangeLog: vi.fn(() => []),
        },
        getSmartAgentContext: vi.fn(),
        emitToolExecuted: vi.fn(),
    };
});
vi.mock('@/services/gemini/toolExecutor');
vi.mock('@/services/core/agentToolLoop');

describe('useAgentOrchestrator', () => {
    const mockSendMessage = vi.fn();
    const mockAbort = vi.fn();
    const mockSession = {
        sendMessage: mockSendMessage,
    };
    const mockBrainActions = {
        someAction: vi.fn(),
    };

    // Default AppBrain State
    const defaultState = {
        manuscript: {
            projectId: 'p1',
            chapters: [{ id: 'c1', title: 'Chapter 1', content: 'Content' }],
            activeChapterId: 'c1',
            projectTitle: 'My Project'
        },
        lore: { characters: [], worldRules: [] },
        analysis: { result: null },
        intelligence: { hud: null },
        ui: {
            activePanel: 'editor',
            cursor: { position: 0 },
            selection: null,
            microphone: false
        },
        session: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Mocks
        (createAgentSession as any).mockReturnValue(mockSession);
        (useAppBrainState as any).mockImplementation((selector: any) => selector(defaultState));
        (useAppBrainActions as any).mockReturnValue(mockBrainActions);
        (useSettingsStore as any).mockImplementation((selector: any) => selector({
            critiqueIntensity: 'low',
            experienceLevel: 'beginner',
            autonomyMode: 'manual',
        }));
        (getSmartAgentContext as any).mockResolvedValue({ context: 'Smart Context' });
        (executeAgentToolCall as any).mockResolvedValue({ success: true, message: 'Done' });
        (runAgentToolLoop as any).mockResolvedValue({ text: 'Final Response' });
        (eventBus.subscribeForOrchestrator as any).mockReturnValue(() => {});

        // Mock sendMessage to return initial result for loop
        mockSendMessage.mockResolvedValue({ text: 'Initial Response' });
    });

    it('initializes session on mount', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());

        // Initial state
        expect(result.current.isReady).toBe(false);

        // Wait for async init
        await waitFor(() => {
            expect(result.current.isReady).toBe(true);
        });

        expect(createAgentSession).toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Session initialized'),
        }));
    });

    it('sends a message and handles response', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        mockSendMessage.mockReset(); // Clear init call
        mockSendMessage.mockResolvedValue({ text: 'Response from agent' });
        (runAgentToolLoop as any).mockResolvedValue({ text: 'Final Response' });

        await act(async () => {
            await result.current.sendMessage('Hello');
        });

        expect(result.current.messages).toEqual(expect.arrayContaining([
            expect.objectContaining({ role: 'user', text: 'Hello' }),
            expect.objectContaining({ role: 'model', text: 'Final Response' }),
        ]));

        expect(result.current.state.status).toBe('idle');
    });

    it('handles tool execution flow', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Setup tool loop mock to simulate tool call processing
        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
             // Simulate a tool call
             await processToolCalls([{ id: 'call1', name: 'my_tool', args: { foo: 'bar' } }]);
             return { text: 'Tool Result Final' };
        });

        await act(async () => {
            await result.current.sendMessage('Run tool');
        });

        expect(executeAgentToolCall).toHaveBeenCalledWith('my_tool', { foo: 'bar' }, mockBrainActions, 'p1');
        expect(result.current.messages.some(m => m.text === 'Tool Result Final')).toBe(true);
    });

    it('handles tool execution failure', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Mock tool failure
        (executeAgentToolCall as any).mockResolvedValue({ success: false, error: 'Failed' });

        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
             await processToolCalls([{ id: 'call1', name: 'fail_tool', args: {} }]);
             return { text: 'After Failure' };
        });

        await act(async () => {
            await result.current.sendMessage('Run fail tool');
        });

        expect(executeAgentToolCall).toHaveBeenCalledWith('fail_tool', {}, mockBrainActions, 'p1');
        // Check if we didn't crash
        expect(result.current.state.status).toBe('idle');
    });

    it('handles unexpected errors during message processing', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        mockSendMessage.mockRejectedValue(new Error('Network Error'));

        await act(async () => {
            await result.current.sendMessage('Break it');
        });

        expect(result.current.state.status).toBe('error');
        expect(result.current.state.lastError).toBe('Network Error');
        expect(result.current.messages.some(m => m.text.includes('Sorry, I encountered an error'))).toBe(true);
    });

    it('resets the session', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        expect(createAgentSession).toHaveBeenCalledTimes(1);

        await act(async () => {
            result.current.reset();
        });

        // Should call createAgentSession again
        await waitFor(() => {
            expect(createAgentSession).toHaveBeenCalledTimes(2);
        });
    });

    it('clears messages and resets', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await act(async () => {
             // Mock adding a message manually via internal state if possible,
             // but we can just send one
             await result.current.sendMessage('Msg 1');
        });

        expect(result.current.messages.length).toBeGreaterThan(0);

        await act(async () => {
            result.current.clearMessages();
        });

        expect(result.current.messages).toEqual([]);
        expect(createAgentSession).toHaveBeenCalledTimes(2); // Initial + Reset
    });

    it('updates persona', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const newPersona = { ...DEFAULT_PERSONAS[0], name: 'New Guy' };

        await act(async () => {
            result.current.setPersona(newPersona);
        });

        expect(result.current.currentPersona).toEqual(newPersona);

        // It triggers an effect that appends a message
        expect(result.current.messages.some(m => m.text.includes('Switched to New Guy'))).toBe(true);
    });

    it('limits message history', async () => {
        const { result } = renderHook(() => useAgentOrchestrator({ messageLimit: 2 }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Inject calls directly via sendMessage mocking isn't easy as state is internal.
        // But we can trigger sendMessage 3 times.

        // We need runAgentToolLoop to resolve fast

        await act(async () => { await result.current.sendMessage('1'); });
        await act(async () => { await result.current.sendMessage('2'); });
        await act(async () => { await result.current.sendMessage('3'); });

        // 3 user messages + 3 model responses = 6 messages.
        // Limit is 2. So we should have 2.
        expect(result.current.messages.length).toBe(2);
        expect(result.current.messages[1].text).toBe('Final Response');
    });

    it('auto-reinitializes on context change', async () => {
        // Initial render
        const { result, rerender } = renderHook(() => useAgentOrchestrator({ autoReinit: true }));
        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(createAgentSession).toHaveBeenCalledTimes(1);

        // Change context by mocking useAppBrainState return value - Must change PROJECT ID to trigger
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            manuscript: { ...defaultState.manuscript, projectId: 'p2' } // Changed Project
        }));

        rerender();

        // Should trigger useEffect -> initSession
        await waitFor(() => {
            expect(createAgentSession).toHaveBeenCalledTimes(2);
        });
    });

    it('handles smart context failure gracefully', async () => {
        (getSmartAgentContext as any).mockRejectedValue(new Error('Context fail'));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await act(async () => {
            await result.current.sendMessage('Hi');
        });

        // It should fallback to editor context and proceed
        expect(result.current.state.status).toBe('idle');
        expect(runAgentToolLoop).toHaveBeenCalled(); // Means it proceeded
    });

    it('ignores empty or whitespace-only messages', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Capture message count after init (may include persona switch announcement)
        const initialMessageCount = result.current.messages.length;

        await act(async () => {
            await result.current.sendMessage('   ');
        });

        expect(runAgentToolLoop).not.toHaveBeenCalled();
        // No new messages should be added for empty input
        expect(result.current.messages.length).toBe(initialMessageCount);
    });

    it('supports aborting an in-flight request without emitting a final response', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        (runAgentToolLoop as any).mockImplementation(({ abortSignal }: any) => {
            return new Promise(resolve => {
                abortSignal.addEventListener('abort', () => {
                    resolve({ text: 'Should be ignored after abort' });
                });
            });
        });

        let sendPromise: Promise<void> | undefined;

        await act(async () => {
            sendPromise = result.current.sendMessage('Hello, interrupt me');
        });

        await act(async () => {
            result.current.abort();
        });

        await act(async () => {
            await sendPromise;
        });

        const texts = result.current.messages.map(m => m.text);
        expect(texts).toContain('Hello, interrupt me');
        expect(texts).not.toContain('Should be ignored after abort');
        expect(result.current.state.status).toBe('idle');
        expect(result.current.state.lastError).toBeUndefined();
    });

    it('uses a fallback ToolResult when a tool execution throws', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        (executeAgentToolCall as any).mockRejectedValue(new Error('Kaboom'));

        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
            await processToolCalls([{ id: 'call1', name: 'explode_tool', args: {} }]);
            return { text: 'After tool error' };
        });

        await act(async () => {
            await result.current.sendMessage('Trigger exploding tool');
        });

        const modelMessages = result.current.messages.filter(m => m.role === 'model');
        const combinedText = modelMessages.map(m => m.text).join('\n');

        expect(combinedText).toContain('⚠️ explode_tool failed: Kaboom');
        expect(result.current.state.status).toBe('idle');
    });
});
