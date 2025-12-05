import type { FunctionCall } from '@google/genai';
import type { ChatMessage } from '@/types';
import type { AgentToolExecutor, AgentState } from './AgentController';
import { getOrCreateBedsideNote } from '@/services/memory';

interface ToolRunnerOptions {
  toolExecutor: AgentToolExecutor;
  getProjectId: () => string | null;
  onMessage?: (message: ChatMessage) => void;
  onStateChange?: (state: Partial<AgentState>) => void;
}

export class ToolRunner {
  private readonly toolExecutor: AgentToolExecutor;
  private readonly getProjectId: () => string | null;
  private readonly onMessage?: (message: ChatMessage) => void;
  private readonly onStateChange?: (state: Partial<AgentState>) => void;
  private significantActionSeen = false;
  private bedsideNoteUpdatedThisTurn = false;

  constructor(options: ToolRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.getProjectId = options.getProjectId;
    this.onMessage = options.onMessage;
    this.onStateChange = options.onStateChange;
  }

  resetTurn(): void {
    this.significantActionSeen = false;
    this.bedsideNoteUpdatedThisTurn = false;
  }

  private isSignificantTool(name: string): boolean {
    return new Set([
      'update_manuscript',
      'append_to_manuscript',
      'insert_at_cursor',
      'rewrite_selection',
      'continue_writing',
      'create_goal',
      'update_goal',
      'write_memory_note',
      'update_memory_note',
      'delete_memory_note',
      'update_bedside_note',
    ]).has(name);
  }

  private buildBedsideReflectionMessage(toolName: string): string | null {
    const projectId = this.getProjectId();
    if (!projectId) return null;
    if (!this.isSignificantTool(toolName)) return null;

    this.significantActionSeen = true;
    if (toolName === 'update_bedside_note') {
      this.bedsideNoteUpdatedThisTurn = true;
    }

    return 'Reflection: Should the bedside note be updated based on this action? If yes, call update_bedside_note with the section/action/content to capture the change.';
  }

  async maybeSuggestBedsideNoteRefresh(conversationText: string): Promise<void> {
    const projectId = this.getProjectId();
    if (!projectId || !this.significantActionSeen || this.bedsideNoteUpdatedThisTurn) {
      return;
    }

    try {
      const note = await getOrCreateBedsideNote(projectId);
      const normalizedConversation = conversationText.trim().toLowerCase();
      const normalizedNote = (note.text || '').toLowerCase();

      if (!normalizedConversation || normalizedNote.includes(normalizedConversation)) {
        return;
      }

      const preview = note.text ? note.text.slice(0, 160) : 'No bedside note text yet.';
      const suggestion = `🧠 Bedside note may need an update. Conversation touched on: "${conversationText.slice(0, 120)}". Current note preview: "${preview}". Consider calling update_bedside_note to align.`;
      this.onMessage?.({
        role: 'model',
        text: suggestion,
        timestamp: new Date(),
      });
    } catch (error) {
      console.warn('[ToolRunner] Failed bedside-note reflection:', error);
    }
  }

  async processToolCalls(
    functionCalls: FunctionCall[],
  ): Promise<Array<{ id: string; name: string; response: { result: string } }>> {
    const responses: Array<{
      id: string;
      name: string;
      response: { result: string };
    }> = [];

    for (const call of functionCalls) {
      this.onStateChange?.({ status: 'executing', lastError: undefined });

      const toolMessage: ChatMessage = {
        role: 'model',
        text: `🔨 Suggesting Action: ${call.name}...`,
        timestamp: new Date(),
      };
      this.onMessage?.(toolMessage);

      try {
        const args = (call.args || {}) as Record<string, unknown>;
        const result = await this.toolExecutor.execute(call.name, args);

        const reflection = this.buildBedsideReflectionMessage(call.name);
        const actionResult = reflection
          ? `${result.message}\n\n${reflection}`
          : result.message;

        responses.push({
          id:
            call.id ||
            (typeof crypto !== 'undefined'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`),
          name: call.name,
          response: { result: actionResult },
        });

        if (actionResult.includes('Waiting for user review')) {
          const reviewMessage: ChatMessage = {
            role: 'model',
            text: '📝 Reviewing proposed edit...',
            timestamp: new Date(),
          };
          this.onMessage?.(reviewMessage);
        }
      } catch (_err: unknown) {
        // Preserve original behavior: swallow tool execution errors silently.
      }
    }

    return responses;
  }
}
