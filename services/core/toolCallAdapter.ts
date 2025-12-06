import type { ToolResult } from '@/services/gemini/toolExecutor';
import type { ChatMessage } from '@/types';

export interface ToolCallUI {
  onMessage?: (message: ChatMessage) => void;
  onToolStart?: (payload: { name: string }) => void;
  onToolEnd?: (payload: { name: string; result: ToolResult }) => void;
}

export interface ToolCallAdapter {
  handleToolStart(name: string): void;
  handleToolEnd(name: string, result: ToolResult): void;
}

function makeModelMessage(text: string): ChatMessage {
  return {
    role: 'model',
    text,
    timestamp: new Date(),
  };
}

export function createToolCallAdapter(ui: ToolCallUI): ToolCallAdapter {
  return {
    handleToolStart: (name: string) => {
      ui.onToolStart?.({ name });
      ui.onMessage?.(makeModelMessage(`🛠️ ${name}...`));
    },
    handleToolEnd: (name: string, result: ToolResult) => {
      ui.onToolEnd?.({ name, result });
      const text = result.success
        ? `✅ ${name}: ${result.message || 'Done.'}`
        : `⚠️ ${name} failed: ${result.error || result.message || 'Unknown error'}`;

      ui.onMessage?.(makeModelMessage(text));
    },
  };
}
