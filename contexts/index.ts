/**
 * Contexts Index
 * 
 * Central export point for all React contexts in DraftSmith AI
 */

// Main Editor Context (handles text, selection, history)
export { 
  ManuscriptProvider, 
  useManuscript,
  type ManuscriptContextValue 
} from './ManuscriptContext';

// Alias for EditorContext naming (backward compat)
export { 
  ManuscriptProvider as EditorProvider, 
  useManuscript as useEditor 
} from './ManuscriptContext';

// Analysis Context (handles AI analysis state)
export { 
  AnalysisProvider, 
  useAnalysis,
  type AnalysisStatus,
  type AnalysisSection,
  type IncrementalAnalysis
} from './AnalysisContext';

// Usage Context (handles API usage tracking)
export { UsageProvider, useUsage } from './UsageContext';
