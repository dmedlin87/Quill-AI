/**
 * Hooks Index
 * 
 * Central export point for all custom hooks in DraftSmith AI
 */

// Agent & Chat
export { useAgentService, type ToolActionHandler, type AgentState, type UseAgentServiceOptions, type AgentServiceResult } from './useAgentService';
export { useAgenticEditor, type EditorActions, type UseAgenticEditorOptions, type UseAgenticEditorResult } from './useAgenticEditor';

// Audio & Voice
export { useVoiceSession, type VolumeData, type UseVoiceSessionResult } from './useVoiceSession';
export { useAudioController } from './useAudioController';
export { useTextToSpeech } from './useTextToSpeech';

// Editor & Document
export { useDocumentHistory } from './useDocumentHistory';
export { useAutoResize } from './useAutoResize';
export { useMagicEditor } from './useMagicEditor';
export { useTextSelection } from './useTextSelection';

// UI
export { useViewportCollision } from './useViewportCollision';

// Engine
export { useDraftSmithEngine } from './useDraftSmithEngine';
export { useManuscriptIndexer } from './useManuscriptIndexer';
export { usePlotSuggestions } from './usePlotSuggestions';
