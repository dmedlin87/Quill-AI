/**
 * Timeline Tracker
 * 
 * Deterministic extraction of temporal information:
 * - Time markers and temporal adverbs
 * - Event ordering and relative positioning
 * - Causal chain detection via linguistic markers
 * - Plot promise tracking (setup → payoff)
 */

import {
  Scene,
  TimelineEvent,
  CausalChain,
  PlotPromise,
  Timeline,
  TemporalRelation,
} from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

const TEMPORAL_MARKERS: Array<{ pattern: RegExp; relation: TemporalRelation }> = [
  // "After" patterns → current event is AFTER previous
  { pattern: /\b(after|afterwards|following|subsequently|later|then)\b/gi, relation: 'after' },
  
  // "Before" patterns → current event is BEFORE what follows
  { pattern: /\b(before|previously|earlier|prior to|formerly)\b/gi, relation: 'before' },
  
  // "Meanwhile" patterns → concurrent
  { pattern: /\b(meanwhile|simultaneously|at the same time|while|during|as)\b/gi, relation: 'concurrent' },
  
  // Specific time references
  { pattern: /\b(the next (day|morning|week|month|year))\b/gi, relation: 'after' },
  { pattern: /\b(the previous (day|night|week|month|year))\b/gi, relation: 'before' },
  { pattern: /\b(\d+\s*(hours?|days?|weeks?|months?|years?)\s*later)\b/gi, relation: 'after' },
  { pattern: /\b(\d+\s*(hours?|days?|weeks?|months?|years?)\s*(earlier|before|ago))\b/gi, relation: 'before' },
];

// Time-of-day markers
const TIME_OF_DAY_PATTERNS = [
  /\b(at\s+)?(dawn|sunrise|daybreak|first light)\b/gi,
  /\b(in the\s+)?(morning|forenoon)\b/gi,
  /\b(at\s+)?(noon|midday|high noon)\b/gi,
  /\b(in the\s+)?(afternoon)\b/gi,
  /\b(at\s+)?(dusk|sunset|twilight|evening)\b/gi,
  /\b(at\s+)?(night|nightfall|midnight)\b/gi,
];

// ─────────────────────────────────────────────────────────────────────────────
// CAUSAL PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

