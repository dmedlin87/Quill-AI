/**
 * Agentic Editor Hook
 * 
 * Provides a complete agent interface that integrates with EditorContext
 * for manuscript editing. This hook:
 * - Manages chat sessions with the Gemini agent
 * - Handles tool execution (update_manuscript, undo, etc.)
 * - Bridges agent actions with editor state
 */

import { useCallback } from 'react';
import { useAgentService, ToolActionHandler, AgentServiceResult } from './useAgentService';
import { ChatMessage, AnalysisResult, EditorContext } from '@/types';
import { Lore, Chapter } from '@/types/schema';

export interface EditorActions {
  updateText: (text: string, description: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  getEditorContext: () => EditorContext;
  getCurrentText: () => string;
}

export interface UseAgenticEditorOptions {
  // Editor integration
  editorActions: EditorActions;
  
  // Context
  lore?: Lore;
  chapters?: Chapter[];
  analysis?: AnalysisResult | null;
  
  // Callbacks
  onPendingEdit?: (edit: { oldText: string; newText: string; description: string }) => Promise<boolean>;
}

export interface UseAgenticEditorResult {
  // Chat state
  messages: ChatMessage[];
  agentState: AgentServiceResult['agentState'];
  isProcessing: boolean;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  resetSession: () => void;
  clearMessages: () => void;
}

/**
 * Hook that connects the agent service to editor actions.
 * Handles the tool execution and edit review flow.
 */
export function useAgenticEditor(
  options: UseAgenticEditorOptions
): UseAgenticEditorResult {
  const { editorActions, lore, chapters = [], analysis, onPendingEdit } = options;
  
  /**
   * Tool action handler that bridges agent tool calls to editor actions
   */
  const handleToolAction: ToolActionHandler = useCallback(async (toolName, args) => {
    switch (toolName) {
      case 'update_manuscript': {
        const { oldText, newText } = args as { oldText: string; newText: string };
        
        if (!oldText || !newText) {
          return 'Error: Missing oldText or newText parameters';
        }
        
        const currentText = editorActions.getCurrentText();
        
        // Verify the old text exists
        if (!currentText.includes(oldText)) {
          return `Error: Could not find the text "${oldText.substring(0, 50)}..." in the document`;
        }
        
        // If we have a review callback, use it
        if (onPendingEdit) {
          const approved = await onPendingEdit({
            oldText,
            newText,
            description: `Agent edit: replacing "${oldText.substring(0, 30)}..."`
          });
          
          if (!approved) {
            return 'Edit rejected by user';
          }
        }
        
        // Apply the edit
        const updatedText = currentText.replace(oldText, newText);
        editorActions.updateText(updatedText, 'Agent: Manuscript update');
        
        return 'Successfully updated the manuscript';
      }
      
      case 'undo_last_change': {
        const success = editorActions.undo();
        return success ? 'Undid the last change' : 'Nothing to undo';
      }
      
      case 'redo_last_change': {
        const success = editorActions.redo();
        return success ? 'Redid the last change' : 'Nothing to redo';
      }
      
      case 'get_text_context': {
        const { start, end } = args as { start?: number; end?: number };
        const text = editorActions.getCurrentText();
        const safeStart = Math.max(0, start || 0);
        const safeEnd = Math.min(text.length, end || text.length);
        return text.substring(safeStart, safeEnd);
      }
      
      case 'search_text': {
        const { query } = args as { query: string };
        const text = editorActions.getCurrentText();
        const index = text.indexOf(query);
        
        if (index === -1) {
          return `Text "${query}" not found in document`;
        }
        
        return JSON.stringify({ 
          found: true, 
          index, 
          context: text.substring(Math.max(0, index - 50), index + query.length + 50) 
        });
      }
      
      default:
        return `Unknown tool: ${toolName}`;
    }
  }, [editorActions, onPendingEdit]);

  // Always use the latest editor text when initializing the agent service
  const currentText = editorActions.getCurrentText();

  // Use the base agent service
  const agentService = useAgentService(currentText, {
    lore,
    chapters,
    analysis,
    onToolAction: handleToolAction
  });

  /**
   * Send a message using current editor context
   */
  const sendMessage = useCallback(async (message: string) => {
    const context = editorActions.getEditorContext();
    await agentService.sendMessage(message, context);
  }, [agentService, editorActions]);

  return {
    messages: agentService.messages,
    agentState: agentService.agentState,
    isProcessing: agentService.isProcessing,
    sendMessage,
    resetSession: agentService.resetSession,
    clearMessages: agentService.clearMessages
  };
}
