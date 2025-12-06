export type AgentMode = 'text' | 'voice';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'speaking' | 'error';

export interface AgentMachineState {
  status: AgentStatus;
  isReady: boolean;
  currentRequest?: string;
  currentTool?: string;
  lastToolCall?: { name: string; success: boolean };
  lastError?: string;
}

export type AgentMachineAction =
  | { type: 'SESSION_READY' }
  | { type: 'START_THINKING'; request: string }
  | { type: 'START_EXECUTION'; tool: string }
  | { type: 'TOOL_COMPLETE'; tool: string; success: boolean; error?: string }
  | { type: 'FINISH' }
  | { type: 'ERROR'; error: string }
  | { type: 'ABORT' };

export const initialAgentMachineState: AgentMachineState = {
  status: 'idle',
  isReady: false,
};

export function agentOrchestratorReducer(
  state: AgentMachineState,
  action: AgentMachineAction,
): AgentMachineState {
  switch (action.type) {
    case 'SESSION_READY':
      return { ...state, isReady: true };
    case 'START_THINKING':
      return {
        status: 'thinking',
        isReady: state.isReady,
        currentRequest: action.request,
        currentTool: undefined,
        lastToolCall: state.lastToolCall,
        lastError: undefined,
      };
    case 'START_EXECUTION':
      return {
        status: 'executing',
        isReady: state.isReady,
        currentRequest: state.currentRequest,
        currentTool: action.tool,
        lastToolCall: { name: action.tool, success: false },
        lastError: undefined,
      };
    case 'TOOL_COMPLETE':
      if (action.success) {
        return {
          status: 'thinking',
          isReady: state.isReady,
          currentRequest: state.currentRequest,
          currentTool: undefined,
          lastToolCall: { name: action.tool, success: true },
          lastError: undefined,
        };
      }
      return {
        status: 'error',
        isReady: state.isReady,
        currentRequest: state.currentRequest,
        currentTool: undefined,
        lastToolCall: { name: action.tool, success: false },
        lastError: action.error ?? 'Unknown error',
      };
    case 'FINISH':
      return {
        status: 'idle',
        isReady: state.isReady,
        currentRequest: undefined,
        currentTool: undefined,
        lastToolCall: state.lastToolCall,
        lastError: undefined,
      };
    case 'ERROR':
      return {
        status: 'error',
        isReady: state.isReady,
        currentRequest: state.currentRequest,
        currentTool: state.currentTool,
        lastToolCall: state.lastToolCall,
        lastError: action.error,
      };
    case 'ABORT':
      return {
        status: 'idle',
        isReady: state.isReady,
        currentRequest: undefined,
        currentTool: undefined,
        lastToolCall: state.lastToolCall,
        lastError: undefined,
      };
    default:
      return state;
  }
}