const CAUSAL_MARKERS: Array<{ pattern: RegExp; confidence: number }> = [
  // Strong causal indicators
  { pattern: /\bbecause\s+(.{10,100})\b/gi, confidence: 0.9 },
  { pattern: /\btherefore\s+(.{10,100})\b/gi, confidence: 0.9 },
  { pattern: /\bas a result\s+(.{10,100})\b/gi, confidence: 0.9 },
  { pattern: /\bconsequently\s+(.{10,100})\b/gi, confidence: 0.9 },
  
  // Medium causal indicators
  { pattern: /\bso\s+(.{10,80})\b/gi, confidence: 0.7 },
  { pattern: /\bthus\s+(.{10,80})\b/gi, confidence: 0.7 },
  { pattern: /\bhence\s+(.{10,80})\b/gi, confidence: 0.7 },
  { pattern: /\bsince\s+(.{10,100}),/gi, confidence: 0.6 },
  
  // Weaker causal indicators
  { pattern: /\bif\s+(.{10,80}),\s*then\s+(.{10,80})\b/gi, confidence: 0.5 },
  { pattern: /\bwhen\s+(.{10,80}),\s+(.{10,80})\b/gi, confidence: 0.4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// PLOT PROMISE PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

const PROMISE_PATTERNS: Array<{ pattern: RegExp; type: PlotPromise['type'] }> = [
  // Foreshadowing
  { pattern: /\b(little did \w+ know)\b/gi, type: 'foreshadowing' },
  { pattern: /\b(would (soon|later|eventually) (learn|discover|find out|realize))\b/gi, type: 'foreshadowing' },
  { pattern: /\b(if only \w+ (had known|knew))\b/gi, type: 'foreshadowing' },
  { pattern: /\b(this would (prove|turn out) to be)\b/gi, type: 'foreshadowing' },
  
  // Setup/Chekhov's gun
  { pattern: /\b(\w+ noticed (?:a|an|the) \w+)\b/gi, type: 'setup' },
  { pattern: /\b(there was something (?:odd|strange|peculiar|unusual) about)\b/gi, type: 'setup' },
  { pattern: /\b(\w+ made a mental note)\b/gi, type: 'setup' },
  { pattern: /\b(kept (?:a|the) \w+ hidden)\b/gi, type: 'setup' },
  
  // Questions/mysteries
  { pattern: /\b(what (?:had|could|would) \w+\?)/gi, type: 'question' },
  { pattern: /\b(who (?:was|had|could) \w+\?)/gi, type: 'question' },
  { pattern: /\b(why (?:had|did|would) \w+\?)/gi, type: 'question' },
  { pattern: /\b(the mystery of)\b/gi, type: 'question' },
  { pattern: /\b(the mystery (?:remained|remains|still|persisted)(?:\s+\w+)*)\b/gi, type: 'question' },
  { pattern: /\b(remained a (?:mystery|secret|puzzle))\b/gi, type: 'question' },
  
  // Conflicts
  { pattern: /\b(\w+ (vowed|swore|promised) to)\b/gi, type: 'conflict' },
  { pattern: /\b(would not rest until)\b/gi, type: 'conflict' },
  { pattern: /\b(\w+ (must|had to) (find|stop|save|destroy))\b/gi, type: 'conflict' },
  
  // Goals
  { pattern: /\b(\w+ (needed|wanted|intended) to)\b/gi, type: 'goal' },
  { pattern: /\b(the only way to \w+ was)\b/gi, type: 'goal' },
  { pattern: /\b(\w+ set out to)\b/gi, type: 'goal' },
];

// Payoff/resolution patterns
const RESOLUTION_PATTERNS = [
  /\b(finally|at last|in the end)\b/gi,
  /\b(it (turned out|proved) that)\b/gi,
  /\b(the answer was|the truth was)\b/gi,
  /\b(now \w+ (understood|knew|realized))\b/gi,
  /\b(the mystery was solved)\b/gi,
  /\b(mission accomplished|goal achieved)\b/gi,
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

let idCounter = 0;
const generateId = (): string => {
  const crypto = (globalThis as any)?.crypto;
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback to deterministic, low-collision identifier
  idCounter += 1;
  return `tl_${Date.now().toString(36)}_${idCounter.toString(36)}`;
};
const clonePattern = (pattern: RegExp) => new RegExp(pattern.source, pattern.flags);
const truncate = (value: string, limit: number): string =>
  value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;

const getMatchedContent = (match: RegExpExecArray): string => {
  const captured = match.slice(1).filter(Boolean).join(' ').trim();
  return captured.length > 0 ? captured : match[0];
};

const extractSentence = (text: string, offset: number): string => {
  // Find sentence boundaries
  let start = offset;
  let end = offset;
  
  // Go backwards to find start
  while (start > 0 && !/[.!?]/.test(text[start - 1])) {
    start--;
  }
  
  // Go forwards to find end
  while (end < text.length && !/[.!?]/.test(text[end])) {
    end++;
  }
  
  return text.slice(start, end + 1).trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// EVENT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export const extractTimelineEvents = (
  text: string,
  scenes: Scene[],
  chapterId: string
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const temporalMarkers = TEMPORAL_MARKERS.map(({ pattern, relation }) => ({
    pattern: clonePattern(pattern),
    relation,
  }));
  
  // Extract events from temporal markers
  for (const { pattern, relation } of temporalMarkers) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sentence = extractSentence(text, match.index);
      
      events.push({
        id: generateId(),
        description: truncate(sentence, 150),
        offset: match.index,
        chapterId,
        temporalMarker: match[0],
        relativePosition: relation,
        dependsOn: [],
      });
    }
  }
  
  // Extract events from time-of-day markers
  for (const basePattern of TIME_OF_DAY_PATTERNS) {
    const pattern = clonePattern(basePattern);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sentence = extractSentence(text, match.index);
      
      // Avoid duplicates
      if (!events.find(e => Math.abs(e.offset - match!.index) < 20)) {
        events.push({
          id: generateId(),
          description: truncate(sentence, 150),
          offset: match.index,
          chapterId,
          temporalMarker: match[0],
          relativePosition: 'unknown',
          dependsOn: [],
        });
      }
    }
  }
  
  // Add scene transitions as events
  for (const scene of scenes) {
    if (scene.timeMarker) {
      const existingEvent = events.find(
        e => Math.abs(e.offset - scene.startOffset) < 50
      );
      
      if (!existingEvent) {
        events.push({
          id: generateId(),
          description: truncate(
            `Scene: ${scene.type} at ${scene.location || 'unknown location'}`,
            150
          ),
          offset: scene.startOffset,
          chapterId,
          temporalMarker: scene.timeMarker,
          relativePosition: 'after', // Scenes generally progress forward
          dependsOn: [],
        });
      }
    }
  }
  
  // Sort by offset
  events.sort((a, b) => a.offset - b.offset);
  
  // Link sequential events
  for (let i = 1; i < events.length; i++) {
    if (events[i].relativePosition === 'after') {
      events[i].dependsOn.push(events[i - 1].id);
    }
  }
  
  return events;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAUSAL CHAIN EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export const extractCausalChains = (
  text: string,
  events: TimelineEvent[]
): CausalChain[] => {
  const chains: CausalChain[] = [];
  
  for (const { pattern: basePattern, confidence } of CAUSAL_MARKERS) {
    const pattern = clonePattern(basePattern);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const offset = match.index;
      
      // Find cause (before the marker) and effect (the matched content)
      const causeSentenceEnd = offset;
      let causeSentenceStart = causeSentenceEnd - 1;
      while (causeSentenceStart > 0 && !/[.!?]/.test(text[causeSentenceStart - 1])) {
        causeSentenceStart--;
      }
      
      const causeQuote = text.slice(causeSentenceStart, causeSentenceEnd).trim();
      const effectQuote = getMatchedContent(match);
      
      // Find related events
      const causeEvent = events.find(e => 
        Math.abs(e.offset - causeSentenceStart) < 100
      );
      const effectEvent = events.find(e => 
        Math.abs(e.offset - offset) < 100
      );
      
      chains.push({
        id: generateId(),
        cause: {
          eventId: causeEvent?.id || '',
          quote: truncate(causeQuote, 100),
          offset: causeSentenceStart,
        },
        effect: {
          eventId: effectEvent?.id || '',
          quote: truncate(effectQuote, 100),
          offset: offset,
        },
        confidence,
        marker: match[0].split(/\s+/)[0], // First word of match
      });
    }
  }
  
  return chains;
};

