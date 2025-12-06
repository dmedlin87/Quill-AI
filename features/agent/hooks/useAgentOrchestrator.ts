/**
 * Agent Orchestrator Hook
 *
 * Unified agent interface that uses AppBrain for complete app awareness.
 * Handles both text and voice modes with the same underlying architecture.
 *
 * This is the NEW way to interact with the agent - replaces manual context passing.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Chat } from '@google/genai';
import { createAgentSession } from '@/services/gemini/agent';
import { executeAgentToolCall } from '@/services/gemini/toolExecutor';
import { useAppBrain } from '@/features/core';
import { ChatMessage, EditorContext } from '@/types';
import { DEFAULT_PERSONAS, Persona } from '@/types/personas';
import { useSettingsStore } from '@/features/settings';
import { emitToolExecuted, eventBus, getSmartAgentContext } from '@/services/appBrain';
import type { AppEvent } from '@/services/appBrain';
import { AgentToolLoopModelResult, runAgentToolLoop } from '@/services/core/agentToolLoop';
import { buildAgentContextPrompt } from '@/services/core/agentContextBuilder';
import { createToolCallAdapter } from '@/services/core/toolCallAdapter';
import type { ToolResult } from '@/services/gemini/toolExecutor';
import {
  AgentMachineAction,
  AgentMachineState,
  agentOrchestratorReducer,
  initialAgentMachineState,
} from '@/services/core/agentOrchestratorMachine';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AgentMode = 'text' | 'voice';

// Internal agent state is now modeled by AgentMachineState/AgentMachineAction in services/core

export interface AgentOrchestratorState {
  status: 'idle' | 'thinking' | 'executing' | 'speaking' | 'error';
  lastError?: string;
  lastToolCall?: { name: string; success: boolean };
}

export interface UseAgentOrchestratorOptions {
  mode?: AgentMode;
  persona?: Persona;
  /** Auto-reinitialize when context changes significantly */
  autoReinit?: boolean;
  /**
   * Limit the number of stored chat messages to avoid unbounded growth.
   * Defaults to 200 if not provided.
   */
  messageLimit?: number;
}

export interface AgentOrchestratorResult {
  // State
  isReady: boolean;
  isProcessing: boolean;
  state: AgentOrchestratorState;
  messages: ChatMessage[];
  currentPersona: Persona;
  
  // Text Mode
  sendMessage: (message: string) => Promise<void>;
  
  // Voice Mode (placeholder for now)
  isVoiceMode: boolean;
  
  // Control
  abort: () => void;
  reset: () => void;
  clearMessages: () => void;
  setPersona: (persona: Persona) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAgentOrchestrator(
  options: UseAgentOrchestratorOptions = {},
): AgentOrchestratorResult {
  const { mode = 'text', persona: initialPersona, autoReinit = true } = options;

  const messageLimit = Number.isFinite(options.messageLimit) && (options.messageLimit as number) > 0
    ? Math.floor(options.messageLimit as number)
    : 200;
  
  // Get unified app state
  const brain = useAppBrain();
  
  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, dispatch] = useReducer<
    (state: AgentMachineState, action: AgentMachineAction) => AgentMachineState
  >(agentOrchestratorReducer, initialAgentMachineState);
  const [currentPersona, setCurrentPersona] = useState<Persona>(
    initialPersona || DEFAULT_PERSONAS[0]
  );
  const isReady = agentState.isReady;
  const isProcessing =
    agentState.status === 'thinking' || agentState.status === 'executing';

