/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * 
 * Please use the modular services instead:
 * - services/gemini/client.ts - API client
 * - services/gemini/analysis.ts - analyzeDraft, generatePlotIdeas
 * - services/gemini/agent.ts - createAgentSession, rewriteText, getContextualHelp
 * - services/gemini/audio.ts - generateSpeech, connectLiveSession
 * 
 * Configuration is now centralized in:
 * - config/models.ts - Model IDs and token limits
 * - config/api.ts - API configuration
 */

// Re-export from modular services for backward compatibility
export { 
  analyzeDraft, 
  generatePlotIdeas,
  // Parallel analysis functions (new)
  fetchPacingAnalysis,
  fetchCharacterAnalysis,
  fetchPlotAnalysis,
  fetchSettingAnalysis,
  // Types
  type PacingAnalysisResult,
  type CharacterAnalysisResult,
  type PlotAnalysisResult,
  type SettingAnalysisResult
} from './gemini/analysis';
export { createAgentSession, rewriteText, getContextualHelp, agentTools } from './gemini/agent';
export { generateSpeech, connectLiveSession } from './gemini/audio';
export { cleanJsonOutput, safeParseJson } from './gemini/resilientParser';
export { isApiConfigured, getApiStatus } from './gemini/client';
