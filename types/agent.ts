export type AgentAction =
  | { action: 'update_manuscript'; params: { search_text: string; replacement_text: string; description?: string } }
  | { action: 'append_to_manuscript'; params: { text_to_add: string; description?: string } }
  | { action: 'undo_last_change'; params?: undefined };

export type AgentActionHandler = (action: string, params: Record<string, unknown>) => Promise<string>;
