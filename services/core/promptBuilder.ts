import { EditorContext } from '@/types';

/**
 * Builds the user context prompt portion sent to the agent.
 * Kept pure so both the controller and hooks can reuse it.
 */
export const buildUserContextPrompt = (
  editorContext: EditorContext,
  userText: string,
): string => {
  const truncateText = (value: string, max = 120) =>
    value.length <= max ? value : `${value.slice(0, max)}...`;

  const selection = editorContext.selection;
  const selectionLabel = selection ? `"${truncateText(selection.text)}"` : 'None';
  const selectionRange = selection
    ? `${selection.start}-${selection.end} (len ${selection.text.length})`
    : 'None';

  const trimmedUserText = userText.trim();

  return `
[USER CONTEXT]
Cursor Index: ${editorContext.cursorPosition}
Selection: ${selectionLabel}
Selection Range: ${selectionRange}
Total Text Length: ${editorContext.totalLength}

[USER REQUEST]
${trimmedUserText || '(No user input provided)'}
`;
};
