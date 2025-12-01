/**
 * Contradiction Detector
 * 
 * Detects inconsistencies in entity attributes and timeline events:
 * - Character attribute contradictions (eye color, age, etc.)
 * - Timeline violations (character dies then speaks later)
 * - Location contradictions (character in two places at once)
 * - Relationship contradictions (ally then enemy without explanation)
 */

import {
  EntityGraph,
  EntityNode,
  Timeline,
  TimelineEvent,
} from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ContradictionType = 
  | 'attribute'      // Physical traits, names, ages
  | 'timeline'       // Events out of order, dead characters acting
  | 'location'       // Character in two places at once
  | 'relationship'   // Relationship status inconsistency
  | 'existence';     // Character exists/doesn't exist

export interface ContradictionEvidence {
  text: string;
  offset: number;
  value: string;
  chapterId?: string;
}

export interface Contradiction {
  id: string;
  type: ContradictionType;
  entityId: string;
  entityName: string;
  claim1: ContradictionEvidence;
  claim2: ContradictionEvidence;
  severity: number;  // 0 to 1
  suggestion: string;
  // Enhancement 1B: Confidence scoring
  confidence: number; // 0 to 1 - how certain we are this is a real contradiction
  evidence: ContradictionEvidence[]; // All supporting evidence
  suggestedResolution?: string; // AI-friendly resolution hint
  category?: string; // Specific category (e.g., 'eye_color', 'timeline_death')
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

interface AttributePattern {
  category: string;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
}

const ATTRIBUTE_PATTERNS: AttributePattern[] = [
  // Eye color
  {
    category: 'eye_color',
    pattern: /(\w+)'s?\s+(\w+)\s+eyes|eyes\s+(?:were|are)\s+(\w+)/gi,
    extractor: (m) => m[2] || m[3],
  },
  // Hair color
  {
    category: 'hair_color',
    pattern: /(\w+)'s?\s+(\w+)\s+hair|hair\s+(?:was|is)\s+(\w+)/gi,
    extractor: (m) => m[2] || m[3],
  },
  // Age
  {
    category: 'age',
    pattern: /(\w+)\s+(?:was|is)\s+(\d+)\s+years?\s+old|(\d+)-year-old\s+(\w+)/gi,
    extractor: (m) => m[2] || m[3],
  },
  // Height descriptors
  {
    category: 'height',
    pattern: /(\w+)\s+(?:was|is)\s+(tall|short|average\s+height)/gi,
    extractor: (m) => m[2],
  },
  // Build/body type
  {
    category: 'build',
    pattern: /(\w+)'s?\s+(slender|muscular|heavyset|thin|stocky|athletic)\s+(?:build|frame|body)/gi,
    extractor: (m) => m[2],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedAttribute {
  entityName: string;
  category: string;
  value: string;
  offset: number;
  context: string;
}

const extractAttributes = (text: string): ExtractedAttribute[] => {
  const attributes: ExtractedAttribute[] = [];
  
  for (const { category, pattern, extractor } of ATTRIBUTE_PATTERNS) {
    let match;
    const patternCopy = new RegExp(pattern.source, pattern.flags);
    
    while ((match = patternCopy.exec(text)) !== null) {
      const entityName = match[1] || match[4];
      const value = extractor(match);
      
      if (entityName && value) {
        attributes.push({
          entityName: entityName.trim(),
          category,
          value: value.toLowerCase(),
          offset: match.index,
          context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        });
      }
    }
  }
  
  return attributes;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTRADICTION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const generateId = (): string => Math.random().toString(36).substring(2, 11);

// Check if two values are compatible (same or related)
const areValuesCompatible = (category: string, val1: string, val2: string): boolean => {
  // Same value is always compatible
  if (val1 === val2) return true;
  
  // Age: allow small differences (could be passage of time)
  if (category === 'age') {
    const age1 = parseInt(val1);
    const age2 = parseInt(val2);
    if (!isNaN(age1) && !isNaN(age2)) {
      return Math.abs(age1 - age2) <= 2; // Allow 2 year difference
    }
  }
  
  // Color variations that might be compatible
  const colorVariations: Record<string, string[]> = {
    'blue': ['light blue', 'dark blue', 'sky blue', 'azure'],
    'green': ['light green', 'dark green', 'emerald', 'jade'],
    'brown': ['dark brown', 'light brown', 'chestnut', 'chocolate'],
    'black': ['jet black', 'raven'],
    'red': ['auburn', 'copper', 'crimson'],
    'blonde': ['golden', 'fair', 'light'],
  };
  
  for (const [base, variations] of Object.entries(colorVariations)) {
    if ((val1 === base || variations.includes(val1)) && 
        (val2 === base || variations.includes(val2))) {
      return true;
    }
  }
  
  return false;
};

const detectAttributeContradictions = (
  text: string,
  entities: EntityGraph
): Contradiction[] => {
  const contradictions: Contradiction[] = [];
  const attributes = extractAttributes(text);
  
  // Group attributes by entity and category
  const entityAttrs = new Map<string, Map<string, ExtractedAttribute[]>>();
  
  for (const attr of attributes) {
    const key = attr.entityName.toLowerCase();
    
    if (!entityAttrs.has(key)) {
      entityAttrs.set(key, new Map());
    }
    
    const categoryMap = entityAttrs.get(key)!;
    if (!categoryMap.has(attr.category)) {
      categoryMap.set(attr.category, []);
    }
    
    categoryMap.get(attr.category)!.push(attr);
  }
  
  // Check for contradictions within each entity
  for (const [entityName, categories] of entityAttrs) {
    const entity = entities.nodes.find(e => e.name.toLowerCase() === entityName);
    
    for (const [category, attrs] of categories) {
      if (attrs.length < 2) continue;
      
      // Compare all pairs
      for (let i = 0; i < attrs.length; i++) {
        for (let j = i + 1; j < attrs.length; j++) {
          const attr1 = attrs[i];
          const attr2 = attrs[j];
          
          if (!areValuesCompatible(category, attr1.value, attr2.value)) {
            // Calculate confidence based on multiple factors
            const confidence = calculateAttributeConfidence(category, attr1, attr2, entity);
            
            contradictions.push({
              id: generateId(),
              type: 'attribute',
              entityId: entity?.id || '',
              entityName: attr1.entityName,
              claim1: {
                text: attr1.context,
                offset: attr1.offset,
                value: attr1.value,
              },
              claim2: {
                text: attr2.context,
                offset: attr2.offset,
                value: attr2.value,
              },
              severity: 0.8,
              suggestion: `${attr1.entityName}'s ${category.replace('_', ' ')} is described as both "${attr1.value}" and "${attr2.value}". Consider making these consistent.`,
              confidence,
              evidence: [
                { text: attr1.context, offset: attr1.offset, value: attr1.value },
                { text: attr2.context, offset: attr2.offset, value: attr2.value },
              ],
              suggestedResolution: generateResolutionHint('attribute', category, attr1.value, attr2.value),
              category,
            });
          }
        }
      }
    }
  }
  
  return contradictions;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE CONTRADICTION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const DEATH_PATTERNS = [
  /(\w+)\s+(?:died|was\s+killed|passed\s+away|perished)/gi,
  /(?:killed|murdered|slew)\s+(\w+)/gi,
  /(\w+)'s\s+(?:death|demise|passing)/gi,
];

const detectTimelineContradictions = (
  text: string,
  entities: EntityGraph,
  timeline: Timeline
): Contradiction[] => {
  const contradictions: Contradiction[] = [];
  
  // Track deaths
  const deathEvents = new Map<string, { offset: number; context: string }>();
  
  for (const pattern of DEATH_PATTERNS) {
    let match;
    const patternCopy = new RegExp(pattern.source, pattern.flags);
    
    while ((match = patternCopy.exec(text)) !== null) {
      const name = (match[1] || match[2]).toLowerCase();
      
      if (!deathEvents.has(name)) {
        deathEvents.set(name, {
          offset: match.index,
          context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        });
      }
    }
  }
  
  // Check if dead characters act later
  for (const [name, death] of deathEvents) {
    const entity = entities.nodes.find(e => e.name.toLowerCase() === name);
    if (!entity) continue;
    
    // Look for mentions after death
    const postDeathMentions = entity.mentions.filter(m => m.offset > death.offset);
    
    for (const mention of postDeathMentions) {
      // Check if this is an action (speaking, moving, etc.)
      const mentionContext = text.slice(mention.offset, mention.offset + 100);
      const actionPatterns = /(?:said|asked|walked|ran|looked|smiled|nodded|shook)/i;
      
      if (actionPatterns.test(mentionContext)) {
        // Calculate confidence based on distance and action type
        const distance = mention.offset - death.offset;
        const confidence = calculateTimelineConfidence(distance, mentionContext);
        
        contradictions.push({
          id: generateId(),
          type: 'timeline',
          entityId: entity.id,
          entityName: entity.name,
          claim1: {
            text: death.context,
            offset: death.offset,
            value: 'death',
          },
          claim2: {
            text: mentionContext.slice(0, 50),
            offset: mention.offset,
            value: 'action after death',
          },
          severity: 0.95,
          suggestion: `${entity.name} appears to take action after their death. Either the death scene or subsequent action needs revision.`,
          confidence,
          evidence: [
            { text: death.context, offset: death.offset, value: 'death' },
            { text: mentionContext.slice(0, 80), offset: mention.offset, value: 'post-death action' },
          ],
          suggestedResolution: 'Consider: (1) removing the death scene, (2) revising the post-death action as a flashback/memory, or (3) making the death less definitive.',
          category: 'timeline_death',
        });
        
        break; // One contradiction per dead character is enough
      }
    }
  }
  
  return contradictions;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const detectContradictions = (
  text: string,
  entities: EntityGraph,
  timeline: Timeline
): Contradiction[] => {
  const contradictions: Contradiction[] = [];
  
  // Detect attribute contradictions
  contradictions.push(...detectAttributeContradictions(text, entities));
  
  // Detect timeline contradictions
  contradictions.push(...detectTimelineContradictions(text, entities, timeline));
  
  // Sort by severity
  return contradictions.sort((a, b) => b.severity - a.severity);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getContradictionsForEntity = (
  contradictions: Contradiction[],
  entityId: string
): Contradiction[] => {
  return contradictions.filter(c => c.entityId === entityId);
};

export const getHighSeverityContradictions = (
  contradictions: Contradiction[],
  threshold: number = 0.7
): Contradiction[] => {
  return contradictions.filter(c => c.severity >= threshold);
};

export const getHighConfidenceContradictions = (
  contradictions: Contradiction[],
  threshold: number = 0.7
): Contradiction[] => {
  return contradictions.filter(c => c.confidence >= threshold);
};

export const groupContradictionsByType = (
  contradictions: Contradiction[]
): Map<ContradictionType, Contradiction[]> => {
  const grouped = new Map<ContradictionType, Contradiction[]>();
  
  for (const c of contradictions) {
    if (!grouped.has(c.type)) {
      grouped.set(c.type, []);
    }
    grouped.get(c.type)!.push(c);
  }
  
  return grouped;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE CALCULATION (Enhancement 1B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate confidence for attribute contradictions
 * Higher confidence = more certain this is a real contradiction
 */
const calculateAttributeConfidence = (
  category: string,
  attr1: ExtractedAttribute,
  attr2: ExtractedAttribute,
  entity: EntityNode | undefined
): number => {
  let confidence = 0.7; // Base confidence
  
  // Boost if entity is well-established (many mentions)
  if (entity && entity.mentionCount > 5) {
    confidence += 0.1;
  }
  
  // Boost for immutable attributes (eye color, height are harder to change)
  const immutableCategories = ['eye_color', 'height', 'build'];
  if (immutableCategories.includes(category)) {
    confidence += 0.1;
  }
  
  // Reduce confidence if values are very different (might be intentional)
  // e.g., "young" vs "old" could be time passage
  if (category === 'age') {
    const age1 = parseInt(attr1.value);
    const age2 = parseInt(attr2.value);
    if (!isNaN(age1) && !isNaN(age2) && Math.abs(age1 - age2) > 10) {
      confidence -= 0.2; // Large age gap might be intentional
    }
  }
  
  // Reduce if attributes are far apart in text (might be intentional change)
  const distance = Math.abs(attr2.offset - attr1.offset);
  if (distance > 10000) {
    confidence -= 0.1; // Far apart = possibly intentional
  }
  
  return Math.max(0.3, Math.min(1.0, confidence));
};

/**
 * Calculate confidence for timeline contradictions
 */
const calculateTimelineConfidence = (
  distance: number,
  mentionContext: string
): number => {
  let confidence = 0.85; // Base confidence for death contradictions
  
  // Higher confidence if action is clearly physical
  const strongActionPatterns = /\b(walked|ran|grabbed|punched|kissed|hugged|stood|sat)\b/i;
  if (strongActionPatterns.test(mentionContext)) {
    confidence += 0.1;
  }
  
  // Lower confidence for dialogue (could be flashback/memory)
  const dialoguePatterns = /\b(said|asked|replied|whispered|shouted)\b/i;
  if (dialoguePatterns.test(mentionContext)) {
    confidence -= 0.15;
  }
  
  // Lower confidence for thought/memory patterns
  const memoryPatterns = /\b(remembered|recalled|thought of|dreamed)\b/i;
  if (memoryPatterns.test(mentionContext)) {
    confidence -= 0.3;
  }
  
  // Higher confidence if close to death scene
  if (distance < 2000) {
    confidence += 0.05;
  }
  
  return Math.max(0.3, Math.min(1.0, confidence));
};

/**
 * Generate AI-friendly resolution hints
 */
const generateResolutionHint = (
  type: ContradictionType,
  category: string,
  value1: string,
  value2: string
): string => {
  if (type === 'attribute') {
    switch (category) {
      case 'eye_color':
      case 'hair_color':
        return `Choose one color and use find-replace to update all instances. Consider: "${value1}" appears first.`;
      case 'age':
        return `If intentional time passage, add temporal markers. Otherwise, standardize to the first mentioned age.`;
      case 'height':
      case 'build':
        return `Physical descriptions should be consistent unless transformation is plot-relevant.`;
      default:
        return `Standardize to the first value ("${value1}") or add explanation for the change.`;
    }
  }
  
  return 'Review both passages and decide which version to keep or how to reconcile them.';
};

// ─────────────────────────────────────────────────────────────────────────────
// LORE-AWARE CONTRADICTION DETECTION (Enhancement 4B)
// ─────────────────────────────────────────────────────────────────────────────

import type { MemoryNote } from '../memory/types';

/**
 * Parse a lore memory note into a structured fact
 */
export interface LoreFact {
  subject: string;
  predicate: string;
  object: string;
  source: 'lore' | 'manuscript';
  memoryId?: string;
}

const parseLoreFact = (memory: MemoryNote): LoreFact | null => {
  // Pattern: "Character has attribute value"
  const hasPattern = /^(\w+)(?:'s)?\s+(?:has\s+)?(\w+(?:\s+\w+)?):\s*(.+)$/i;
  const match = memory.text.match(hasPattern);
  
  if (match) {
    return {
      subject: match[1].toLowerCase(),
      predicate: match[2].toLowerCase(),
      object: match[3].toLowerCase(),
      source: 'lore',
      memoryId: memory.id,
    };
  }
  
  // Pattern: "Subject predicate Object"
  const simplePattern = /^(\w+)\s+(is|has|was)\s+(.+)$/i;
  const simpleMatch = memory.text.match(simplePattern);
  
  if (simpleMatch) {
    return {
      subject: simpleMatch[1].toLowerCase(),
      predicate: simpleMatch[2].toLowerCase(),
      object: simpleMatch[3].toLowerCase(),
      source: 'lore',
      memoryId: memory.id,
    };
  }
  
  return null;
};

/**
 * Detect contradictions with lore memory injection
 * Compares manuscript text against stored lore facts
 */
export const detectContradictionsWithLore = (
  text: string,
  entities: EntityGraph,
  timeline: Timeline,
  loreMemories: MemoryNote[]
): Contradiction[] => {
  // Get base contradictions
  const contradictions = detectContradictions(text, entities, timeline);
  
  // Parse lore facts
  const loreFacts = loreMemories
    .filter(m => m.type === 'fact' || m.topicTags.includes('lore'))
    .map(parseLoreFact)
    .filter((f): f is LoreFact => f !== null);
  
  // Extract manuscript attributes
  const manuscriptAttrs = extractAttributes(text);
  
  // Compare manuscript against lore
  for (const loreFact of loreFacts) {
    // Find matching manuscript attributes
    const matchingAttrs = manuscriptAttrs.filter(attr =>
      attr.entityName.toLowerCase() === loreFact.subject &&
      attr.category.includes(loreFact.predicate.replace(/\s+/g, '_'))
    );
    
    for (const attr of matchingAttrs) {
      if (!areValuesCompatible(attr.category, attr.value, loreFact.object)) {
        contradictions.push({
          id: generateId(),
          type: 'attribute',
          entityId: entities.nodes.find(e => 
            e.name.toLowerCase() === loreFact.subject
          )?.id || '',
          entityName: attr.entityName,
          claim1: {
            text: `[Lore Bible] ${attr.entityName} ${loreFact.predicate}: ${loreFact.object}`,
            offset: -1, // Lore has no offset
            value: loreFact.object,
          },
          claim2: {
            text: attr.context,
            offset: attr.offset,
            value: attr.value,
          },
          severity: 0.9, // High severity for lore violations
          suggestion: `Manuscript contradicts Lore Bible: ${attr.entityName}'s ${attr.category.replace('_', ' ')} is "${loreFact.object}" in lore but "${attr.value}" in text.`,
          confidence: 0.95, // High confidence for explicit lore
          evidence: [
            { text: `Lore: ${loreFact.object}`, offset: -1, value: loreFact.object },
            { text: attr.context, offset: attr.offset, value: attr.value },
          ],
          suggestedResolution: `Update manuscript to match lore ("${loreFact.object}") or update lore if the change is intentional.`,
          category: `lore_${attr.category}`,
        });
      }
    }
  }
  
  // Sort by severity and confidence
  return contradictions.sort((a, b) => {
    const scoreA = a.severity * 0.6 + a.confidence * 0.4;
    const scoreB = b.severity * 0.6 + b.confidence * 0.4;
    return scoreB - scoreA;
  });
};