  // Refs
  const chatRef = useRef<Chat | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestStateRef = useRef(brain.state);
  const orchestratorEventLogRef = useRef<AppEvent[]>(eventBus.getChangeLog(10));
  const hasSeenContextChangeRef = useRef(false);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    dispatch({ type: 'ABORT' });
  }, []);
  
  // Settings
  const critiqueIntensity = useSettingsStore(s => s.critiqueIntensity);
  const experienceLevel = useSettingsStore(s => s.experienceLevel);
  const autonomyMode = useSettingsStore(s => s.autonomyMode);
  const manuscriptProjectId = brain.state.manuscript.projectId;

  const appendMessages = useCallback(
    (newMessages: ChatMessage | ChatMessage[]): void => {
      const additions = Array.isArray(newMessages) ? newMessages : [newMessages];
      setMessages(prev => {
        const next = [...prev, ...additions];
        return next.length > messageLimit ? next.slice(-messageLimit) : next;
      });
    },
    [messageLimit],
  );

  // Keep a ref to the latest brain state so callbacks can read fresh context without re-registering
  useEffect(() => {
    latestStateRef.current = brain.state;
  }, [brain.state]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribeForOrchestrator(event => {
      orchestratorEventLogRef.current = [
        ...orchestratorEventLogRef.current.slice(-9),
        event,
      ];
    }, {
      types: ['TEXT_CHANGED', 'ANALYSIS_COMPLETED', 'PANEL_SWITCHED', 'TOOL_EXECUTED'],
      replay: true,
    });

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  const initSession = useCallback(async () => {
    const { manuscript, lore, analysis, intelligence } = latestStateRef.current;

    const fullManuscript = manuscript.chapters
      .map(chapter => {
        const isActive = chapter.id === manuscript.activeChapterId;
        return `[CHAPTER: ${chapter.title}]${isActive ? ' (ACTIVE - You can edit this)' : ' (READ ONLY)'}\n${chapter.content}\n`;
      })
      .join('\n-------------------\n');

    chatRef.current = createAgentSession({
      lore: lore.characters.length > 0 ? { characters: lore.characters, worldRules: lore.worldRules } : undefined,
      analysis: analysis.result || undefined,
      fullManuscriptContext: fullManuscript,
      persona: currentPersona,
      intensity: critiqueIntensity,
      experience: experienceLevel,
      autonomy: autonomyMode,
      intelligenceHUD: intelligence.hud || undefined,
      mode,
    });

    // Silent initialization – tolerate providers or mocks that don't return a Promise
    try {
      const session = chatRef.current;
      if (session && typeof session.sendMessage === 'function') {
        await session.sendMessage({
          message: `Session initialized. Project: "${manuscript.projectTitle}". Chapters: ${manuscript.chapters.length}. Active: "${manuscript.chapters.find(c => c.id === manuscript.activeChapterId)?.title}". I am ${currentPersona.name}, ready to assist.`,
        });
      }
    } catch (error) {
      console.error(error);
    }

    dispatch({ type: 'SESSION_READY' });
  }, [autonomyMode, critiqueIntensity, currentPersona, experienceLevel, mode]);

  // Initialize on mount
  useEffect(() => {
    void initSession();
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
    // We deliberately initialize only once. Context-based reinitialization is
    // handled by a dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoReinit) return;

    if (!hasSeenContextChangeRef.current) {
      hasSeenContextChangeRef.current = true;
      return;
    }

    abort();
    chatRef.current = null;
    initSession();
  }, [
    autoReinit,
    manuscriptProjectId,
    currentPersona,
    brain.state.lore,
    brain.state.analysis.result,
    initSession,
    abort,
  ]);

  // Persona change announcement (session reinit is handled by the initSession effect)
  useEffect(() => {
    if (chatRef.current && isReady) {
      appendMessages({
        role: 'model',
        text: `${currentPersona.icon} Switched to ${currentPersona.name}. ${currentPersona.role}.`,
        timestamp: new Date(),
      });
    }
  }, [appendMessages, currentPersona, isReady]);

  // ─────────────────────────────────────────────────────────────────────────
  // TOOL EXECUTION
  // ─────────────────────────────────────────────────────────────────────────

  const executeToolCall = useCallback(
    async (toolName: string, args: Record<string, unknown>): Promise<ToolResult> => {
      dispatch({ type: 'START_EXECUTION', tool: toolName });

      const projectId = brain.state.manuscript.projectId;
      const result = await executeAgentToolCall(toolName, args, brain.actions, projectId);

      if (result.success) {
        emitToolExecuted(toolName, true);
        dispatch({ type: 'TOOL_COMPLETE', tool: toolName, success: true });
      } else {
        emitToolExecuted(toolName, false);
        dispatch({
          type: 'TOOL_COMPLETE',
          tool: toolName,
          success: false,
          error: result.error ?? 'Unknown error',
        });
      }
      return result;
    },
    [brain.actions, brain.state.manuscript.projectId],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a message to the agent, assembling smart context, running tool loops, and handling aborts.
   */
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !chatRef.current) return;

    // Cancel pending requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    appendMessages(userMsg);
    dispatch({ type: 'START_THINKING', request: messageText });

    try {
      // Build context-aware prompt using AppBrain smart context
      const state = latestStateRef.current;
      const { ui, manuscript } = state;
      const mic = ui.microphone;
      const recentEvents = orchestratorEventLogRef.current.length > 0
        ? orchestratorEventLogRef.current
            .slice(-5)
            .map(ev => `${new Date(ev.timestamp).toLocaleTimeString()}: ${ev.type}`)
            .join('\n')
        : 'None';

      // Derive query type from current UI state
      const queryType: 'editing' | 'analysis' | 'general' = ui.selection
        ? 'editing'
        : ui.activePanel === 'analysis'
          ? 'analysis'
          : 'general';

      let smartContext: Awaited<ReturnType<typeof getSmartAgentContext>> | null = null;
      let editorContextFallback: EditorContext | undefined;

      try {
        smartContext = await getSmartAgentContext(state, manuscript.projectId, {
          mode,
          queryType,
        });
      } catch (err) {
        console.warn('[AgentOrchestrator] Smart context unavailable, using editor fallback:', err);
        const activeChapter =
          manuscript.chapters.find(chapter => chapter.id === manuscript.activeChapterId) ?? manuscript.chapters[0];

        editorContextFallback = {
          cursorPosition: ui.cursor.position,
          selection:
            ui.selection && typeof ui.selection === 'object' && 'start' in ui.selection && 'end' in ui.selection
              ? {
                  start: Number(ui.selection.start),
                  end: Number(ui.selection.end),
                  text: ui.selection.text ?? '',
                }
              : undefined,
          totalLength: activeChapter?.content?.length ?? 0,
        };
      }

      const contextPrompt = buildAgentContextPrompt({
        smartContext: smartContext?.context,
        editorContext: editorContextFallback,
        userText: messageText,
        mode,
        uiState: {
          cursor: ui.cursor,
          selection: ui.selection ? { text: ui.selection.text } : undefined,
          activePanel: ui.activePanel,
          microphone: mic,
        },
        recentEvents,
      });

      const chat = chatRef.current;
      if (!chat) return;

      // Send to agent and run shared tool loop
      const initialResult = (await chat.sendMessage({
        message: contextPrompt,
      })) as AgentToolLoopModelResult;

      const toolUI = createToolCallAdapter({
        onMessage: appendMessages,
        onToolStart: ({ name }) => dispatch({ type: 'START_EXECUTION', tool: name }),
        onToolEnd: ({ name, result }) => {
          dispatch({
            type: 'TOOL_COMPLETE',
            tool: name,
            success: result.success,
            error: result.error,
          });
          emitToolExecuted(name, result.success);
        },
      });

      const finalResult = await runAgentToolLoop<AgentToolLoopModelResult>({
        chat,
        initialResult,
        abortSignal: signal,
        processToolCalls: async functionCalls => {
          const functionResponses: { id: string; name: string; response: { result: string } }[] =
            [];

          for (const call of functionCalls) {
            toolUI.handleToolStart(call.name);
            try {
              const result = (await executeToolCall(
                call.name,
                call.args as Record<string, unknown>,
              )) as ToolResult;

              toolUI.handleToolEnd(call.name, result);
              functionResponses.push({
                id: call.id || crypto.randomUUID(),
                name: call.name,
                response: { result: result.message },
              });
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : 'Unknown error executing tool';
              const fallback: ToolResult = {
                success: false,
                message: `Error executing ${call.name}: ${errorMessage}`,
                error: errorMessage,
              };
              toolUI.handleToolEnd(call.name, fallback);
              functionResponses.push({
                id: call.id || crypto.randomUUID(),
                name: call.name,
                response: { result: fallback.message },
              });
            }
          }
          return functionResponses;
        },
        onThinkingRoundStart: () => {
          dispatch({ type: 'START_THINKING', request: messageText });
        },
      });

      if (signal.aborted) return;

      // Final response
      appendMessages({
        role: 'model',
        text: finalResult.text || 'Done.',
        timestamp: new Date(),
      });
      dispatch({ type: 'FINISH' });

    } catch (e) {
      if (signal.aborted) return;
      
      console.error('[AgentOrchestrator] Error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      dispatch({ type: 'ERROR', error: errorMessage });

      appendMessages({
        role: 'model',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      });
    } finally {
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null;
      }
    }
  }, [appendMessages, executeToolCall, mode]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTROL METHODS
  // ─────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abort();
    initSession();
  }, [abort, initSession]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    reset();
  }, [reset]);

  const setPersona = useCallback((persona: Persona) => {
    setCurrentPersona(persona);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────

  return {
    isReady,
    isProcessing,
    state: {
      status: agentState.status,
      lastError: agentState.status === 'error' ? agentState.lastError : undefined,
      lastToolCall: agentState.lastToolCall,
    },
    messages,
    currentPersona,
    sendMessage,
    isVoiceMode: mode === 'voice',
    abort,
    reset,
    clearMessages,
    setPersona,
  };
}
