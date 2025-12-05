import { EditorContext } from '@/types';

/**
 * Builds the user context prompt portion sent to the agent.
 * Kept pure so both the controller and hooks can reuse it.
 */
export const buildUserContextPrompt = (
  editorContext: EditorContext,
  userText: string,
): string => {
  const selectionLabel = editorContext.selection
    ? `"${editorContext.selection.text}"`
    : 'None';

  return `
[USER CONTEXT]
Cursor Index: ${editorContext.cursorPosition}
Selection: ${selectionLabel}
Total Text Length: ${editorContext.totalLength}

[USER REQUEST]
${userText}
`;
};
