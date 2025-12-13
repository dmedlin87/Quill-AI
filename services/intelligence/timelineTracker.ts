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

// Direction:
// 'forward' means cause is in the capture group (after marker), effect is before marker.
// 'backward' means cause is before marker, effect is in the capture group (after marker).
const CAUSAL_MARKERS: Array<{ pattern: RegExp; confidence: number; direction: 'forward' | 'backward' }> = [
  // Strong causal indicators
  { pattern: /\bbecause[,;\s]+(.{10,100})\b/gi, confidence: 0.9, direction: 'forward' }, // Effect BECAUSE Cause
  { pattern: /\btherefore[,;\s]+(.{10,100})\b/gi, confidence: 0.9, direction: 'backward' }, // Cause THEREFORE Effect
  { pattern: /\bas a result[,;\s]+(.{10,100})\b/gi, confidence: 0.9, direction: 'backward' }, // Cause AS A RESULT Effect
  { pattern: /\bconsequently[,;\s]+(.{10,100})\b/gi, confidence: 0.9, direction: 'backward' }, // Cause CONSEQUENTLY Effect
  
  // Medium causal indicators
  { pattern: /\bso[,;\s]+(.{10,80})\b/gi, confidence: 0.7, direction: 'backward' }, // Cause SO Effect
  { pattern: /\bthus[,;\s]+(.{10,80})\b/gi, confidence: 0.7, direction: 'backward' }, // Cause THUS Effect
  { pattern: /\bhence[,;\s]+(.{10,80})\b/gi, confidence: 0.7, direction: 'backward' }, // Cause HENCE Effect
  { pattern: /\bsince[,;\s]+(.{10,100}),/gi, confidence: 0.6, direction: 'forward' }, // SINCE Cause, Effect (Note: this is complex, usually 'Since Cause, Effect'. If marker is 'Since', capture is Cause. Effect follows.)
  
  // Weaker causal indicators
  // Note: 'if' and 'when' patterns capture two groups which are joined by getMatchedContent.
  // The current extraction logic treats the capture as one entity and the previous sentence as another.
  // This works well for conjunctive adverbs (Therefore) and subordinating conjunctions (Because),
  // but matches like "If A then B" are structurally different and may require specialized parsing in the future.
  { pattern: /\bif\s+(.{10,80}),\s*then\s+(.{10,80})\b/gi, confidence: 0.5, direction: 'forward' },
  { pattern: /\bwhen\s+(.{10,80}),\s+(.{10,80})\b/gi, confidence: 0.4, direction: 'forward' },
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
  
  // Questions/mysteries (allow multiple words before question mark)
  { pattern: /\b(what (?:had|could|would)\s+.+?\?)/gi, type: 'question' },
  { pattern: /\b(who (?:was|had|could)\s+.+?\?)/gi, type: 'question' },
  { pattern: /\b(why (?:had|did|would)\s+.+?\?)/gi, type: 'question' },
  { pattern: /\b(the mystery of)\b/gi, type: 'question' },
  { pattern: /\b(the mystery (?:remained|remains|still|persisted)(?:\s+\w+)*)\b/gi, type: 'question' },
  { pattern: /\b(remained a (?:mystery|secret|puzzle))\b/gi, type: 'question' },
  
  // Conflicts (capture full phrase up to sentence end)
  { pattern: /\b(\w+ (?:vowed|swore|promised) to [^.!?]+)/gi, type: 'conflict' },
  { pattern: /\b(would not rest until [^.!?]+)/gi, type: 'conflict' },
  { pattern: /\b(\w+ (?:must|had to) (?:find|stop|save|destroy) [^.!?]+)/gi, type: 'conflict' },
  
  // Goals (capture full phrase up to sentence end)
  { pattern: /\b(\w+ (?:needed|wanted|intended) to [^.!?]+)/gi, type: 'goal' },
  { pattern: /\b(the only way to [^.!?]+ was [^.!?]+)/gi, type: 'goal' },
  { pattern: /\b(\w+ set out to [^.!?]+)/gi, type: 'goal' },
  
  // Generic question pattern for statements about questions
  { pattern: /\b(the (?:question|puzzle|riddle) (?:was|remained|persisted)[^.!?]*)/gi, type: 'question' },
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

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_PATTERN = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/gi;
const SEASON_PATTERN = /\b(spring|summer|fall|autumn|winter)\b/gi;

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

export interface TemporalMarker {
  marker: string;
  normalized: string;
  category: 'day' | 'time_of_day' | 'season';
  offset: number;
  sentence: string;
}

const normalizeDay = (match: string): string => {
  const lower = match.toLowerCase();
  const full = DAYS_OF_WEEK.find(day => day.startsWith(lower.slice(0, 3))) ?? lower;
  return full;
};

const normalizeTimeOfDay = (match: string): string => {
  const lower = match.toLowerCase();
  if (/(dawn|sunrise|first light)/i.test(match)) return 'dawn';
  if (/morning|forenoon/i.test(match)) return 'morning';
  if (/noon|midday|high noon/i.test(match)) return 'noon';
  if (/afternoon/i.test(match)) return 'afternoon';
  if (/dusk|sunset|twilight|evening/i.test(match)) return 'evening';
  if (/night|nightfall|midnight/i.test(match)) return 'night';
  return lower;
};

const normalizeSeason = (match: string): string => {
  const lower = match.toLowerCase();
  return lower === 'autumn' ? 'fall' : lower;
};

const pushMarker = (
  markers: TemporalMarker[],
  marker: string,
  normalized: string,
  category: TemporalMarker['category'],
  text: string,
  offset: number,
): void => {
  markers.push({
    marker,
    normalized,
    category,
    offset,
    sentence: extractSentence(text, offset),
  });
};

/**
 * Lightweight extraction of temporal markers for quick continuity checks.
 * Focuses on simple keywords (days of week, time-of-day, seasons)
 * to enable realtime conflict detection without heavy NLP.
 */
export const extractTemporalMarkers = (text: string): TemporalMarker[] => {
  const markers: TemporalMarker[] = [];

  // Days of the week
  let match: RegExpExecArray | null;
  const dayPattern = clonePattern(DAY_PATTERN);
  while ((match = dayPattern.exec(text)) !== null) {
    pushMarker(markers, match[0], normalizeDay(match[0]), 'day', text, match.index);
  }

  // Time-of-day markers
  for (const patternBase of TIME_OF_DAY_PATTERNS) {
    const pattern = clonePattern(patternBase);
    while ((match = pattern.exec(text)) !== null) {
      pushMarker(markers, match[0], normalizeTimeOfDay(match[0]), 'time_of_day', text, match.index);
    }
  }

  // Seasons
  const seasonPattern = clonePattern(SEASON_PATTERN);
  while ((match = seasonPattern.exec(text)) !== null) {
    pushMarker(markers, match[0], normalizeSeason(match[0]), 'season', text, match.index);
  }

  return markers;
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
      
      // Avoid duplicates within 30 characters (only compare against other time-of-day events)
      const existingTimeOfDay = events.filter(e => e.relativePosition === 'unknown');
      if (!existingTimeOfDay.find(e => Math.abs(e.offset - match!.index) < 30)) {
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
  
  for (const { pattern: basePattern, confidence, direction } of CAUSAL_MARKERS) {
    const pattern = clonePattern(basePattern);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const offset = match.index;
      
      // Find the sentence before the marker
      let beforeMarkerEnd = offset - 1;
      // Skip whitespace and punctuation between sentences
      while (beforeMarkerEnd > 0 && /[\s.!?,;]/.test(text[beforeMarkerEnd])) {
        beforeMarkerEnd--;
      }
      // Find the start of the previous sentence/clause
      let beforeMarkerStart = beforeMarkerEnd;
      while (beforeMarkerStart > 0 && !/[.!?]/.test(text[beforeMarkerStart - 1])) {
        beforeMarkerStart--;
      }
      
      const beforeMarkerQuote = text.slice(beforeMarkerStart, beforeMarkerEnd + 1).trim();
      const afterMarkerQuote = getMatchedContent(match);
      
      // Determine cause and effect based on direction
      const causeQuote = direction === 'forward' ? afterMarkerQuote : beforeMarkerQuote;
      const effectQuote = direction === 'forward' ? beforeMarkerQuote : afterMarkerQuote;

      const causeOffset = direction === 'forward' ? offset : beforeMarkerStart;
      const effectOffset = direction === 'forward' ? beforeMarkerStart : offset;

      // Find related events
      const causeEvent = events.find(e => 
        Math.abs(e.offset - causeOffset) < 100
      );
      const effectEvent = events.find(e => 
        Math.abs(e.offset - effectOffset) < 100
      );
      
      // Extract marker word without punctuation (preserve original case)
      const markerWord = match[0].split(/[\s,;]+/)[0].replace(/[,;]/g, '');
      
      chains.push({
        id: generateId(),
        cause: {
          eventId: causeEvent?.id || '',
          quote: truncate(causeQuote, 100),
          offset: causeOffset,
        },
        effect: {
          eventId: effectEvent?.id || '',
          quote: truncate(effectQuote, 100),
          offset: effectOffset,
        },
        confidence,
        marker: markerWord,
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
