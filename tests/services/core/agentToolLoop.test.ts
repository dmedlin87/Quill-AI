import { describe, it, expect, vi } from 'vitest';
import type { Chat, FunctionCall } from '@google/genai';
import { runAgentToolLoop, type AgentToolLoopModelResult } from '@/services/core/agentToolLoop';

const makeChat = (responses: AgentToolLoopModelResult[]): Chat => {
  const sendMessage = vi.fn();
  responses.forEach((res, index) => {
    sendMessage.mockResolvedValueOnce(res);
  });
  return { sendMessage } as unknown as Chat;
};

describe('runAgentToolLoop', () => {
  it('runs tool loop until no more function calls', async () => {
    const first: AgentToolLoopModelResult = {
      text: '',
      functionCalls: [
        { id: '1', name: 'do_something', args: { foo: 'bar' } } as FunctionCall,
      ],
    };
    const second: AgentToolLoopModelResult = { text: 'done', functionCalls: [] };

    const chat = makeChat([second]);
    const processToolCalls = vi.fn(async (calls: FunctionCall[]) => {
      expect(calls).toHaveLength(1);
      return [
        {
          id: calls[0].id || '1',
          name: calls[0].name,
          response: { result: 'ok' },
        },
      ];
    });
    const onThinkingRoundStart = vi.fn();

    const final = await runAgentToolLoop<AgentToolLoopModelResult>({
      chat,
      initialResult: first,
      abortSignal: null,
      processToolCalls,
      onThinkingRoundStart,
    });

    expect(final).toBe(second);
    expect(processToolCalls).toHaveBeenCalledTimes(1);
    expect(onThinkingRoundStart).toHaveBeenCalledTimes(1);
  });

  it('returns initial result immediately if aborted before processing', async () => {
    const initial: AgentToolLoopModelResult = {
      text: '',
      functionCalls: [
        { id: '1', name: 'noop', args: {} } as FunctionCall,
      ],
    };
    const chat = makeChat([]);

    const controller = new AbortController();
    controller.abort();

    const processToolCalls = vi.fn();

    const final = await runAgentToolLoop<AgentToolLoopModelResult>({
      chat,
      initialResult: initial,
      abortSignal: controller.signal,
      processToolCalls,
    });

    expect(final).toBe(initial);
    expect(processToolCalls).not.toHaveBeenCalled();
  });

  it('stops after processing tools if aborted before next model call', async () => {
    const first: AgentToolLoopModelResult = {
      text: '',
      functionCalls: [
        { id: '1', name: 'do_something', args: {} } as FunctionCall,
      ],
    };
    const chat = makeChat([]);
    const controller = new AbortController();

    const processToolCalls = vi.fn(async () => {
      controller.abort();
      return [
        {
          id: '1',
          name: 'do_something',
          response: { result: 'ok' },
        },
      ];
    });

    const final = await runAgentToolLoop<AgentToolLoopModelResult>({
      chat,
      initialResult: first,
      abortSignal: controller.signal,
      processToolCalls,
    });

    expect(final).toBe(first);
    expect(processToolCalls).toHaveBeenCalledTimes(1);
  });

  it('returns initial result when there are no functionCalls', async () => {
    const initial: AgentToolLoopModelResult = {
      text: 'no-tools',
      functionCalls: [],
    };
    const chat = makeChat([]);
    const processToolCalls = vi.fn();

    const final = await runAgentToolLoop<AgentToolLoopModelResult>({
      chat,
      initialResult: initial,
      abortSignal: null,
      processToolCalls,
    });

    expect(final).toBe(initial);
    expect(processToolCalls).not.toHaveBeenCalled();
  });

  it('supports multiple rounds of tool calls', async () => {
    const first: AgentToolLoopModelResult = {
      text: '',
      functionCalls: [
        { id: '1', name: 'first_tool', args: {} } as FunctionCall,
      ],
    };

    const second: AgentToolLoopModelResult = {
      text: '',
      functionCalls: [
        { id: '2', name: 'second_tool', args: {} } as FunctionCall,
      ],
    };

    const third: AgentToolLoopModelResult = {
      text: 'final',
      functionCalls: [],
    };

    const chat = makeChat([second, third]);

    const seenToolNames: string[] = [];
    const processToolCalls = vi.fn(async (calls: FunctionCall[]) => {
      seenToolNames.push(...calls.map(call => call.name));
      return calls.map(call => ({
        id: call.id || 'generated',
        name: call.name,
        response: { result: 'ok' },
      }));
    });
    const onThinkingRoundStart = vi.fn();

    const final = await runAgentToolLoop<AgentToolLoopModelResult>({
      chat,
      initialResult: first,
      abortSignal: null,
      processToolCalls,
      onThinkingRoundStart,
    });

    expect(final).toBe(third);
    expect(processToolCalls).toHaveBeenCalledTimes(2);
    expect(seenToolNames).toEqual(['first_tool', 'second_tool']);
    expect(onThinkingRoundStart).toHaveBeenCalledTimes(2);
  });
});
