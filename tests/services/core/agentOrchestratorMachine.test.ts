import { describe, it, expect } from 'vitest';
import {
  agentOrchestratorReducer,
  initialAgentMachineState,
  AgentMachineAction,
} from '@/services/core/agentOrchestratorMachine';

const reduce = (actions: AgentMachineAction[]) =>
  actions.reduce(agentOrchestratorReducer, initialAgentMachineState);

describe('agentOrchestratorMachine', () => {
  it('transitions Idle -> Thinking -> Idle on successful flow', () => {
    const final = reduce([
      { type: 'SESSION_READY' },
      { type: 'START_THINKING', request: 'Help me edit this' },
      { type: 'FINISH' },
    ]);

    expect(final.isReady).toBe(true);
    expect(final.status).toBe('idle');
    expect(final.currentRequest).toBeUndefined();
    expect(final.lastError).toBeUndefined();
  });

  it('transitions Idle -> Thinking -> Executing -> Thinking -> Idle with successful tool', () => {
    const afterThinking = agentOrchestratorReducer(initialAgentMachineState, {
      type: 'START_THINKING',
      request: 'Fix pacing in this paragraph',
    });

    const afterSession = agentOrchestratorReducer(afterThinking, { type: 'SESSION_READY' });
    const afterExec = agentOrchestratorReducer(afterSession, {
      type: 'START_EXECUTION',
      tool: 'rewrite_selection',
    });
    const afterTool = agentOrchestratorReducer(afterExec, {
      type: 'TOOL_COMPLETE',
      tool: 'rewrite_selection',
      success: true,
    });
    const final = agentOrchestratorReducer(afterTool, { type: 'FINISH' });

    expect(afterThinking.status).toBe('thinking');
    expect(afterExec.status).toBe('executing');
    expect(afterExec.currentTool).toBe('rewrite_selection');
    expect(afterTool.status).toBe('thinking');
    expect(afterTool.lastToolCall).toEqual({ name: 'rewrite_selection', success: true });
    expect(final.status).toBe('idle');
    expect(final.lastError).toBeUndefined();
  });

  it('transitions to error state when tool fails', () => {
    const afterExec = reduce([
      { type: 'SESSION_READY' },
      { type: 'START_THINKING', request: 'Do something' },
      { type: 'START_EXECUTION', tool: 'bad_tool' },
    ]);

    const final = agentOrchestratorReducer(afterExec, {
      type: 'TOOL_COMPLETE',
      tool: 'bad_tool',
      success: false,
      error: 'Oops',
    });

    expect(final.status).toBe('error');
    expect(final.lastError).toBe('Oops');
    expect(final.lastToolCall).toEqual({ name: 'bad_tool', success: false });
  });

  it('ABORT returns to idle without error', () => {
    const afterThinking = reduce([
      { type: 'SESSION_READY' },
      { type: 'START_THINKING', request: 'Cancel me' },
    ]);

    const final = agentOrchestratorReducer(afterThinking, { type: 'ABORT' });

    expect(afterThinking.status).toBe('thinking');
    expect(final.status).toBe('idle');
    expect(final.lastError).toBeUndefined();
  });

  it('ERROR action moves to error state and preserves context', () => {
    const afterExec = reduce([
      { type: 'SESSION_READY' },
      { type: 'START_THINKING', request: 'Do something important' },
      { type: 'START_EXECUTION', tool: 'rewrite_selection' },
    ]);

    const final = agentOrchestratorReducer(afterExec, {
      type: 'ERROR',
      error: 'Boom',
    });

    expect(afterExec.status).toBe('executing');
    expect(final.status).toBe('error');
    expect(final.isReady).toBe(true);
    expect(final.currentRequest).toBe('Do something important');
    expect(final.currentTool).toBe('rewrite_selection');
    expect(final.lastError).toBe('Boom');
    expect(final.lastToolCall).toEqual({ name: 'rewrite_selection', success: false });
  });
});
