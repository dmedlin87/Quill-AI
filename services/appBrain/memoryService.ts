/**
 * Memory Service Interface
 *
 * Abstracts memory layer dependencies for better testability.
 * ProactiveThinker and other services can use this interface
 * instead of directly importing memory functions.
 */

import type { ProactiveSuggestion } from '../memory/proactive';
import type { BedsideHistoryMatch } from '../memory/bedsideHistorySearch';
import type { MemoryNote } from '../memory/types';
import type { DialogueLine, EntityNode, ManuscriptIntelligence, VoiceProfile } from '@/types/intelligence';
import type { ExtractedFact } from '../memory/factExtractor';
import type { LoreEntityCandidate } from '../memory/relevance';

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
  ) => Promise<MemoryNote>;

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
    dialogueLines: DialogueLine[]
  ) => Promise<VoiceProfile>;

  /**
   * Extracts facts from intelligence results.
   */
  extractFacts: (
    intelligence: ManuscriptIntelligence
  ) => Promise<ExtractedFact[]>;

  /**
   * Filters lore entities to only novel ones.
   */
  filterNovelLoreEntities: (
    entities: EntityNode[],
    existingGraphNames?: string[]
  ) => Promise<LoreEntityCandidate[]>;

  /**
   * Gets important reminders for the current context.
   */
  getImportantReminders: (
    projectId: string
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

    upsertVoiceProfile: async (projectId, characterName, dialogueLines) => {
      const { upsertVoiceProfile } = await import('../memory');
      return upsertVoiceProfile(projectId, characterName, dialogueLines);
    },

    extractFacts: async (intelligence) => {
      const { extractFacts } = await import('../memory/factExtractor');
      return extractFacts(intelligence);
    },

    filterNovelLoreEntities: async (entities, existingGraphNames) => {
      const { filterNovelLoreEntities } = await import('../memory/relevance');
      return filterNovelLoreEntities(entities, existingGraphNames);
    },

    getImportantReminders: async (projectId) => {
      const { getImportantReminders } = await import('../memory/proactive');
      return getImportantReminders(projectId);
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
    evolveBedsideNote: async () => {
      throw new Error('createNoOpMemoryService.evolveBedsideNote is not implemented');
    },
    getVoiceProfileForCharacter: async () => null,
    upsertVoiceProfile: async () => {
      throw new Error('createNoOpMemoryService.upsertVoiceProfile is not implemented');
    },
    extractFacts: async () => [],
    filterNovelLoreEntities: async (entities) =>
      entities.map((entity) => ({ name: entity.name, type: entity.type, firstMention: entity.firstMention })),
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
