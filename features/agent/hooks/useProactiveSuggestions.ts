/**
 * useProactiveSuggestions Hook
 * 
 * Monitors chapter switches and surfaces relevant memory-based suggestions.
 * Integrates with the event bus to respond to navigation events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { eventBus, startProactiveThinker, stopProactiveThinker, getProactiveThinker } from '@/services/appBrain';
import type { AppBrainState } from '@/services/appBrain';
import {
  ProactiveSuggestion,
  generateSuggestionsForChapter,
  getImportantReminders,
} from '@/services/memory/proactive';
import { createMemory, evolveBedsideNote } from '@/services/memory';
import { markLoreEntityDismissed } from '@/services/memory/relevance';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';

export interface UseProactiveSuggestionsOptions {
  /** Project ID to fetch suggestions for */
  projectId: string | null;
  /** Whether to show suggestions (can be disabled by user preference) */
  enabled?: boolean;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** How long to show suggestions before auto-dismiss (ms), 0 = never */
  autoDismissMs?: number;
  /** Function to get current AppBrainState for ProactiveThinker */
  getAppBrainState?: () => AppBrainState;
  /** Enable background proactive thinking */
  enableProactiveThinking?: boolean;
}

export type SuggestionFeedback = 'applied' | 'dismissed' | 'helpful' | 'not_helpful';

export interface UseProactiveSuggestionsResult {
  /** Current active suggestions */
  suggestions: ProactiveSuggestion[];
  /** Dismiss a specific suggestion */
  dismissSuggestion: (id: string) => void;
  /** Dismiss all suggestions */
  dismissAll: () => void;
  /** Apply a suggestion and provide feedback */
  applySuggestion: (suggestion: ProactiveSuggestion) => Promise<void>;
  /** Provide feedback on a suggestion without applying */
  provideFeedback: (suggestion: ProactiveSuggestion, feedback: SuggestionFeedback) => Promise<void>;
  /** Manually trigger suggestion check */
  checkForSuggestions: (chapterId: string, chapterTitle: string, content?: string) => Promise<void>;
  /** Get reminders (stalled goals, unresolved issues) */
  getReminders: () => Promise<ProactiveSuggestion[]>;
  /** Whether proactive thinking is currently active */
  isThinking: boolean;
  /** Force a proactive thinking cycle */
  forceThink: () => Promise<void>;
}

