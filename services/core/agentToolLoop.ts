import type { Chat, FunctionCall } from '@google/genai';

export interface AgentToolLoopModelResult {
  text?: string;
  functionCalls?: FunctionCall[];
  // Allow additional provider-specific fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AgentToolLoopResponse {
  id: string;
  name: string;
  response: { result: string };
}

export interface RunAgentToolLoopParams<TResponse extends AgentToolLoopModelResult> {
  chat: Chat;
  initialResult: TResponse;
  abortSignal?: AbortSignal | null;
  processToolCalls: (functionCalls: FunctionCall[]) => Promise<AgentToolLoopResponse[]>;
  onThinkingRoundStart?: () => void;
}

/**
 * Shared helper that runs the Gemini tool-call loop until the model stops
 * returning functionCalls or the abortSignal is triggered.
 *
 * Callers provide a processToolCalls implementation that performs any
 * side-effects (UI messages, state updates, telemetry) and returns the
 * structured functionResponse payloads to send back to the model.
 */
const MAX_TOOL_ROUND_TRIPS = 5;

export async function runAgentToolLoop<TResponse extends AgentToolLoopModelResult>(
  params: RunAgentToolLoopParams<TResponse>,
): Promise<TResponse> {
  const { chat, initialResult, processToolCalls, abortSignal, onThinkingRoundStart } = params;

  let result = initialResult;
  let rounds = 0;

  // Loop while the model is asking for tools
  while (result.functionCalls && result.functionCalls.length > 0) {
    if (abortSignal?.aborted) {
      return result;
    }

    if (rounds >= MAX_TOOL_ROUND_TRIPS) {
      return {
        ...result,
        text:
          result.text ||
          `Aborted tool execution after ${MAX_TOOL_ROUND_TRIPS} rounds to prevent runaway loops.`,
        functionCalls: [],
      };
    }
    rounds += 1;

    const functionCalls = [...result.functionCalls];
    const functionResponses = await processToolCalls(functionCalls);

    if (abortSignal?.aborted) {
      return result;
    }

    onThinkingRoundStart?.();

    result = (await chat.sendMessage({
      message: functionResponses.map(resp => ({ functionResponse: resp })),
    })) as unknown as TResponse;

    if (abortSignal?.aborted) {
      return result;
    }
  }

  return result;
}
