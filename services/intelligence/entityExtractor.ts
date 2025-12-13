/**
 * Entity Extractor
 * 
 * Deterministic Named Entity Recognition without LLM calls:
 * - Character detection via proper nouns and dialogue attribution
 * - Location extraction via spatial patterns
 * - Object detection via possession patterns
 * - Relationship inference via co-occurrence
 */

import {
  EntityNode,
  EntityEdge,
  EntityGraph,
  EntityType,
  RelationshipType,
} from '../../types/intelligence';
import { DialogueLine, ClassifiedParagraph } from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// PATTERNS & LEXICONS
// ─────────────────────────────────────────────────────────────────────────────

// Common words that look like names but aren't
const FALSE_POSITIVES = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'they', 'we', 'i',
  'he', 'she', 'him', 'her', 'his', 'hers', 'their', 'our', 'my', 'your',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month', 'year',
  'north', 'south', 'east', 'west',
  'chapter', 'part', 'book', 'section', 'act', 'scene',
  'said', 'asked', 'replied', 'answered', 'thought', 'knew', 'felt', 'saw',
  'but', 'and', 'or', 'if', 'when', 'then', 'now', 'here', 'there',
  'yes', 'no', 'maybe', 'perhaps', 'certainly', 'definitely',
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third', 'last',
]);

// Titles that indicate character names follow
const TITLES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'professor', 'prof', 
  'sir', 'lady', 'lord', 'king', 'queen', 'prince', 'princess', 'captain', 
  'general', 'colonel', 'major', 'sergeant', 'officer', 'detective', 'agent',
  'father', 'mother', 'brother', 'sister', 'uncle', 'aunt', 'grandpa', 'grandma'];

const LOCATION_PREPOSITIONS = ['in', 'at', 'inside', 'outside', 'within', 'near', 
  'by', 'behind', 'before', 'above', 'below', 'beneath', 'beside', 'between',
  'through', 'across', 'around', 'toward', 'towards', 'into', 'onto', 'upon'];

// Possession patterns for objects
const POSSESSION_PATTERNS = [
  /(\w+)'s\s+(\w+)/g,              // "Marcus's sword"
  /the\s+(\w+)\s+of\s+([A-Z]\w+)/g, // "the crown of Marcus"
  /(\w+)\s+held\s+(?:a|an|the|his|her)\s+(\w+)/g,
  /(\w+)\s+carried\s+(?:a|an|the|his|her)\s+(\w+)/g,
  /(\w+)\s+drew\s+(?:a|an|the|his|her)\s+(\w+)/g,
];

const RELATIONSHIP_PATTERNS: Array<{ pattern: RegExp; type: RelationshipType }> = [
  { pattern: /(\w+)\s+(?:loved|loves|kissed|embraced|married)\s+(\w+)/gi, type: 'related_to' },
  { pattern: /(\w+)\s+(?:attacked|fought|killed|struck|hit)\s+(\w+)/gi, type: 'opposes' },
  { pattern: /(\w+)\s+(?:helped|saved|protected|defended)\s+(\w+)/gi, type: 'allied_with' },
  { pattern: /(\w+)\s+and\s+(\w+)\s+(?:worked|traveled|walked|ran)\s+together/gi, type: 'allied_with' },
  { pattern: /(\w+)\s+(?:hated|despised|feared)\s+(\w+)/gi, type: 'opposes' },
  { pattern: /(\w+)\s+(?:trusted|believed|followed)\s+(\w+)/gi, type: 'allied_with' },
];

// Pre-compiled regex patterns for optimization
// Combine titles into one regex: \b(Mr|Mrs|...)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b
const TITLES_REGEX = new RegExp(`\\b(${TITLES.join('|')})\\.?\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\b`, 'gi');

// Combine location prepositions: \b(in|at|...)\s+(?:the\s+)?([A-Za-z][A-Za-z]*(?:\\s+[A-Za-z][A-Za-z]*)*)\b
const LOCATIONS_PREPOSITIONS_REGEX = new RegExp(`\\b(${LOCATION_PREPOSITIONS.join('|')})\\s+(?:the\\s+)?([A-Za-z][A-Za-z]*(?:\\s+[A-Za-z][A-Za-z]*)*)\\b`, 'gi');

