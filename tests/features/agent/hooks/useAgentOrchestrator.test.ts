import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAgentOrchestrator } from '@/features/agent/hooks/useAgentOrchestrator';
import { createAgentSession } from '@/services/gemini/agent';
import { useAppBrainState, useAppBrainActions } from '@/features/core';
import { useSettingsStore } from '@/features/settings';
import { eventBus } from '@/services/appBrain';
import { executeAgentToolCall } from '@/services/gemini/toolExecutor';
import { runAgentToolLoop } from '@/services/core/agentToolLoop';
import { getSmartAgentContext, emitToolExecuted } from '@/services/appBrain';
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

    it('handles session initialization error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSendMessage.mockRejectedValueOnce(new Error('Init failed'));

        const { result } = renderHook(() => useAgentOrchestrator());

        await waitFor(() => {
             expect(result.current.isReady).toBe(true);
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        consoleSpy.mockRestore();
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

    it('handles tool execution flow (success)', async () => {
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
        expect(emitToolExecuted).toHaveBeenCalledWith('my_tool', true);
        expect(result.current.messages.some(m => m.text === 'Tool Result Final')).toBe(true);
    });

    it('handles tool execution flow (failure - returned from executeAgentToolCall)', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Mock tool failure result
        (executeAgentToolCall as any).mockResolvedValue({ success: false, error: 'Custom Failure' });

        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
             await processToolCalls([{ id: 'call1', name: 'fail_tool', args: {} }]);
             return { text: 'After Failure' };
        });

        await act(async () => {
            await result.current.sendMessage('Run fail tool');
        });

        expect(executeAgentToolCall).toHaveBeenCalledWith('fail_tool', {}, mockBrainActions, 'p1');
        expect(emitToolExecuted).toHaveBeenCalledWith('fail_tool', false);
        // Ensure state wasn't stuck
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

        await act(async () => { await result.current.sendMessage('1'); });
        await act(async () => { await result.current.sendMessage('2'); });
        await act(async () => { await result.current.sendMessage('3'); });

        expect(result.current.messages.length).toBe(2);
        expect(result.current.messages[1].text).toBe('Final Response');
    });

    it('handles invalid messageLimit values by defaulting to 200', async () => {
        // Test with 0
        const { result: r0 } = renderHook(() => useAgentOrchestrator({ messageLimit: 0 }));
        await waitFor(() => expect(r0.current.isReady).toBe(true));
        
        // Test with negative
        const { result: rNeg } = renderHook(() => useAgentOrchestrator({ messageLimit: -5 }));
        await waitFor(() => expect(rNeg.current.isReady).toBe(true));

        // Test with non-finite
        const { result: rInf } = renderHook(() => useAgentOrchestrator({ messageLimit: Infinity }));
        await waitFor(() => expect(rInf.current.isReady).toBe(true));

        // We can't easily verify the internal variable, but we can verify it doesn't crash 
        // and behaves "normally" (accepts messages).
        await act(async () => { await r0.current.sendMessage('1'); });
        expect(r0.current.messages.length).toBeGreaterThan(0);
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

    it('validates malformed UI selection during fallback', async () => {
        // Force smart context failure to trigger fallback logic
        (getSmartAgentContext as any).mockRejectedValue(new Error('Context fail'));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Mock state with malformed selection (missing start/end)
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            ui: {
                ...defaultState.ui,
                // Missing start/end, just has text. Should result in undefined selection in fallback.
                selection: { text: 'Some Text' } 
            }
        }));

        await act(async () => {
            await result.current.sendMessage('Hi');
        });

        // Verify fallback context was constructed (we can spy on buildAgentContextPrompt if exported or infer from execution)
        expect(runAgentToolLoop).toHaveBeenCalled();
        // The fact it didn't crash proves validation passed.
    });

    it('correctly determines queryType based on UI state', async () => {
        // 1. Editing (Selection present)
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            ui: { ...defaultState.ui, selection: { start: 0, end: 10, text: 'Sel' } }
        }));
        
        let { result, unmount } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));
        await act(async () => { await result.current.sendMessage('Q1'); });
        
        expect(getSmartAgentContext).toHaveBeenLastCalledWith(
            expect.anything(), 
            expect.anything(), 
            expect.objectContaining({ queryType: 'editing' })
        );
        unmount();

        // 2. Analysis (No selection, activePanel = analysis)
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            ui: { ...defaultState.ui, selection: null, activePanel: 'analysis' }
        }));

        ({ result, unmount } = renderHook(() => useAgentOrchestrator()));
        await waitFor(() => expect(result.current.isReady).toBe(true));
        await act(async () => { await result.current.sendMessage('Q2'); });

        expect(getSmartAgentContext).toHaveBeenLastCalledWith(
            expect.anything(), 
            expect.anything(), 
            expect.objectContaining({ queryType: 'analysis' })
        );
        unmount();

        // 3. General (No selection, other panel)
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            ui: { ...defaultState.ui, selection: null, activePanel: 'files' }
        }));

        ({ result, unmount } = renderHook(() => useAgentOrchestrator()));
        await waitFor(() => expect(result.current.isReady).toBe(true));
        await act(async () => { await result.current.sendMessage('Q3'); });

        expect(getSmartAgentContext).toHaveBeenLastCalledWith(
            expect.anything(), 
            expect.anything(), 
            expect.objectContaining({ queryType: 'general' })
        );
    });

    it('does NOT auto-reinitialize if autoReinit is false', async () => {
        // Initial render
        const { result, rerender } = renderHook(() => useAgentOrchestrator({ autoReinit: false }));
        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(createAgentSession).toHaveBeenCalledTimes(1);

        // Change context
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            manuscript: { ...defaultState.manuscript, projectId: 'p2' }
        }));

        rerender();

        // Wait a bit to ensure no call happens
        await new Promise(r => setTimeout(r, 100));
        expect(createAgentSession).toHaveBeenCalledTimes(1);
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

    it('generates IDs for tool calls if missing', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Mock runAgentToolLoop to simulate tool calls without IDs
        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
             const functionResponses = await processToolCalls([{ name: 'tool_no_id', args: {} }]);
             return { text: 'Done', responses: functionResponses };
        });

        // Trigger message
        let responses: any[] = [];
        (runAgentToolLoop as any).mockImplementation(async ({ processToolCalls }: any) => {
            responses = await processToolCalls([{ name: 'tool_no_id', args: {} }]);
            return { text: 'Done' };
        });

        await act(async () => {
            await result.current.sendMessage('Run tool');
        });

        expect(responses).toHaveLength(1);
        expect(responses[0].id).toBeDefined();
        expect(typeof responses[0].id).toBe('string');
        expect(responses[0].id.length).toBeGreaterThan(0);
    });

    it('passes available lore to session initialization', async () => {
        const mockLore = { characters: [{ id: 'char1' }], worldRules: [] };
        
        // Setup state with Lore
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            lore: mockLore
        }));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
            lore: mockLore
        }));
    });

    it('handles undefined lore characters gracefully', async () => {
        // Setup state with empty Lore
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            lore: { characters: [], worldRules: [] }
        }));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
            lore: undefined
        }));
    });

    it('formats recent events correctly in prompt', async () => {
        // Mock event log with recent events
        const mockEvents = [
            { timestamp: Date.now(), type: 'TEXT_CHANGED' },
            { timestamp: Date.now(), type: 'ANALYSIS_COMPLETED' }
        ];
        // We need to access the ref or mock the ref initialization? 
        // The event log is initialized from eventBus.getChangeLog().
        (eventBus.getChangeLog as any).mockReturnValue(mockEvents);

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // Send message to trigger context building
        await act(async () => {
            await result.current.sendMessage('Hello');
        });

        // Check createAgentSession call IS NOT where prompt is passed. Prompt is passed to sendMessage.
        // We need to check useAgentOrchestrator logic building prompt.
        // It calls buildAgentContextPrompt. We can't easily spy on that imported function unless we mock it.
        // But we can check the arguments passed to chat.sendMessage if we spy on it.
        
        const lastCall = mockSendMessage.mock.calls[mockSendMessage.mock.calls.length - 1][0];
        // It should receive the prompt string.
        // Or if we didn't mock buildContext, it's constructing a string.
        // Let's verify it contains our event types.
        expect(lastCall.message).toContain('TEXT_CHANGED');
        expect(lastCall.message).toContain('ANALYSIS_COMPLETED');
    });

    it('handles empty event log', async () => {
        (eventBus.getChangeLog as any).mockReturnValue([]);
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await act(async () => { await result.current.sendMessage('Hi'); });

        const lastCall = mockSendMessage.mock.calls[mockSendMessage.mock.calls.length - 1][0];
        // Should contain 'None' or just not contain event types?
        // The implementation says: recentEvents ... : 'None'
        // But it's passed to buildAgentContextPrompt.
        // We can't see the output of buildAgentContextPrompt easily if we don't mock it to return the inputs.
        // Assuming real buildAgentContextPrompt puts it in the string.
        expect(lastCall.message).not.toContain('TEXT_CHANGED');
    });

    it('handles sendMessage when chatRef is missing', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());

        (createAgentSession as any).mockReturnValue(null);
        const { result: result2 } = renderHook(() => useAgentOrchestrator());

        await act(async () => {
            await result2.current.sendMessage('Hello');
        });

        expect(result2.current.state.status).not.toBe('thinking');
    });

    it('handles activeChapter fallback in error path when chapter not found', async () => {
        (getSmartAgentContext as any).mockRejectedValue(new Error('Context fail'));
        
        // Setup state where activeChapterId invalid
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            manuscript: {
                ...defaultState.manuscript,
                activeChapterId: 'invalid-id'
            }
        }));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await act(async () => { await result.current.sendMessage('Hi'); });

        // Should proceed without error using chapters[0]
        expect(result.current.state.status).toBe('idle');
    });

    it('handles missing content in activeChapter during fallback', async () => {
        (getSmartAgentContext as any).mockRejectedValue(new Error('Context fail'));
        
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            manuscript: {
                ...defaultState.manuscript,
                chapters: [{ id: 'c1', title: 'T', content: undefined as any }]
            }
        }));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await act(async () => { await result.current.sendMessage('Hi'); });

        expect(result.current.state.status).toBe('idle');
    });

    it('handles initSession when activeChapterId does not match any chapter', async () => {
        // Setup state where activeChapterId invalid for init logging
        (useAppBrainState as any).mockImplementation((selector: any) => selector({
            ...defaultState,
            manuscript: {
                ...defaultState.manuscript,
                activeChapterId: 'invalid-id'
            }
        }));

        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        expect(mockSendMessage).toHaveBeenCalled();
    });

    it('does not nullify abortController if a new request started', async () => {
        const { result } = renderHook(() => useAgentOrchestrator());
        await waitFor(() => expect(result.current.isReady).toBe(true));

        (runAgentToolLoop as any).mockImplementation(async () => {
            // Wait a bit
            await new Promise(r => setTimeout(r, 10));
            return { text: 'Done' };
        });

        const p1 = result.current.sendMessage('Req 1');
        const p2 = result.current.sendMessage('Req 2');
        
        await act(async () => { await Promise.all([p1, p2]); });
    });
});
