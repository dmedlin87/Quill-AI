/**
 * Smartness Pipeline Hook
 * 
 * Integrates all "Smartness Upgrade" features:
 * 1. Intelligence-Memory Bridge - Cross-references findings with memory/lore
 * 2. Scene-Aware Context - Filters memories based on current scene
 * 3. Proactive Thinker - LLM-powered background analysis
 * 
 * This hook wires everything together and provides a unified API
 * for the intelligent features.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManuscriptIntelligence } from '@/types/intelligence';
import type { CharacterProfile } from '@/types';
import { 
  analyzeIntelligenceAgainstMemory,
  type IntelligenceConflict,
  type BridgeAnalysisResult,
} from '@/services/appBrain/intelligenceMemoryBridge';
import {
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
  type ThinkingResult,
  type ThinkerState,
} from '@/services/appBrain';
import type { ProactiveSuggestion } from '@/services/memory/proactive';
import type { AppBrainState } from '@/services/appBrain/types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SmartnessPipelineConfig {
  /** Project ID for memory operations */
  projectId: string;
  /** Lore characters for cross-reference */
  loreCharacters?: CharacterProfile[];
  /** World rules for cross-reference */
  worldRules?: string[];
  /** Enable proactive thinker */
  enableProactiveThinker?: boolean;
  /** Proactive thinker debounce (ms) */
  thinkerDebounceMs?: number;
}

export interface SmartnessPipelineResult {
  /** Conflicts detected by intelligence-memory bridge */
  conflicts: IntelligenceConflict[];
  /** Proactive suggestions from thinker */
  suggestions: ProactiveSuggestion[];
  /** Whether bridge analysis is in progress */
  isAnalyzing: boolean;
  /** Thinker state */
  thinkerState: ThinkerState | null;
  /** Manually trigger bridge analysis */
  analyzeNow: (intelligence: ManuscriptIntelligence) => Promise<void>;
  /** Manually trigger proactive thinking */
  thinkNow: () => Promise<ThinkingResult | null>;
  /** Clear all conflicts */
  clearConflicts: () => void;
  /** Clear all suggestions */
  clearSuggestions: () => void;
  /** Dismiss a specific suggestion */
  dismissSuggestion: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSmartnessPipeline(
  getState: () => AppBrainState,
  config: SmartnessPipelineConfig
): SmartnessPipelineResult {
  const { 
    projectId, 
    loreCharacters = [], 
    worldRules = [],
    enableProactiveThinker = true,
    thinkerDebounceMs = 10000,
  } = config;
  
  const [conflicts, setConflicts] = useState<IntelligenceConflict[]>([]);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thinkerState, setThinkerState] = useState<ThinkerState | null>(null);
  
  const configRef = useRef(config);
  configRef.current = config;
  
  // ─────────────────────────────────────────────────────────────────────────
  // INTELLIGENCE-MEMORY BRIDGE
  // ─────────────────────────────────────────────────────────────────────────
  
  const analyzeNow = useCallback(async (intelligence: ManuscriptIntelligence) => {
    if (!projectId) return;
    
    setIsAnalyzing(true);
    
    try {
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId,
        loreCharacters: configRef.current.loreCharacters,
        worldRules: configRef.current.worldRules,
        minSeverity: 'warning', // Skip info-level for less noise
      });
      
      // Add new conflicts (avoid duplicates)
      setConflicts(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newConflicts = result.conflicts.filter(c => !existingIds.has(c.id));
        return [...prev, ...newConflicts].slice(-20); // Keep last 20
      });
      
      console.log(
        `[SmartnessPipeline] Bridge found ${result.conflicts.length} conflicts, ` +
        `created ${result.memoriesCreated} memories (${result.analysisTime}ms)`
      );
    } catch (error) {
      console.error('[SmartnessPipeline] Bridge analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // PROACTIVE THINKER
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleSuggestion = useCallback((suggestion: ProactiveSuggestion) => {
    setSuggestions(prev => {
      // Avoid duplicates by title
      if (prev.some(s => s.title === suggestion.title)) {
        return prev;
      }
      return [...prev, suggestion].slice(-10); // Keep last 10
    });
  }, []);
  
  // Start/stop proactive thinker
  useEffect(() => {
    if (!enableProactiveThinker || !projectId) {
      return;
    }
    
    const thinker = startProactiveThinker(
      getState,
      projectId,
      handleSuggestion,
      { debounceMs: thinkerDebounceMs }
    );
    
    // Update thinker state periodically
    const interval = setInterval(() => {
      setThinkerState(thinker.getStatus());
    }, 1000);
    
    return () => {
      clearInterval(interval);
      stopProactiveThinker();
    };
  }, [projectId, enableProactiveThinker, thinkerDebounceMs, getState, handleSuggestion]);

  // Significant edit monitoring
  useEffect(() => {
    if (!projectId) return;

    startSignificantEditMonitor(projectId);

    return () => {
      stopSignificantEditMonitor();
    };
  }, [projectId]);
  
  const thinkNow = useCallback(async () => {
    const thinker = getProactiveThinker();
    return thinker.forceThink();
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────
  // MANAGEMENT ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  const clearConflicts = useCallback(() => {
    setConflicts([]);
  }, []);
  
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);
  
  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);
  
  return {
    conflicts,
    suggestions,
    isAnalyzing,
    thinkerState,
    analyzeNow,
    thinkNow,
    clearConflicts,
    clearSuggestions,
    dismissSuggestion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE: Create callback for useManuscriptIntelligence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an onIntelligenceReady callback that integrates with the smartness pipeline.
 * 
 * Usage:
 * ```ts
 * const { analyzeNow } = useSmartnessPipeline(getState, config);
 * const onIntelligenceReady = createIntelligenceCallback(analyzeNow);
 * 
 * useManuscriptIntelligence({
 *   chapterId,
 *   initialText,
 *   onIntelligenceReady,
 * });
 * ```
 */
export function createIntelligenceCallback(
  analyzeNow: (intelligence: ManuscriptIntelligence) => Promise<void>,
  options?: {
    /** Minimum time between analyses (ms) */
    debounceMs?: number;
  }
): (intelligence: ManuscriptIntelligence) => void {
  const { debounceMs = 5000 } = options || {};
  let lastAnalysis = 0;
  
  return (intelligence: ManuscriptIntelligence) => {
    const now = Date.now();
    
    // Debounce to avoid too many analyses
    if (now - lastAnalysis < debounceMs) {
      return;
    }
    
    lastAnalysis = now;
    analyzeNow(intelligence);
  };
}