// ─────────────────────────────────────────────────────────────────────────────
// PLOT PROMISE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export const extractPlotPromises = (
  text: string,
  chapterId: string
): PlotPromise[] => {
  const promises: PlotPromise[] = [];
  
  // Find promises/setups
  for (const { pattern: basePattern, type } of PROMISE_PATTERNS) {
    const pattern = clonePattern(basePattern);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sentence = extractSentence(text, match.index);
      
      promises.push({
        id: generateId(),
        type,
        description: truncate(sentence, 150),
        quote: getMatchedContent(match),
        offset: match.index,
        chapterId,
        resolved: false,
      });
    }
  }
  
  // Check for resolutions
  for (const basePattern of RESOLUTION_PATTERNS) {
    const pattern = clonePattern(basePattern);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Look for a promise that might be resolved here
      const nearbyPromise = promises.find(p => 
        p.offset < match!.index && 
        !p.resolved &&
        match!.index - p.offset < 10000 // Within ~10k characters
      );
      
      if (nearbyPromise) {
        nearbyPromise.resolved = true;
        nearbyPromise.resolutionOffset = match.index;
        nearbyPromise.resolutionChapterId = chapterId;
      }
    }
  }
  
  return promises;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const buildTimeline = (
  text: string,
  scenes: Scene[],
  chapterId: string
): Timeline => {
  const events = extractTimelineEvents(text, scenes, chapterId);
  const causalChains = extractCausalChains(text, events);
  const promises = extractPlotPromises(text, chapterId);
  
  return {
    events,
    causalChains,
    promises,
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MERGE FUNCTION (for combining across chapters)
// ─────────────────────────────────────────────────────────────────────────────

export const mergeTimelines = (timelines: Timeline[]): Timeline => {
  const allEvents: TimelineEvent[] = [];
  const allChains: CausalChain[] = [];
  const promiseMap = new Map<string, PlotPromise>();
  
  for (const timeline of timelines) {
    allEvents.push(...timeline.events);
    allChains.push(...timeline.causalChains);
    
    // Merge promises, updating resolution status
    for (const promise of timeline.promises) {
      if (promiseMap.has(promise.id)) {
        const existing = promiseMap.get(promise.id)!;
        if (promise.resolved && !existing.resolved) {
          existing.resolved = true;
          existing.resolutionOffset = promise.resolutionOffset;
          existing.resolutionChapterId = promise.resolutionChapterId;
        }
      } else {
        promiseMap.set(promise.id, { ...promise });
      }
    }
  }
  
  // Sort events by offset (cross-chapter ordering would need chapter order)
  allEvents.sort((a, b) => a.offset - b.offset);
  
  return {
    events: allEvents,
    causalChains: allChains,
    promises: Array.from(promiseMap.values()),
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getUnresolvedPromises = (timeline: Timeline): PlotPromise[] => {
  return timeline.promises.filter(p => !p.resolved);
};

export const getEventsInRange = (
  timeline: Timeline,
  startOffset: number,
  endOffset: number
): TimelineEvent[] => {
  return timeline.events.filter(
    e => e.offset >= startOffset && e.offset < endOffset
  );
};

export const getCausalChainsForEvent = (
  timeline: Timeline,
  eventId: string
): CausalChain[] => {
  return timeline.causalChains.filter(
    c => c.cause.eventId === eventId || c.effect.eventId === eventId
  );
};