export function useProactiveSuggestions(
  options: UseProactiveSuggestionsOptions
): UseProactiveSuggestionsResult {
  const { 
    projectId, 
    enabled = true, 
    maxSuggestions = 5,
    autoDismissMs = 30000, // 30 seconds default
    getAppBrainState,
    enableProactiveThinking = true,
  } = options;

  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isMountedRef = useRef(true);

  // Dismiss a single suggestion
  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => {
      const target = prev.find(s => s.id === id);
      if (target?.type === 'lore_discovery') {
        const name = (target.metadata?.entityName as string) || target.source.name || target.title;
        if (name) {
          markLoreEntityDismissed(name);
        }
      }
      return prev.filter(s => s.id !== id);
    });
    
    // Clear any auto-dismiss timer
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
  }, []);

  // Dismiss all suggestions
  const dismissAll = useCallback(() => {
    setSuggestions([]);
    
    // Clear all timers
    dismissTimersRef.current.forEach(timer => clearTimeout(timer));
    dismissTimersRef.current.clear();
  }, []);

  // Set up auto-dismiss for a suggestion
  const setupAutoDismiss = useCallback((suggestion: ProactiveSuggestion) => {
    if (autoDismissMs <= 0) return;
    
    const timer = setTimeout(() => {
      dismissSuggestion(suggestion.id);
    }, autoDismissMs);
    
    dismissTimersRef.current.set(suggestion.id, timer);
  }, [autoDismissMs, dismissSuggestion]);

  // Check for suggestions for a specific chapter
  const checkForSuggestions = useCallback(async (
    chapterId: string, 
    chapterTitle: string, 
    content?: string
  ) => {
    if (!projectId || !enabled || !isMountedRef.current) return;
    
    try {
      const newSuggestions = await generateSuggestionsForChapter(projectId, {
        chapterId,
        chapterTitle,
        content,
      });
      
      if (newSuggestions.length > 0) {
        // Merge with existing (avoid duplicates by source ID)
        setSuggestions(prev => {
          if (!isMountedRef.current) return prev;
          
          const existing = new Set(prev.map(s => s.source.id));
          const unique = newSuggestions.filter(s => !existing.has(s.source.id));
          const merged = [...prev, ...unique].slice(0, maxSuggestions);
          
          // Set up auto-dismiss for new ones
          unique.forEach(setupAutoDismiss);
          
          return merged;
        });
      }
    } catch (error) {
      console.warn('[useProactiveSuggestions] Failed to generate suggestions:', error);
    }
  }, [projectId, enabled, maxSuggestions, setupAutoDismiss]);

  // Get reminders (can be called manually)
  const getReminders = useCallback(async (): Promise<ProactiveSuggestion[]> => {
    if (!projectId) return [];
    
    try {
      return await getImportantReminders(projectId);
    } catch (error) {
      console.warn('[useProactiveSuggestions] Failed to get reminders:', error);
      return [];
    }
  }, [projectId]);

  // Record feedback to MemoryService for reinforcement
  const recordFeedback = useCallback(async (
    suggestion: ProactiveSuggestion,
    feedback: SuggestionFeedback
  ) => {
    if (!projectId) return;

    try {
      const importance = feedback === 'applied' || feedback === 'helpful' ? 0.8 : 0.3;
      const feedbackText = `Suggestion feedback: ${feedback}. "${suggestion.title}" - ${suggestion.description.slice(0, 100)}`;

      // Create a memory note recording the feedback
      await createMemory({
        text: feedbackText,
        type: 'observation',
        scope: 'project',
        projectId,
        topicTags: ['suggestion_feedback', `feedback:${feedback}`, suggestion.type],
        importance,
      });

      // For applied suggestions, also update bedside notes
      if (feedback === 'applied') {
        await evolveBedsideNote(
          projectId,
          `Applied suggestion: ${suggestion.title}`,
          { changeReason: 'suggestion_applied' }
        );
      }
    } catch (error) {
      console.warn('[useProactiveSuggestions] Failed to record feedback:', error);
    }
  }, [projectId]);

  // Apply a suggestion (records positive feedback and dismisses)
  const applySuggestion = useCallback(async (suggestion: ProactiveSuggestion) => {
    if (suggestion.type === 'lore_discovery') {
      const openLoreDraft = useLayoutStore.getState().openLoreDraft;
      const name = (suggestion.metadata?.entityName as string) || suggestion.source.name || suggestion.title;
      if (name && openLoreDraft) {
        markLoreEntityDismissed(name);
        openLoreDraft({
          name,
          bio: suggestion.description,
          arc: '',
          voiceTraits: '',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [],
          developmentSuggestion: suggestion.description,
        });
      }
    }
    await recordFeedback(suggestion, 'applied');
    dismissSuggestion(suggestion.id);
  }, [recordFeedback, dismissSuggestion]);

  // Provide feedback on a suggestion
  const provideFeedback = useCallback(async (
    suggestion: ProactiveSuggestion,
    feedback: SuggestionFeedback
  ) => {
    await recordFeedback(suggestion, feedback);
    
    // Dismiss if the feedback indicates rejection
    if (feedback === 'dismissed' || feedback === 'not_helpful') {
      dismissSuggestion(suggestion.id);
    }
  }, [recordFeedback, dismissSuggestion]);

  // Handler for suggestions from ProactiveThinker
  const handleProactiveSuggestion = useCallback((suggestion: ProactiveSuggestion) => {
    if (!isMountedRef.current) return;
    
    setSuggestions(prev => {
      // Avoid duplicates by ID
      if (prev.some(s => s.id === suggestion.id)) return prev;
      
      const merged = [...prev, suggestion].slice(0, maxSuggestions);
      setupAutoDismiss(suggestion);
      return merged;
    });
  }, [maxSuggestions, setupAutoDismiss]);

  // Force a proactive thinking cycle
  const forceThink = useCallback(async () => {
    try {
      const thinker = getProactiveThinker();
      await thinker.forceThink();
    } catch (error) {
      console.warn('[useProactiveSuggestions] Force think failed:', error);
    }
  }, []);

  // Subscribe to chapter switch events
  useEffect(() => {
    if (!enabled || !projectId) return;
    
    const unsubscribe = eventBus.subscribe('CHAPTER_SWITCHED', async (event) => {
      // Type guard for CHAPTER_SWITCHED payload
      if (event.type === 'CHAPTER_SWITCHED') {
        const { chapterId, title } = event.payload as { chapterId: string; title: string };
        await checkForSuggestions(chapterId, title);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [enabled, projectId, checkForSuggestions]);

  // Subscribe to ProactiveThinker events
  useEffect(() => {
    if (!enabled || !projectId) return;

    // Subscribe to thinking state events
    const unsubStarted = eventBus.subscribe('PROACTIVE_THINKING_STARTED', () => {
      if (isMountedRef.current) setIsThinking(true);
    });

    const unsubCompleted = eventBus.subscribe('PROACTIVE_THINKING_COMPLETED', () => {
      if (isMountedRef.current) setIsThinking(false);
    });

    return () => {
      unsubStarted();
      unsubCompleted();
    };
  }, [enabled, projectId]);

  // Start/stop ProactiveThinker based on options
  useEffect(() => {
    if (!enabled || !projectId || !enableProactiveThinking || !getAppBrainState) {
      return;
    }

    // Start the proactive thinker
    startProactiveThinker(
      getAppBrainState,
      projectId,
      handleProactiveSuggestion
    );

    return () => {
      stopProactiveThinker();
    };
  }, [enabled, projectId, enableProactiveThinking, getAppBrainState, handleProactiveSuggestion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clean up all timers
      dismissTimersRef.current.forEach(timer => clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, []);

  // Clear suggestions when project changes
  useEffect(() => {
    dismissAll();
  }, [projectId, dismissAll]);

  return {
    suggestions,
    dismissSuggestion,
    dismissAll,
    applySuggestion,
    provideFeedback,
    checkForSuggestions,
    getReminders,
    isThinking,
    forceThink,
  };
}

export default useProactiveSuggestions;
