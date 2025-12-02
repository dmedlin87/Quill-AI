/**
 * Realtime Memory Triggers (Enhancement 3C)
 * 
 * Proactive triggers that fire when user types content matching
 * patterns that should surface relevant memories.
 */

import { MemoryNote } from './types';
import { getMemoriesCached, searchMemoriesByTags } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryTrigger {
  id: string;
  name: string;
  pattern: RegExp;
  priority: 'immediate' | 'debounced';
  memoryQuery: (match: RegExpMatchArray, projectId: string) => Promise<MemoryNote[]>;
  formatSuggestion: (memories: MemoryNote[], match: RegExpMatchArray) => string;
}

export interface TriggerResult {
  triggerId: string;
  triggerName: string;
  matchedText: string;
  memories: MemoryNote[];
  suggestion: string;
  priority: 'immediate' | 'debounced';
}

export interface TriggerConfig {
  enabled: boolean;
  debounceMs: number;
  maxResults: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────

const defaultTriggers: MemoryTrigger[] = [
  // Character name mentions
  {
    id: 'character_mention',
    name: 'Character Reference',
    pattern: /\b([A-Z][a-z]{2,})\b(?:'s|'s)?\s+(?:said|thought|felt|looked|walked|ran)/i,
    priority: 'debounced',
    memoryQuery: async (match, projectId) => {
      const name = match[1].toLowerCase();
      return searchMemoriesByTags([`character:${name}`], { projectId, limit: 5 });
    },
    formatSuggestion: (memories, match) => {
      if (memories.length === 0) return '';
      return `📝 Remember about ${match[1]}: ${memories[0].text.slice(0, 100)}...`;
    },
  },
  
  // Physical description patterns
  {
    id: 'physical_description',
    name: 'Physical Description',
    pattern: /\b(\w+)'s?\s+(eyes|hair|face|hands|build|height)\s+(were|was|is|are)/i,
    priority: 'immediate',
    memoryQuery: async (match, projectId) => {
      const name = match[1].toLowerCase();
      const attribute = match[2].toLowerCase();
      return searchMemoriesByTags([`character:${name}`, attribute], { projectId, limit: 3 });
    },
    formatSuggestion: (memories, match) => {
      if (memories.length === 0) return '';
      const existing = memories.find(m => 
        m.text.toLowerCase().includes(match[2].toLowerCase())
      );
      if (existing) {
        return `⚠️ Existing description: ${existing.text}`;
      }
      return '';
    },
  },
  
  // Relationship patterns
  {
    id: 'relationship',
    name: 'Relationship Reference',
    pattern: /\b([A-Z][a-z]+)\s+(?:and|with)\s+([A-Z][a-z]+)/i,
    priority: 'debounced',
    memoryQuery: async (match, projectId) => {
      const name1 = match[1].toLowerCase();
      const name2 = match[2].toLowerCase();
      const byTag1 = await searchMemoriesByTags([`character:${name1}`], { projectId, limit: 10 });
      return byTag1.filter(m => 
        m.text.toLowerCase().includes(name2) || 
        m.topicTags.includes(`character:${name2}`)
      );
    },
    formatSuggestion: (memories, match) => {
      if (memories.length === 0) return '';
      const relMemory = memories.find(m => m.topicTags.includes('relationship'));
      if (relMemory) {
        return `👥 ${match[1]} & ${match[2]}: ${relMemory.text.slice(0, 80)}...`;
      }
      return '';
    },
  },
  
  // Time/date references
  {
    id: 'time_reference',
    name: 'Timeline Reference',
    pattern: /\b(years?|months?|weeks?|days?)\s+(ago|later|before|after)\b/i,
    priority: 'debounced',
    memoryQuery: async (match, projectId) => {
      return searchMemoriesByTags(['timeline', 'event'], { projectId, limit: 5 });
    },
    formatSuggestion: (memories) => {
      if (memories.length === 0) return '';
      return `⏰ Timeline events to consider: ${memories.length} related memories`;
    },
  },
  
  // Location mentions
  {
    id: 'location',
    name: 'Location Reference',
    pattern: /\b(?:in|at|to|from)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    priority: 'debounced',
    memoryQuery: async (match, projectId) => {
      const location = match[1].toLowerCase();
      return searchMemoriesByTags([`location:${location}`, 'setting'], { projectId, limit: 3 });
    },
    formatSuggestion: (memories, match) => {
      if (memories.length === 0) return '';
      return `📍 About ${match[1]}: ${memories[0].text.slice(0, 80)}...`;
    },
  },
  
  // Contradiction keywords
  {
    id: 'contradiction_risk',
    name: 'Contradiction Alert',
    pattern: /\b(always|never|first time|only|unique|the one)\b/i,
    priority: 'immediate',
    memoryQuery: async (match, projectId) => {
      // Use cached project memories to avoid repeated Dexie queries
      const allProjectMemories = await getMemoriesCached(projectId, { limit: 50 });
      return allProjectMemories
        .filter(m => m.type === 'issue')
        .slice(0, 5);
    },
    formatSuggestion: (memories) => {
      const contradictions = memories.filter(m => 
        m.topicTags.includes('inconsistency') || m.topicTags.includes('contradiction')
      );
      if (contradictions.length > 0) {
        return `⚠️ ${contradictions.length} known inconsistencies - verify absolute statements`;
      }
      return '';
    },
  },
  
  // Plot thread references
  {
    id: 'plot_thread',
    name: 'Plot Thread',
    pattern: /\b(secret|mystery|quest|mission|promise|vow|oath)\b/i,
    priority: 'debounced',
    memoryQuery: async (match, projectId) => {
      return searchMemoriesByTags(['plot', 'thread', 'promise'], { projectId, limit: 5 });
    },
    formatSuggestion: (memories) => {
      const unresolved = memories.filter(m => !m.topicTags.includes('resolved'));
      if (unresolved.length > 0) {
        return `📖 ${unresolved.length} open plot threads to consider`;
      }
      return '';
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check text against all triggers
 */
export const checkTriggers = async (
  text: string,
  projectId: string,
  options: {
    priorityFilter?: 'immediate' | 'debounced' | 'all';
    maxResults?: number;
  } = {}
): Promise<TriggerResult[]> => {
  const { priorityFilter = 'all', maxResults = 5 } = options;
  
  const triggers = priorityFilter === 'all'
    ? defaultTriggers
    : defaultTriggers.filter(t => t.priority === priorityFilter);
  
  const results: TriggerResult[] = [];
  
  for (const trigger of triggers) {
    const match = text.match(trigger.pattern);
    if (match) {
      try {
        const memories = await trigger.memoryQuery(match, projectId);
        
        if (memories.length > 0) {
          const suggestion = trigger.formatSuggestion(memories, match);
          
          if (suggestion) {
            results.push({
              triggerId: trigger.id,
              triggerName: trigger.name,
              matchedText: match[0],
              memories,
              suggestion,
              priority: trigger.priority,
            });
          }
        }
      } catch (error) {
        console.warn(`[realtimeTriggers] Trigger ${trigger.id} failed:`, error);
      }
    }
    
    if (results.length >= maxResults) break;
  }
  
  // Sort by priority (immediate first)
  return results.sort((a, b) => {
    if (a.priority === 'immediate' && b.priority !== 'immediate') return -1;
    if (b.priority === 'immediate' && a.priority !== 'immediate') return 1;
    return 0;
  });
};

/**
 * Check immediate triggers only (for real-time feedback)
 */
export const checkImmediateTriggers = async (
  text: string,
  projectId: string
): Promise<TriggerResult[]> => {
  return checkTriggers(text, projectId, { priorityFilter: 'immediate', maxResults: 3 });
};

/**
 * Check debounced triggers (for background suggestions)
 */
export const checkDebouncedTriggers = async (
  text: string,
  projectId: string
): Promise<TriggerResult[]> => {
  return checkTriggers(text, projectId, { priorityFilter: 'debounced', maxResults: 5 });
};

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a custom trigger
 */
export const registerTrigger = (trigger: MemoryTrigger): void => {
  // Check for duplicate ID
  const existingIdx = defaultTriggers.findIndex(t => t.id === trigger.id);
  if (existingIdx >= 0) {
    defaultTriggers[existingIdx] = trigger;
  } else {
    defaultTriggers.push(trigger);
  }
};

/**
 * Get all registered triggers
 */
export const getRegisteredTriggers = (): MemoryTrigger[] => {
  return [...defaultTriggers];
};

/**
 * Disable a trigger
 */
export const disableTrigger = (triggerId: string): boolean => {
  const idx = defaultTriggers.findIndex(t => t.id === triggerId);
  if (idx >= 0) {
    defaultTriggers.splice(idx, 1);
    return true;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a debounced trigger checker for use in React
 */
export const createTriggerChecker = (
  projectId: string,
  config: TriggerConfig = { enabled: true, debounceMs: 500, maxResults: 3 }
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastText = '';
  
  return {
    check: (
      text: string,
      onResult: (results: TriggerResult[]) => void
    ) => {
      if (!config.enabled) return;
      if (text === lastText) return;
      
      lastText = text;
      
      // Clear existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Check immediate triggers right away
      checkImmediateTriggers(text, projectId).then(immediateResults => {
        if (immediateResults.length > 0) {
          onResult(immediateResults);
        }
      });
      
      // Schedule debounced check
      timeoutId = setTimeout(async () => {
        const debouncedResults = await checkDebouncedTriggers(text, projectId);
        if (debouncedResults.length > 0) {
          onResult(debouncedResults);
        }
      }, config.debounceMs);
    },
    
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
};
