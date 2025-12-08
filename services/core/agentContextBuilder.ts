import { EditorContext } from '@/types';

type MicrophoneStatus = 'idle' | 'recording' | 'muted' | 'error' | string;
type ActivePanel = 'analysis' | 'chat' | 'editor' | string;
type UIStateSnapshot = {
  cursor: { position: number };
  selection?: { text: string };
  activePanel?: ActivePanel;
  microphone?: { status: MicrophoneStatus; lastTranscript?: string | null };
};

export interface AgentContextPromptInput {
  /**
   * Optional rich context from AppBrain (already formatted).
   */
  smartContext?: string;
  /**
   * User input text.
   */
  userText: string;
  /**
   * Mode (text/voice) for capability hints.
   */
  mode: 'text' | 'voice';
  /**
   * UI snapshot (lightweight) when available.
   */
  uiState?: UIStateSnapshot;
  /**
   * Optional recent event summaries.
   */
  recentEvents?: string;
  /**
   * Simple editor context fallback when AppBrain is not available.
   */
  editorContext?: EditorContext;
}

/**
 * Shared prompt builder to keep controller and orchestrator aligned.
 */
export function buildAgentContextPrompt(input: AgentContextPromptInput): string {
  const {
    smartContext,
    userText,
    mode,
    uiState,
    recentEvents,
    editorContext,
  } = input;

  const truncateText = (value: string, max = 100) => {
    if (value.length <= max) return value;
    return `${Array.from(value).slice(0, max).join('')}...`;
  };

  const baseContext = smartContext
    ? `[CONTEXT]\nSource: Smart Context\n${smartContext}`
    : editorContext
      ? `[CONTEXT]\nSource: Editor Fallback\n[USER CONTEXT]\nCursor Index: ${editorContext.cursorPosition}\nSelection: ${
          editorContext.selection ? `"${editorContext.selection.text}"` : 'None'
        }\nSelection Range: ${
          editorContext.selection
            ? `${editorContext.selection.start}-${editorContext.selection.end} (len ${editorContext.selection.text.length})`
            : 'None'
        }\nTotal Text Length: ${editorContext.totalLength}`
      : '[CONTEXT]\nSource: Unknown';

  const uiSection = uiState
    ? `[USER STATE]\nCursor: ${uiState.cursor.position}\nSelection: ${
        uiState.selection ? `"${truncateText(uiState.selection.text)}"` : 'None'
      }\nActive Panel: ${uiState.activePanel ?? 'unknown'}\nMicrophone: ${
        uiState.microphone
          ? `${uiState.microphone.status}${
              uiState.microphone.lastTranscript
                ? ` (last transcript: "${truncateText(uiState.microphone.lastTranscript, 120)}")`
                : ''
            }`
          : 'unknown'
      }`
    : undefined;

  const trimmedEvents = recentEvents?.trim();
  const eventsSection = trimmedEvents
    ? `[RECENT EVENTS]\n${trimmedEvents}`
    : undefined;

  const trimmedUserText = userText?.trim();

  return [
    baseContext,
    `[INPUT MODE]\nAgent mode: ${mode}.`,
    uiSection,
    eventsSection,
    `[USER REQUEST]\n${trimmedUserText || '(No user input provided)'}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
