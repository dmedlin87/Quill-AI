/**
 * Memory Service Interface
 *
 * Abstracts memory layer dependencies for better testability.
 * ProactiveThinker and other services can use this interface
 * instead of directly importing memory functions.
 */

import type { ProactiveSuggestion } from '../memory/proactive';
import type { BedsideHistoryMatch } from '../memory/bedsideHistorySearch';
import type { VoiceProfile } from '@/types/intelligence';

/**
 * Interface for memory-related operations.
 * Implementations can be the real memory service or a mock for testing.
 */
export interface MemoryService {
  /**
   * Evolves the bedside note with new facts.
   */
  evolveBedsideNote: (
    projectId: string,
    observation: string,
    context?: { chapterId?: string }
  ) => Promise<void>;

  /**
   * Gets the voice profile for a character.
   */
  getVoiceProfileForCharacter: (
    projectId: string,
    characterName: string
  ) => Promise<VoiceProfile | null>;

  /**
   * Creates or updates a voice profile.
   */
  upsertVoiceProfile: (
    projectId: string,
    characterName: string,
    profile: VoiceProfile
  ) => Promise<void>;

  /**
   * Extracts facts from text content.
   */
  extractFacts: (
    text: string,
    options?: { maxFacts?: number }
  ) => Promise<string[]>;

  /**
   * Filters lore entities to only novel ones.
   */
  filterNovelLoreEntities: (
    projectId: string,
    entities: Array<{ name: string; type: string }>
  ) => Promise<Array<{ name: string; type: string }>>;

  /**
   * Gets important reminders for the current context.
   */
  getImportantReminders: (
    projectId: string,
    context: { chapterId?: string; cursorPosition?: number }
  ) => Promise<ProactiveSuggestion[]>;

  /**
   * Searches bedside history for relevant matches.
   */
  searchBedsideHistory: (
    projectId: string,
    query: string,
    options?: { limit?: number }
  ) => Promise<BedsideHistoryMatch[]>;
}

/**
 * Default implementation that wraps the actual memory functions.
 */
export function createDefaultMemoryService(): MemoryService {
  // Lazy import to avoid circular dependencies
  return {
    evolveBedsideNote: async (projectId, observation, context) => {
      const { evolveBedsideNote } = await import('../memory');
      return evolveBedsideNote(projectId, observation, context);
    },

    getVoiceProfileForCharacter: async (projectId, characterName) => {
      const { getVoiceProfileForCharacter } = await import('../memory');
      return getVoiceProfileForCharacter(projectId, characterName);
    },

    upsertVoiceProfile: async (projectId, characterName, profile) => {
      const { upsertVoiceProfile } = await import('../memory');
      return upsertVoiceProfile(projectId, characterName, profile);
    },

    extractFacts: async (text, options) => {
      const { extractFacts } = await import('../memory/factExtractor');
      return extractFacts(text, options);
    },

    filterNovelLoreEntities: async (projectId, entities) => {
      const { filterNovelLoreEntities } = await import('../memory/relevance');
      return filterNovelLoreEntities(projectId, entities);
    },

    getImportantReminders: async (projectId, context) => {
      const { getImportantReminders } = await import('../memory/proactive');
      return getImportantReminders(projectId, context);
    },

    searchBedsideHistory: async (projectId, query, options) => {
      const { searchBedsideHistory } = await import('../memory/bedsideHistorySearch');
      return searchBedsideHistory(projectId, query, options);
    },
  };
}

/**
 * Creates a no-op memory service for testing.
 * All methods return empty results or resolve immediately.
 */
export function createNoOpMemoryService(): MemoryService {
  return {
    evolveBedsideNote: async () => {},
    getVoiceProfileForCharacter: async () => null,
    upsertVoiceProfile: async () => {},
    extractFacts: async () => [],
    filterNovelLoreEntities: async (_, entities) => entities,
    getImportantReminders: async () => [],
    searchBedsideHistory: async () => [],
  };
}

/**
 * Creates a mock memory service with configurable responses.
 * Useful for testing specific scenarios.
 */
export function createMockMemoryService(
  overrides: Partial<MemoryService> = {}
): MemoryService {
  const noOp = createNoOpMemoryService();
  return { ...noOp, ...overrides };
}
