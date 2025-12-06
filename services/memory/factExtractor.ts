/**
 * Fact Extractor (Enhancement 4A)
 * 
 * Pattern-based fact extraction from intelligence layer results.
 * Converts entity attributes and relationships into structured facts
 * that can be stored as memories.
 */

import { 
  ManuscriptIntelligence,
  EntityGraph,
  EntityNode,
  EntityEdge,
  Timeline,
  PlotPromise,
} from '@/types/intelligence';
import { CreateMemoryNoteInput, MemoryNoteType } from './types';
import { createMemory, getMemories } from './index';
import { isSemanticDuplicate } from './semanticDedup';

// Relationship predicate language map shared across relationship extraction
const RELATIONSHIP_PREDICATE_MAP: Record<string, string> = {
  'interacts': 'interacts with',
  'located_at': 'is located at',
  'possesses': 'possesses',
  'related_to': 'is related to',
  'opposes': 'opposes',
  'allied_with': 'is allied with',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceOffset: number;
  sourceType: 'entity' | 'relationship' | 'timeline' | 'style';
  evidence?: string;
}

export interface FactExtractionResult {
  facts: ExtractedFact[];
  memoriesCreated: number;
  memoriesSkipped: number;
  errors: string[];
}

export interface FactExtractionOptions {
  projectId: string;
  minConfidence?: number;
  maxFacts?: number;
  skipDuplicates?: boolean;
  createMemories?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACT EXTRACTION FROM ENTITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract facts from entity attributes
 */
const extractEntityAttributeFacts = (
  entities: EntityGraph
): ExtractedFact[] => {
  const facts: ExtractedFact[] = [];
  
  for (const entity of entities.nodes) {
    if (entity.type !== 'character') continue;
    
    // Extract from attributes map
    for (const [attribute, values] of Object.entries(entity.attributes)) {
      if (values.length === 0) continue;
      
      // Use first value as canonical
      const value = values[0];
      
      facts.push({
        subject: entity.name,
        predicate: `has ${attribute}`,
        object: value,
        confidence: 0.7,
        sourceOffset: entity.firstMention,
        sourceType: 'entity',
        evidence: `Extracted from entity attributes`,
      });
    }
    
    // Extract from aliases (nicknames, titles)
    if (entity.aliases.length > 0) {
      for (const alias of entity.aliases.slice(0, 3)) {
        facts.push({
          subject: entity.name,
          predicate: 'is also known as',
          object: alias,
          confidence: 0.8,
          sourceOffset: entity.firstMention,
          sourceType: 'entity',
        });
      }
    }
  }
  
  return facts;
};

/**
 * Extract facts from entity relationships
 */
const extractRelationshipFacts = (
  entities: EntityGraph
): ExtractedFact[] => {
  const facts: ExtractedFact[] = [];
  const nodeById = new Map(entities.nodes.map(node => [node.id, node]));
  
  for (const edge of entities.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    
    if (!source || !target) continue;
    
    // Convert relationship type to natural language
    const predicate = RELATIONSHIP_PREDICATE_MAP[edge.type] || edge.type;
    const evidenceSnippet = edge.evidence?.length
      ? edge.evidence.slice(0, 3).join('; ')
      : undefined;
    
    facts.push({
      subject: source.name,
      predicate,
      object: target.name,
      confidence: Math.min(0.9, 0.5 + (edge.coOccurrences * 0.1)),
      sourceOffset: source.firstMention,
      sourceType: 'relationship',
      evidence: evidenceSnippet,
    });
    
    // Add sentiment-based relationship inference
    if (edge.sentiment > 0.3) {
      facts.push({
        subject: source.name,
        predicate: 'has positive relationship with',
        object: target.name,
        confidence: edge.sentiment,
        sourceOffset: source.firstMention,
        sourceType: 'relationship',
      });
    } else if (edge.sentiment < -0.3) {
      facts.push({
        subject: source.name,
        predicate: 'has conflict with',
        object: target.name,
        confidence: Math.abs(edge.sentiment),
        sourceOffset: source.firstMention,
        sourceType: 'relationship',
      });
    }
  }
  
  return facts;
};

// ─────────────────────────────────────────────────────────────────────────────
// FACT EXTRACTION FROM TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract facts from timeline events
 */
const extractTimelineFacts = (
  timeline: Timeline
): ExtractedFact[] => {
  const facts: ExtractedFact[] = [];
  
  // Extract from events
  for (const event of timeline.events.slice(0, 20)) {
    if (event.temporalMarker) {
      facts.push({
        subject: event.description.slice(0, 50),
        predicate: 'occurs',
        object: event.temporalMarker,
        confidence: 0.7,
        sourceOffset: event.offset,
        sourceType: 'timeline',
      });
    }
  }
  
  // Extract from causal chains
  for (const chain of timeline.causalChains.slice(0, 10)) {
    facts.push({
      subject: chain.cause.quote.slice(0, 50),
      predicate: 'causes',
      object: chain.effect.quote.slice(0, 50),
      confidence: chain.confidence,
      sourceOffset: chain.cause.offset,
      sourceType: 'timeline',
      evidence: `Marker: "${chain.marker}"`,
    });
  }
  
  // Extract from plot promises
  for (const promise of timeline.promises) {
    facts.push({
      subject: promise.type,
      predicate: promise.resolved ? 'was resolved' : 'remains unresolved',
      object: promise.description,
      confidence: 0.8,
      sourceOffset: promise.offset,
      sourceType: 'timeline',
    });
  }
  
  return facts;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACTION API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all facts from intelligence results
 */
export const extractFacts = (
  intelligence: ManuscriptIntelligence
): ExtractedFact[] => {
  const facts: ExtractedFact[] = [];
  
  // Entity attributes
  facts.push(...extractEntityAttributeFacts(intelligence.entities));
  
  // Relationships
  facts.push(...extractRelationshipFacts(intelligence.entities));
  
  // Timeline
  facts.push(...extractTimelineFacts(intelligence.timeline));
  
  // Sort by confidence
  return facts.sort((a, b) => b.confidence - a.confidence);
};

/**
 * Extract facts and optionally create memories
 */
export const extractFactsToMemories = async (
  intelligence: ManuscriptIntelligence,
  options: FactExtractionOptions
): Promise<FactExtractionResult> => {
  const {
    projectId,
    minConfidence = 0.6,
    maxFacts = 50,
    skipDuplicates = true,
    createMemories: shouldCreate = true,
  } = options;
  
  const result: FactExtractionResult = {
    facts: [],
    memoriesCreated: 0,
    memoriesSkipped: 0,
    errors: [],
  };
  
  // Extract all facts
  const allFacts = extractFacts(intelligence);
  
  // Filter by confidence and limit
  const filteredFacts = allFacts
    .filter(f => f.confidence >= minConfidence)
    .slice(0, maxFacts);
  
  result.facts = filteredFacts;
  
  if (!shouldCreate) {
    return result;
  }
  
  // Create memories for each fact
  for (const fact of filteredFacts) {
    try {
      const factText = formatFactAsText(fact);
      const tags = generateFactTags(fact);
      
      // Check for duplicates
      if (skipDuplicates) {
        const dupCheck = await isSemanticDuplicate(projectId, factText, tags);
        if (dupCheck.isDuplicate) {
          result.memoriesSkipped++;
          continue;
        }
      }
      
      // Create memory
      await createMemory({
        text: factText,
        type: mapFactToMemoryType(fact),
        scope: 'project',
        projectId,
        topicTags: tags,
        importance: fact.confidence,
      });
      
      result.memoriesCreated++;
    } catch (error) {
      result.errors.push(`Failed to create memory for fact: ${error}`);
    }
  }
  
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a fact as natural language text
 */
const formatFactAsText = (fact: ExtractedFact): string => {
  return `${fact.subject} ${fact.predicate} ${fact.object}`;
};

/**
 * Generate tags for a fact
 */
const generateFactTags = (fact: ExtractedFact): string[] => {
  const tags: string[] = [`source:${fact.sourceType}`];
  
  // Add subject as character tag if it looks like a name
  if (/^[A-Z][a-z]+$/.test(fact.subject)) {
    tags.push(`character:${fact.subject.toLowerCase()}`);
  }
  
  // Add object as character tag if it looks like a name
  if (/^[A-Z][a-z]+$/.test(fact.object)) {
    tags.push(`character:${fact.object.toLowerCase()}`);
  }
  
  // Add predicate-based tags
  if (fact.predicate.includes('relationship') || fact.predicate.includes('with')) {
    tags.push('relationship');
  }
  
  if (fact.predicate.includes('conflict') || fact.predicate.includes('opposes')) {
    tags.push('conflict');
  }
  
  if (fact.sourceType === 'timeline') {
    tags.push('timeline');
  }
  
  return tags;
};

/**
 * Map fact source type to memory type
 */
const mapFactToMemoryType = (fact: ExtractedFact): MemoryNoteType => {
  switch (fact.sourceType) {
    case 'entity':
      return 'fact';
    case 'relationship':
      return 'observation';
    case 'timeline':
      return 'fact';
    default:
      return 'observation';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INCREMENTAL EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract only new facts by comparing with existing memories
 */
export const extractNewFacts = async (
  intelligence: ManuscriptIntelligence,
  projectId: string
): Promise<ExtractedFact[]> => {
  const allFacts = extractFacts(intelligence);
  const existingMemories = await getMemories({
    scope: 'project',
    projectId,
    type: 'fact',
    limit: 200,
  });
  
  const existingTexts = new Set(
    existingMemories.map(m => m.text.toLowerCase())
  );
  
  return allFacts.filter(fact => {
    const factText = formatFactAsText(fact).toLowerCase();
    return !existingTexts.has(factText);
  });
};

/**
 * Find facts that contradict existing memories
 */
export const findContradictingFacts = async (
  intelligence: ManuscriptIntelligence,
  projectId: string
): Promise<Array<{ newFact: ExtractedFact; existingMemory: string }>> => {
  const newFacts = extractFacts(intelligence);
  const existingMemories = await getMemories({
    scope: 'project',
    projectId,
    limit: 200,
  });
  
  const contradictions: Array<{ newFact: ExtractedFact; existingMemory: string }> = [];
  
  for (const fact of newFacts) {
    // Look for memories about the same subject
    const subjectMemories = existingMemories.filter(m => 
      m.text.toLowerCase().includes(fact.subject.toLowerCase())
    );
    
    for (const memory of subjectMemories) {
      // Check if same predicate with different object
      if (memory.text.toLowerCase().includes(fact.predicate.toLowerCase())) {
        if (!memory.text.toLowerCase().includes(fact.object.toLowerCase())) {
          contradictions.push({
            newFact: fact,
            existingMemory: memory.text,
          });
        }
      }
    }
  }
  
  return contradictions;
};