const SIGNIFICANT_OBJECTS = ['sword', 'crown', 'ring', 'staff', 'wand', 'book',
  'scroll', 'key', 'gem', 'stone', 'amulet', 'pendant', 'necklace', 'bracelet',
  'shield', 'armor', 'cloak', 'robe', 'dagger', 'bow', 'arrow', 'spear', 'axe',
  'hammer', 'chalice', 'goblet', 'mirror', 'orb', 'crystal', 'map', 'letter'];

// Combine objects: the\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+(sword|crown|...)|the\s+(sword|crown|...)\\s+of\\s+([A-Z][a-z]+)
const OBJECTS_REGEX = new RegExp(`the\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+(${SIGNIFICANT_OBJECTS.join('|')})|the\\s+(${SIGNIFICANT_OBJECTS.join('|')})\\s+of\\s+([A-Z][a-z]+)`, 'gi');


// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const normalizeEntityName = (name: string): string => {
  return name.trim().replace(/[.,!?;:'"]/g, '');
};

export const isValidEntityName = (name: string): boolean => {
  const normalized = normalizeEntityName(name.toLowerCase());
  if (FALSE_POSITIVES.has(normalized)) return false;
  if (normalized.length < 2) return false;
  if (normalized.length > 30) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
};

const isProperNoun = (word: string): boolean => {
  return /^[A-Z][a-z]+$/.test(word);
};

// Helper to compute a canonical key for an entity name, used for consolidation.
// This prefers grouping by surname when the bare surname appears in the text,
// while avoiding over-merging different characters who simply share a surname.
export const getCanonicalEntityKey = (
  rawName: string,
  surnameMap: Map<string, { hasBare: boolean }>,
): string => {
  const lower = rawName.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return lower;

  const nonTitleTokens = tokens.filter((token, index) => {
    if (index === 0 && TITLES.includes(token)) return false;
    return true;
  });

  if (nonTitleTokens.length === 0) {
    return lower;
  }

  const surname = nonTitleTokens[nonTitleTokens.length - 1];
  const info = surnameMap.get(surname);

  // Otherwise, keep the full non-title name as the key so distinct characters
  // with the same surname remain separate.
  return nonTitleTokens.join(' ');
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

interface RawEntity {
  name: string;
  type: EntityType;
  offset: number;
  context: string;
}

const extractCharactersFromText = (text: string): RawEntity[] => {
  const entities: RawEntity[] = [];
  
  // Pattern 1: Proper nouns at sentence starts or after dialogue
  const properNounPattern = /(?:^|[.!?]\s+|["']\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  let match;
  
  while ((match = properNounPattern.exec(text)) !== null) {
    const name = normalizeEntityName(match[1]);
    if (isValidEntityName(name)) {
      entities.push({
        name,
        type: 'character',
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 30), match.index + 50),
      });
    }
  }
  
  // Pattern 2: Names after titles (OPTIMIZED)
  // Reset lastIndex for reusable global regex
  TITLES_REGEX.lastIndex = 0;
  while ((match = TITLES_REGEX.exec(text)) !== null) {
    // match[1] is title, match[2] is name
    const title = match[1];
    const namePart = match[2];
    const name = normalizeEntityName(namePart);
    if (isValidEntityName(name)) {
      entities.push({
        name: `${title.charAt(0).toUpperCase() + title.slice(1)} ${name}`,
        type: 'character',
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 30), match.index + 50),
      });
    }
  }
  
  // Pattern 3: Names in dialogue attribution ("X said", "said X")
  const dialogueAttrPattern = /["'].*?["']\s*,?\s*(?:said|asked|replied|whispered|shouted|muttered|exclaimed)\s+([A-Z][a-z]+)/g;
  while ((match = dialogueAttrPattern.exec(text)) !== null) {
    const name = normalizeEntityName(match[1]);
    if (isValidEntityName(name)) {
      entities.push({
        name,
        type: 'character',
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 30), match.index + 50),
      });
    }
  }
  
  // Pattern 4: "X said" before dialogue
  const preDialoguePattern = /([A-Z][a-z]+)\s+(?:said|asked|replied|whispered|shouted|muttered|exclaimed)\s*,?\s*["']/g;
  while ((match = preDialoguePattern.exec(text)) !== null) {
    const name = normalizeEntityName(match[1]);
    if (isValidEntityName(name)) {
      entities.push({
        name,
        type: 'character',
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 30), match.index + 50),
      });
    }
  }
  
  return entities;
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const extractLocations = (text: string): RawEntity[] => {
  const entities: RawEntity[] = [];
  
  // Optimized: Single pass for all prepositions
  LOCATIONS_PREPOSITIONS_REGEX.lastIndex = 0;
  let match;
  while ((match = LOCATIONS_PREPOSITIONS_REGEX.exec(text)) !== null) {
    // match[1] is preposition, match[2] is location (potentially greedy)
    const rawMatch = match[2];
    // Split by whitespace and stop at first "stop word" (like "and", "then", "said")
    const words = rawMatch.split(/\s+/);
    const validWords: string[] = [];

    for (const word of words) {
      const normalizedWord = normalizeEntityName(word.toLowerCase());
      if (FALSE_POSITIVES.has(normalizedWord)) {
        break;
      }
      validWords.push(word);
    }

    if (validWords.length === 0) continue;

    const truncatedName = validWords.join(' ');
    const name = normalizeEntityName(truncatedName);

    if (isValidEntityName(name) && name.length > 2) {
      entities.push({
        name,
        type: 'location',
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 30), match.index + 50),
      });
    }
  }
  
  // Pattern: "the X" where X is a place-like noun
  const placeNouns = ['castle', 'palace', 'tower', 'house', 'hall', 'chamber', 
    'room', 'forest', 'mountain', 'river', 'lake', 'sea', 'ocean', 'city', 
    'town', 'village', 'kingdom', 'realm', 'land', 'world', 'tavern', 'inn',
    'temple', 'church', 'cathedral', 'dungeon', 'cave', 'prison', 'throne'];
  
  for (const noun of placeNouns) {
    const pattern = new RegExp(`\\bthe\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+${noun}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = `${normalizeEntityName(match[1])} ${noun.charAt(0).toUpperCase() + noun.slice(1)}`;
      if (isValidEntityName(name)) {
        entities.push({
          name,
          type: 'location',
          offset: match.index,
          context: text.slice(Math.max(0, match.index - 30), match.index + 50),
        });
      }
    }
  }
  
  const explicitPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let explicitMatch;
  while ((explicitMatch = explicitPattern.exec(text)) !== null) {
    const name = normalizeEntityName(explicitMatch[1]);
    if (isValidEntityName(name) && !entities.some(e => e.name.toLowerCase() === name.toLowerCase())) {
      entities.push({
        name,
        type: 'location',
        offset: explicitMatch.index,
        context: text.slice(Math.max(0, explicitMatch.index - 30), explicitMatch.index + 50),
      });
    }
  }

  return entities;
};

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const extractObjects = (text: string): RawEntity[] => {
  const entities: RawEntity[] = [];
  
  // Optimized: Single pass for all significant objects
  OBJECTS_REGEX.lastIndex = 0;
  let match;
  while ((match = OBJECTS_REGEX.exec(text)) !== null) {
    // Group 1: Name (before object), Group 2: Object
    // Group 3: Object (before name), Group 4: Name

    const nameBefore = match[1];
    const objectAfter = match[2];

    const objectBefore = match[3];
    const nameAfter = match[4];

    const name = nameBefore || nameAfter;
    const obj = objectAfter || objectBefore;

    if (name && obj && isValidEntityName(name)) {
       entities.push({
          name: `The ${name} ${obj.charAt(0).toUpperCase() + obj.slice(1)}`,
          type: 'object',
          offset: match.index,
          context: text.slice(Math.max(0, match.index - 30), match.index + 50),
        });
    }
  }
  
  return entities;
};

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY CONSOLIDATION
// ─────────────────────────────────────────────────────────────────────────────

const consolidateEntities = (rawEntities: RawEntity[], chapterId: string): EntityNode[] => {
  const entityMap = new Map<string, EntityNode>();
  
  // First pass: build a map of surnames and whether they appear alone
  const surnameMap = new Map<string, { hasBare: boolean }>();
  for (const raw of rawEntities) {
    const lower = raw.name.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const nonTitleTokens = tokens.filter((token, index) => {
      if (index === 0 && TITLES.includes(token)) return false;
      return true;
    });

    if (nonTitleTokens.length === 0) continue;

    const surname = nonTitleTokens[nonTitleTokens.length - 1];
    const isBare = nonTitleTokens.length === 1;
    const existing = surnameMap.get(surname) ?? { hasBare: false };
    if (isBare) {
      existing.hasBare = true;
    }
    surnameMap.set(surname, existing);
  }

  // Second pass: consolidate entities using canonical keys
  for (const raw of rawEntities) {
    const key = getCanonicalEntityKey(raw.name, surnameMap);

    if (entityMap.has(key)) {
      // Update existing entity
      const existing = entityMap.get(key)!;
      existing.mentionCount++;
      existing.mentions.push({ offset: raw.offset, chapterId });
    } else {
      // Create new entity
      entityMap.set(key, {
        id: generateId(),
        name: raw.name,
        type: raw.type,
        aliases: [],
        firstMention: raw.offset,
        mentionCount: 1,
        mentions: [{ offset: raw.offset, chapterId }],
        attributes: {},
      });
    }
  }

  // Sort by mention count (more mentioned = more important)
  return Array.from(entityMap.values())
    .sort((a, b) => b.mentionCount - a.mentionCount);
};

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const detectRelationships = (
  text: string,
  entities: EntityNode[],
  paragraphs: ClassifiedParagraph[],
  chapterId: string
): EntityEdge[] => {
  const edges: EntityEdge[] = [];
  const edgeMap = new Map<string, EntityEdge>();

  // Map from lowercase name/alias to entity node for fast lookup and
  // to allow explicit relationship patterns to introduce new entities when
  // they were not previously detected by the character extractor.
  const nameToNode = new Map<string, EntityNode>();
  for (const entity of entities) {
    const nameKey = entity.name.toLowerCase();
    if (!nameToNode.has(nameKey)) {
      nameToNode.set(nameKey, entity);
    }
    for (const alias of entity.aliases) {
      const aliasKey = alias.toLowerCase();
      if (!nameToNode.has(aliasKey)) {
        nameToNode.set(aliasKey, entity);
      }
    }
  }

  // Method 1: Co-occurrence within paragraphs
  for (const para of paragraphs) {
    const paraText = text.slice(para.offset, para.offset + para.length).toLowerCase();
    const presentEntities: EntityNode[] = [];

    for (const entity of entities) {
      if (paraText.includes(entity.name.toLowerCase())) {
        presentEntities.push(entity);
      }
    }

    // Create edges between co-occurring entities
    for (let i = 0; i < presentEntities.length; i++) {
      for (let j = i + 1; j < presentEntities.length; j++) {
        const source = presentEntities[i];
        const target = presentEntities[j];
        const edgeKey = [source.id, target.id].sort().join('-');

        if (edgeMap.has(edgeKey)) {
          const edge = edgeMap.get(edgeKey)!;
          edge.coOccurrences++;
          if (!edge.chapters.includes(chapterId)) {
            edge.chapters.push(chapterId);
          }
        } else {
          edgeMap.set(edgeKey, {
            id: generateId(),
            source: source.id,
            target: target.id,
            type: 'interacts',
            coOccurrences: 1,
            sentiment: 0,
            chapters: [chapterId],
            evidence: [paraText.slice(0, 100)],
          });
        }
      }
    }
  }

  // Method 2: Explicit relationship patterns
  for (const { pattern, type } of RELATIONSHIP_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rawName1 = match[1];
      const rawName2 = match[2];
      if (!rawName1 || !rawName2) continue;

      const name1 = normalizeEntityName(rawName1).toLowerCase();
      const name2 = normalizeEntityName(rawName2).toLowerCase();

      let entity1 = nameToNode.get(name1);
      if (!entity1) {
        entity1 = {
          id: generateId(),
          name: normalizeEntityName(rawName1),
          type: 'character',
          aliases: [],
          firstMention: match.index,
          mentionCount: 1,
          mentions: [{ offset: match.index, chapterId }],
          attributes: {},
        };
        entities.push(entity1);
        nameToNode.set(name1, entity1);
      }

      let entity2 = nameToNode.get(name2);
      if (!entity2) {
        // Estimate second name offset as just after the first name; precise
        // position is not critical for graph semantics.
        const secondOffset = match.index + rawName1.length + 1;
        entity2 = {
          id: generateId(),
          name: normalizeEntityName(rawName2),
          type: 'character',
          aliases: [],
          firstMention: secondOffset,
          mentionCount: 1,
          mentions: [{ offset: secondOffset, chapterId }],
          attributes: {},
        };
        entities.push(entity2);
        nameToNode.set(name2, entity2);
      }

      const edgeKey = [entity1.id, entity2.id].sort().join('-');

      if (edgeMap.has(edgeKey)) {
        const edge = edgeMap.get(edgeKey)!;
        // Upgrade relationship type if more specific
        if (edge.type === 'interacts') {
          edge.type = type;
        }
        edge.evidence.push(match[0]);
      } else {
        edgeMap.set(edgeKey, {
          id: generateId(),
          source: entity1.id,
          target: entity2.id,
          type,
          coOccurrences: 1,
          sentiment: type === 'opposes' ? -0.5 : 0.5,
          chapters: [chapterId],
          evidence: [match[0]],
        });
      }
    }
  }

  return Array.from(edgeMap.values());
};

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const detectAliases = (text: string, entities: EntityNode[]): void => {
  // Common alias patterns
  const aliasPatterns = [
    // "X, known as Y" / "X, called Y"
    /([A-Z][a-z]+),?\s+(?:known|called|nicknamed)\s+(?:as\s+)?["']?([A-Z][a-z]+)["']?/g,
    // "Y, whose real name was X"
    /([A-Z][a-z]+),?\s+whose\s+(?:real|true)\s+name\s+(?:was|is)\s+([A-Z][a-z]+)/g,
    // "the X" referring to a character
    /(?:^|[.!?]\s+)(the\s+[a-z]+\s+[a-z]+)\s+(?:was|had|did|could|would|said|asked)/gi,
  ];
  
  for (const pattern of aliasPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Some patterns only provide a single capture group (e.g. "the knight commander").
      // Ensure both captures exist before attempting to add aliases to avoid
      // undefined lookups and accidental alias pollution.
      const [capture1, capture2] = [match[1], match[2]];
      if (!capture1 || !capture2) continue;

      const name1 = normalizeEntityName(capture1).toLowerCase();
      const name2 = normalizeEntityName(capture2).toLowerCase();
      
      // Find matching entity and add alias
      for (const entity of entities) {
        if (entity.name.toLowerCase() === name1) {
          if (!entity.aliases.includes(capture2)) {
            entity.aliases.push(capture2);
          }
        } else if (entity.name.toLowerCase() === name2) {
          if (!entity.aliases.includes(capture1)) {
            entity.aliases.push(capture1);
          }
        }
      }
    }
  }

  // Resolve pronouns to entities (adds to mention counts)
  // Note: This function doesn't need to be defined here as it is called in extractEntities
};

// ─────────────────────────────────────────────────────────────────────────────
// PRONOUN RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface CoReference {
  pronoun: string;
  offset: number;
  resolvedTo: string;  // Entity ID
  confidence: number;
}

const MALE_PRONOUNS = new Set(['he', 'him', 'his', 'himself']);
const FEMALE_PRONOUNS = new Set(['she', 'her', 'hers', 'herself']);
const NEUTRAL_PRONOUNS = new Set(['they', 'them', 'their', 'theirs', 'themselves']);

// Infer gender from context or common name patterns
const inferGender = (entity: EntityNode, text: string): 'male' | 'female' | 'neutral' | 'unknown' => {
  const nameLower = entity.name.toLowerCase();
  
  // Check common female name endings
  const femaleEndings = ['a', 'ia', 'ina', 'ella', 'anna', 'ette', 'elle'];
  const maleEndings = ['ius', 'us', 'son', 'ton'];
  
  for (const ending of femaleEndings) {
    if (nameLower.endsWith(ending)) return 'female';
  }
  for (const ending of maleEndings) {
    if (nameLower.endsWith(ending)) return 'male';
  }
  
  // Check context around mentions for gendered pronouns
  for (const mention of entity.mentions.slice(0, 5)) {
    const context = text.slice(
      Math.max(0, mention.offset - 100),
      Math.min(text.length, mention.offset + entity.name.length + 100)
    ).toLowerCase();
    
    // Count gendered pronouns near this entity
    const maleCount = [...MALE_PRONOUNS].filter(p => context.includes(p)).length;
    const femaleCount = [...FEMALE_PRONOUNS].filter(p => context.includes(p)).length;
    
    if (maleCount > femaleCount + 1) return 'male';
    if (femaleCount > maleCount + 1) return 'female';
  }
  
  return 'unknown';
};

const resolvePronoun = (
  pronoun: string,
  offset: number,
  recentEntities: EntityNode[],
  text: string
): CoReference | null => {
  const pronounLower = pronoun.toLowerCase();
  
  // Filter candidates by gender
  let candidates = recentEntities.filter(e => e.type === 'character');
  
  if (MALE_PRONOUNS.has(pronounLower)) {
    const genderedCandidates = candidates.filter(e => {
      const gender = inferGender(e, text);
      return gender === 'male' || gender === 'unknown';
    });
    if (genderedCandidates.length > 0) candidates = genderedCandidates;
  } else if (FEMALE_PRONOUNS.has(pronounLower)) {
    const genderedCandidates = candidates.filter(e => {
      const gender = inferGender(e, text);
      return gender === 'female' || gender === 'unknown';
    });
    if (genderedCandidates.length > 0) candidates = genderedCandidates;
  }
  
  if (candidates.length === 0) return null;
  
  // Find closest preceding mention
  let bestCandidate = candidates[0];
  let bestDistance = Infinity;
  
  for (const entity of candidates) {
    for (const mention of entity.mentions) {
      // Only consider mentions before this pronoun
      if (mention.offset < offset) {
        const distance = offset - mention.offset;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = entity;
        }
      }
    }
  }
  
  // Confidence based on distance
  const confidence = bestDistance < 100 ? 0.9 : bestDistance < 300 ? 0.7 : 0.5;
  
  return {
    pronoun,
    offset,
    resolvedTo: bestCandidate.id,
    confidence,
  };
};

const resolvePronounsInText = (
  text: string,
  entities: EntityNode[],
  chapterId: string
): CoReference[] => {
  const coReferences: CoReference[] = [];
  
  // Only resolve if we have character entities
  const characters = entities.filter(e => e.type === 'character');
  if (characters.length === 0) return coReferences;
  
  // Find pronouns in text
  const pronounPattern = /\b(he|him|his|himself|she|her|hers|herself|they|them|their|theirs|themselves)\b/gi;
  let match;
  
  while ((match = pronounPattern.exec(text)) !== null) {
    const resolved = resolvePronoun(match[1], match.index, characters, text);
    if (resolved && resolved.confidence >= 0.5) {
      coReferences.push(resolved);
      
      // Add as mention to the resolved entity
      const entity = entities.find(e => e.id === resolved.resolvedTo);
      if (entity) {
        entity.mentions.push({ offset: match.index, chapterId });
        entity.mentionCount++;
      }
    }
  }
  
  return coReferences;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const extractEntities = (
  text: string,
  paragraphs: ClassifiedParagraph[],
  dialogues: DialogueLine[],
  chapterId: string
): EntityGraph => {
  // Extract raw entities
  const rawCharacters = extractCharactersFromText(text);
  const rawLocations = extractLocations(text);
  const rawObjects = extractObjects(text);
  
  // Add speakers from dialogue as high-confidence characters
  for (const dialogue of dialogues) {
    if (dialogue.speaker) {
      rawCharacters.push({
        name: dialogue.speaker,
        type: 'character',
        offset: dialogue.offset,
        context: dialogue.quote,
      });
    }
  }
  
  // Consolidate all entities
  const allRaw = [...rawCharacters, ...rawLocations, ...rawObjects];
  const nodes = consolidateEntities(allRaw, chapterId);
  
  // Detect aliases
  detectAliases(text, nodes);
  
  // Resolve pronouns to entities (adds to mention counts)
  const coReferences = resolvePronounsInText(text, nodes, chapterId);
  
  // Detect relationships
  const edges = detectRelationships(text, nodes, paragraphs, chapterId);
  
  return {
    nodes,
    edges,
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MERGE FUNCTION (for combining across chapters)
// ─────────────────────────────────────────────────────────────────────────────

export const mergeEntityGraphs = (graphs: EntityGraph[]): EntityGraph => {
  const nodeMap = new Map<string, EntityNode>();
  const edgeMap = new Map<string, EntityEdge>();
  
  for (const graph of graphs) {
    // Merge nodes
    for (const node of graph.nodes) {
      const key = node.name.toLowerCase();
      if (nodeMap.has(key)) {
        const existing = nodeMap.get(key)!;
        existing.mentionCount += node.mentionCount;
        existing.mentions.push(...node.mentions);
        existing.aliases = [...new Set([...existing.aliases, ...node.aliases])];
        // Keep earliest first mention
        if (node.firstMention < existing.firstMention) {
          existing.firstMention = node.firstMention;
        }
      } else {
        nodeMap.set(key, { ...node });
      }
    }
    
    // Merge edges
    for (const edge of graph.edges) {
      const key = [edge.source, edge.target].sort().join('-');
      if (edgeMap.has(key)) {
        const existing = edgeMap.get(key)!;
        existing.coOccurrences += edge.coOccurrences;
        existing.chapters = [...new Set([...existing.chapters, ...edge.chapters])];
        existing.evidence = [...existing.evidence, ...edge.evidence].slice(0, 10);
        // Upgrade relationship type if new one is more specific
        if (existing.type === 'interacts' && edge.type !== 'interacts') {
          existing.type = edge.type;
        }
      } else {
        edgeMap.set(key, { ...edge });
      }
    }
  }
  
  return {
    nodes: Array.from(nodeMap.values()).sort((a, b) => b.mentionCount - a.mentionCount),
    edges: Array.from(edgeMap.values()).sort((a, b) => b.coOccurrences - a.coOccurrences),
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getEntitiesInRange = (
  graph: EntityGraph,
  startOffset: number,
  endOffset: number
): EntityNode[] => {
  return graph.nodes.filter(node =>
    node.mentions.some(m => m.offset >= startOffset && m.offset < endOffset)
  );
};

export const getRelatedEntities = (
  graph: EntityGraph,
  entityId: string
): Array<{ entity: EntityNode; relationship: EntityEdge }> => {
  const results: Array<{ entity: EntityNode; relationship: EntityEdge }> = [];
  
  for (const edge of graph.edges) {
    if (edge.source === entityId || edge.target === entityId) {
      const otherId = edge.source === entityId ? edge.target : edge.source;
      const other = graph.nodes.find(n => n.id === otherId);
      if (other) {
        results.push({ entity: other, relationship: edge });
      }
    }
  }
  
  return results.sort((a, b) => b.relationship.coOccurrences - a.relationship.coOccurrences);
};
