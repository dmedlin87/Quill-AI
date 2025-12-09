/**
 * Proactive Thinker Service
 * 
 * Uses LLM to analyze recent changes and surface proactive suggestions
 * without user prompting. Subscribes to EventBus and thinks in the background.
 * 
 * This is the "always-on intelligence" that makes the agent feel aware
 * of what the user is doing and proactively helpful.
 */

import { ai } from '../gemini/client';
import { ModelConfig, ThinkingBudgets } from '../../config/models';
import { eventBus } from './eventBus';
import type { AppEvent, AppBrainState } from './types';
import { buildCompressedContext } from './contextBuilder';
import { formatConflictsForPrompt, getHighPriorityConflicts } from './intelligenceMemoryBridge';
import { evolveBedsideNote, getVoiceProfileForCharacter, upsertVoiceProfile } from '../memory';
import { extractFacts } from '../memory/factExtractor';
import { filterNovelLoreEntities } from '../memory/relevance';
import { getImportantReminders, type ProactiveSuggestion } from '../memory/proactive';
import { searchBedsideHistory, type BedsideHistoryMatch } from '../memory/bedsideHistorySearch';
import { extractTemporalMarkers, type TemporalMarker } from '../intelligence/timelineTracker';
import { generateVoiceProfile } from '../intelligence/voiceProfiler';
import type { DialogueLine, VoiceMetrics } from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ThinkingResult {
  /** Proactive suggestions from the LLM */
  suggestions: ProactiveSuggestion[];
  /** Raw thinking output (for debugging) */
  rawThinking?: string;
  /** Time taken to think */
  thinkingTime: number;
  /** Whether the LLM found anything significant */
  significant: boolean;
}

export interface ThinkerConfig {
  /** Minimum time between thinking sessions (ms) */
  debounceMs: number;
  /** Maximum events to batch before forcing a think */
  maxBatchSize: number;
  /** Minimum events required to trigger thinking */
  minEventsToThink: number;
  /** Event types that trigger immediate thinking */
  urgentEventTypes: AppEvent['type'][];
  /** Enable/disable the thinker */
  enabled: boolean;
  /** Allow bedside note evolution side effects */
  allowBedsideEvolve: boolean;
  /** Minimum interval between bedside evolves (ms) */
  bedsideCooldownMs: number;
}

export interface ThinkerState {
  /** Whether a thinking session is in progress */
  isThinking: boolean;
  /** Last time thinking completed */
  lastThinkTime: number;
  /** Number of suggestions generated this session */
  suggestionsGenerated: number;
  pendingEvents: AppEvent[];
  editDeltaAccumulator: number;
  lastEditEvolveAt: number;
  lastBedsideEvolveAt: number;
  lastTimelineCheckAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const SIGNIFICANT_EDIT_THRESHOLD = 500;
const SIGNIFICANT_EDIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const TIMELINE_CONTEXT_WINDOW = 2000;
const TIMELINE_CHECK_COOLDOWN_MS = 30_000;

const DEFAULT_CONFIG: ThinkerConfig = {
  debounceMs: 10000, // 10 seconds between thinks
  maxBatchSize: 20,
  minEventsToThink: 3,
  urgentEventTypes: ['ANALYSIS_COMPLETED', 'INTELLIGENCE_UPDATED', 'SIGNIFICANT_EDIT_DETECTED'],
  enabled: true,
  allowBedsideEvolve: true,
  bedsideCooldownMs: 60_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const PROACTIVE_THINKING_PROMPT = `You are a proactive writing assistant analyzing recent activity in a manuscript editor.

CURRENT CONTEXT:
{{CONTEXT}}

{{LONG_TERM_MEMORY}}

RECENT ACTIVITY:
{{EVENTS}}

{{CONFLICTS}}

TASK: Analyze the recent activity and context. If you notice any significant patterns, opportunities for improvement, or potential issues, generate 1-3 proactive suggestions.

Focus on:
1. Plot/continuity issues that the writer might not notice
2. Character consistency concerns
3. Pacing problems developing across recent edits
4. Opportunities to strengthen the narrative
5. Conflicts between what was written and established lore/memory

Only suggest things that are GENUINELY HELPFUL and NON-OBVIOUS. Do not suggest trivial improvements.

If nothing significant stands out, return an empty array.

Respond in JSON format:
{
  "significant": boolean,
  "suggestions": [
    {
      "title": "Short title",
      "description": "Detailed explanation",
      "priority": "high" | "medium" | "low",
      "type": "plot" | "character" | "pacing" | "style" | "continuity"
    }
  ],
  "reasoning": "Brief explanation of your analysis"
}`;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN THINKER CLASS
// ─────────────────────────────────────────────────────────────────────────────

interface RawSuggestion {
  title?: string;
  description?: string;
  priority?: ProactiveSuggestion['priority'];
  type?: string;
}

interface RawThinkingResponse {
  significant?: boolean;
  suggestions?: RawSuggestion[];
  reasoning?: string;
}

export class ProactiveThinker {
  private config: ThinkerConfig;
  private state: ThinkerState;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private getState: (() => AppBrainState) | null = null;
  private onSuggestion: ((suggestion: ProactiveSuggestion) => void) | null = null;
  private projectId: string | null = null;

  constructor(config: Partial<ThinkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isThinking: false,
      suggestionsGenerated: 0,
      lastThinkTime: 0,
      pendingEvents: [],
      editDeltaAccumulator: 0,
      lastEditEvolveAt: 0,
      lastBedsideEvolveAt: 0,
      lastTimelineCheckAt: 0,
    };
  }

  /**
   * Start the proactive thinker.
   * 
   * @param getState - Function to get current AppBrainState
   * @param projectId - Current project ID for memory access
   * @param onSuggestion - Callback when a new suggestion is generated
   */
  start(
    getState: () => AppBrainState,
    projectId: string,
    onSuggestion: (suggestion: ProactiveSuggestion) => void
  ): void {
    if (!this.config.enabled) return;
    
    this.getState = getState;
    this.projectId = projectId;
    this.onSuggestion = onSuggestion;
    
    // Subscribe to all events
    this.unsubscribe = eventBus.subscribeAll((event) => {
      this.handleEvent(event);
    });
    
    console.log('[ProactiveThinker] Started');
  }

  /**
   * Stop the proactive thinker.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.state.pendingEvents = [];
    console.log('[ProactiveThinker] Stopped');
  }

  /**
   * Get current thinker state.
   */
  getStatus(): ThinkerState {
    return { ...this.state };
  }

  /**
   * Manually trigger a thinking session.
   */
  async forceThink(): Promise<ThinkingResult | null> {
    if (!this.getState || !this.projectId) {
      return null;
    }

    return this.performThinking();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ───────────────────────────────────────────────────────────────────────────

  private handleEvent(event: AppEvent): void {
    this.maybeUpdateBedsideNotes(event);
    this.enqueueEvent(event);
    void this.detectConflicts(event);
    void this.detectVoiceConsistency(event);
    this.scheduleThinking(this.isUrgentEvent(event));
  }

  private maybeUpdateBedsideNotes(event: AppEvent): void {
    if (!this.projectId || !this.getState) return;
    const state = this.getState();

    this.handleChapterTransition(event, state);
    this.handleSignificantEdit(event, state);
  }

  private handleChapterTransition(event: AppEvent, state: AppBrainState): void {
    if (event.type !== 'CHAPTER_CHANGED' || !event.payload?.chapterId) return;

    const { issues = [], watchedEntities = [], title } = event.payload;
    const lines: string[] = [`Now in chapter: "${title}"`];

    if (issues.length > 0) {
      lines.push('Chapter issues to watch:');
      for (const issue of issues.slice(0, 3)) {
        const severity = issue.severity ? ` (${issue.severity})` : '';
        lines.push(`- ${issue.description}${severity}`);
      }
    }

    if (watchedEntities.length > 0) {
      lines.push('Watched entities in this chapter:');
      for (const entity of watchedEntities.slice(0, 5)) {
        const priority = entity.priority ? ` [${entity.priority}]` : '';
        const reason = entity.reason ? ` — ${entity.reason}` : '';
        lines.push(`- ${entity.name}${priority}${reason}`);
      }
    }

    const planText = lines.join('\n');
    if (!planText.trim()) return;

    const projectId = state.manuscript.projectId;
    evolveBedsideNote(projectId, planText, {
      changeReason: 'chapter_transition',
      chapterId: event.payload.chapterId,
      extraTags: [`chapter:${event.payload.chapterId}`],
    }).catch(error =>
      console.warn('[ProactiveThinker] Chapter transition bedside update failed:', error)
    );
  }

  private handleSignificantEdit(event: AppEvent, state: AppBrainState): void {
    if (event.type !== 'TEXT_CHANGED') return;

    const delta = Math.abs(event.payload?.delta ?? 0);
    this.state.editDeltaAccumulator += delta;

    const now = Date.now();
    const exceededThreshold = this.state.editDeltaAccumulator >= SIGNIFICANT_EDIT_THRESHOLD;
    const pastCooldown = now - this.state.lastEditEvolveAt > SIGNIFICANT_EDIT_COOLDOWN_MS;

    if (!exceededThreshold || !pastCooldown) return;

    this.state.editDeltaAccumulator = 0;
    this.state.lastEditEvolveAt = now;

    const { manuscript } = state;
    const activeChapter = manuscript.chapters.find(
      chapter => chapter.id === manuscript.activeChapterId
    );
    const chapterLine = activeChapter ? ` in "${activeChapter.title}"` : '';
    const planText = `Significant edits detected${chapterLine}. Recheck continuity, goals, and conflicts.`;

    this.maybeEvolveBedsideNote(planText, {
      changeReason: 'significant_edit',
      chapterId: manuscript.activeChapterId ?? undefined,
      extraTags: [
        ...(manuscript.activeChapterId ? [`chapter:${manuscript.activeChapterId}`] : []),
        'edit:significant',
      ],
    });
  }

  private async detectConflicts(event: AppEvent): Promise<void> {
    if (event.type !== 'SIGNIFICANT_EDIT_DETECTED' || !this.getState) return;

    const now = Date.now();
    if (now - this.state.lastTimelineCheckAt < TIMELINE_CHECK_COOLDOWN_MS) return;

    const state = this.getState();
    const timeline = state.intelligence.timeline;
    const activeChapterId = state.manuscript.activeChapterId;

    if (!timeline || !activeChapterId) return;

    const currentText = state.manuscript.currentText || '';
    if (!currentText) return;

    const recentText = currentText.slice(-TIMELINE_CONTEXT_WINDOW);
    const newMarkers = extractTemporalMarkers(recentText);

    if (newMarkers.length === 0) return;

    this.state.lastTimelineCheckAt = now;

    const chapterEvents = timeline.events
      .filter(timelineEvent => timelineEvent.chapterId === activeChapterId)
      .sort((a, b) => a.offset - b.offset);

    const historicalMarkers: TemporalMarker[] = [];
    for (const timelineEvent of chapterEvents) {
      const baseText = timelineEvent.temporalMarker || timelineEvent.description;
      if (!baseText) continue;
      historicalMarkers.push(...extractTemporalMarkers(baseText));
    }

    const latestByCategory = new Map<TemporalMarker['category'], TemporalMarker>();
    for (const marker of historicalMarkers) {
      latestByCategory.set(marker.category, marker);
    }

    for (const marker of newMarkers) {
      const previous = latestByCategory.get(marker.category);
      if (previous && previous.normalized !== marker.normalized) {
        const suggestion: ProactiveSuggestion = {
          id: `timeline-conflict-${Date.now()}`,
          type: 'timeline_conflict',
          priority: 'high',
          title: 'Timeline conflict detected',
          description: `Previous context referenced ${previous.normalized}, but the latest edit mentions ${marker.normalized}. Confirm chapter continuity.`,
          source: { type: 'memory', id: 'timeline-tracker' },
          tags: ['continuity', 'timeline', marker.category],
          createdAt: Date.now(),
          metadata: {
            previousMarker: previous.marker,
            previousContext: previous.sentence,
            currentMarker: marker.marker,
            currentContext: marker.sentence,
            category: marker.category,
          },
        };

        if (this.onSuggestion) {
          this.onSuggestion(suggestion);
        }

        this.state.lastTimelineCheckAt = now;
        break;
      }

      if (!previous) {
        latestByCategory.set(marker.category, marker);
      }
    }
  }

  private extractDialogueBlocks(text: string): Array<{ quote: string; context: string }> {
    const blocks: Array<{ quote: string; context: string }> = [];
    const regex = /"([^"\n]{10,600}?)"/gms;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const quote = match[1].trim();
      if (!quote) continue;
      const start = Math.max(0, match.index - 120);
      const end = Math.min(text.length, (match.index + match[0].length) + 120);
      const context = text.slice(start, end);
      blocks.push({ quote, context });
    }

    return blocks;
  }

  private inferDialogueSpeaker(context: string, knownCharacters: string[]): string | null {
    if (!knownCharacters.length) return null;
    const normalizedContext = context.toLowerCase();

    for (const character of knownCharacters) {
      const normalized = character.toLowerCase();
      const namePattern = new RegExp(`\\b${normalized.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (namePattern.test(normalizedContext)) {
        return character;
      }
    }

    const attribution = /(?:said|asked|replied|whispered|shouted|muttered|exclaimed)\s+([A-Z][a-zA-Z]+)/i;
    const match = attribution.exec(context);
    if (match && match[1]) {
      const candidate = match[1];
      const exact = knownCharacters.find(name => name.toLowerCase() === candidate.toLowerCase());
      return exact ?? candidate;
    }

    return null;
  }

  private collectKnownCharacters(state: AppBrainState): string[] {
    const names = new Set<string>();

    const graphNodes = state.intelligence.entities?.nodes ?? [];
    for (const node of graphNodes) {
      if (node.type === 'character' && node.name) {
        names.add(node.name);
      }
    }

    const loreCharacters = state.lore?.characters ?? [];
    for (const character of loreCharacters) {
      if (character.name) {
        names.add(character.name);
      }
    }

    return Array.from(names);
  }

  private calculateVoiceDeviation(newMetrics: VoiceMetrics, baseline: VoiceMetrics) {
    const relativeDifference = (a: number, b: number): number => {
      if (a === 0 && b === 0) return 0;
      const avg = (Math.abs(a) + Math.abs(b)) / 2;
      if (avg === 0) return Math.abs(a - b);
      return Math.abs(a - b) / avg;
    };

    const metricLabels: Record<keyof VoiceMetrics, string> = {
      avgSentenceLength: 'Sentence length',
      sentenceVariance: 'Sentence variance',
      contractionRatio: 'Contractions',
      questionRatio: 'Questions',
      exclamationRatio: 'Exclamations',
      latinateRatio: 'Formality',
      uniqueWordCount: 'Vocabulary breadth',
    };

    const diffs = (Object.keys(metricLabels) as Array<keyof VoiceMetrics>).map(metric => {
      return {
        metric,
        label: metricLabels[metric],
        current: newMetrics[metric],
        historic: baseline[metric],
        delta: relativeDifference(newMetrics[metric], baseline[metric]),
      };
    });

    const sorted = diffs.sort((a, b) => b.delta - a.delta);
    return { diffs: sorted, maxDelta: sorted[0]?.delta ?? 0 };
  }

  private async detectVoiceConsistency(event: AppEvent): Promise<void> {
    if (event.type !== 'SIGNIFICANT_EDIT_DETECTED' || !this.getState || !this.projectId) return;

    const state = this.getState();
    const text = state.manuscript.currentText ?? '';
    if (!text.includes('"')) return;

    const sampleWindow = Math.min(Math.max((event.payload?.delta ?? SIGNIFICANT_EDIT_THRESHOLD) * 4, 800), 5000);
    const recentText = text.slice(-sampleWindow);
    const dialogueBlocks = this.extractDialogueBlocks(recentText);
    if (dialogueBlocks.length === 0) return;

    const knownCharacters = this.collectKnownCharacters(state);

    for (const block of dialogueBlocks) {
      const speaker = this.inferDialogueSpeaker(block.context, knownCharacters);
      if (!speaker) continue;

      const dialogueLines: DialogueLine[] = [{ speaker, quote: block.quote }];
      const liveProfile = generateVoiceProfile(dialogueLines, { speakerName: speaker });
      const baseline = await getVoiceProfileForCharacter(this.projectId, speaker);

      await upsertVoiceProfile(this.projectId, speaker, dialogueLines);

      if (!baseline) continue;

      const deviation = this.calculateVoiceDeviation(liveProfile.metrics, baseline.metrics);
      if (deviation.maxDelta < 0.35) continue;

      const summaryDiffs = deviation.diffs.slice(0, 2).map(diff => {
        return `${diff.label}: ${diff.current > diff.historic ? 'Higher' : 'Lower'} (now ${(diff.current).toFixed(2)} vs historic ${(diff.historic).toFixed(2)})`;
      });

      const suggestion: ProactiveSuggestion = {
        id: `voice-${speaker}-${Date.now()}`,
        type: 'voice_inconsistency',
        priority: deviation.maxDelta > 0.55 ? 'high' : 'medium',
        title: `Voice drift detected for ${speaker}`,
        description:
          summaryDiffs.join('; ') || 'Recent dialogue differs from the established voice profile.',
        source: { type: 'entity', id: `character:${speaker.toLowerCase()}`, name: speaker },
        suggestedAction: `rewrite_dialogue character="${speaker}" style="${baseline.impression}"`,
        tags: ['voice', `character:${speaker.toLowerCase()}`],
        createdAt: Date.now(),
        metadata: {
          speaker,
          currentImpression: liveProfile.impression,
          historicImpression: baseline.impression,
          diffs: deviation.diffs,
          quote: block.quote,
        },
      };

      if (this.onSuggestion) {
        this.onSuggestion(suggestion);
      }
    }
  }

  private enqueueEvent(event: AppEvent): void {
    this.state.pendingEvents.push(event);

    if (this.state.pendingEvents.length > this.config.maxBatchSize) {
      this.state.pendingEvents = this.state.pendingEvents.slice(-this.config.maxBatchSize);
    }
  }

  private isUrgentEvent(event: AppEvent): boolean {
    return this.config.urgentEventTypes.includes(event.type);
  }

  private scheduleThinking(urgent: boolean): void {
    this.clearDebounceTimer();
    
    // Check if we have enough events
    if (this.state.pendingEvents.length < this.config.minEventsToThink && !urgent) {
      return;
    }
    
    const timeSinceLastThink = Date.now() - this.state.lastThinkTime;
    const cooldownRemaining = Math.max(0, this.config.debounceMs - timeSinceLastThink);
    
    // Use shorter delay for urgent events
    const delay = urgent ? Math.min(cooldownRemaining, 2000) : cooldownRemaining;
    
    this.debounceTimer = setTimeout(() => {
      this.performThinking();
    }, delay);
  }

  private async performThinking(): Promise<ThinkingResult | null> {
    if (this.state.isThinking || !this.getState || !this.projectId) {
      return null;
    }
    if (this.state.pendingEvents.length === 0) {
      return null;
    }

    this.state.isThinking = true;
    const startTime = Date.now();
    
    const events = [...this.state.pendingEvents];

    // Emit thinking started event
    eventBus.emit({
      type: 'PROACTIVE_THINKING_STARTED',
      payload: {
        trigger: events[0]?.type ?? 'manual',
        pendingEvents: events,
        contextPreview: events.map(event => event.type).join(', '),
      },
    });

    try {
      const state = this.getState();

      // Clear pending events
      this.state.pendingEvents = [];

      // Build context
      const context = buildCompressedContext(state);
      const formattedEvents = this.formatEventsForPrompt(events);

      const loreSuggestions = await this.detectLoreSuggestions(state, events);

      // Get long-term memory context from BedsideHistorySearch
      const longTermMemory = await this.fetchLongTermMemoryContext(state);

      // Get conflicts from intelligence-memory bridge
      let conflictsSection = '';
      if (state.intelligence.hud) {
        const conflicts = await getHighPriorityConflicts(
          state.intelligence.hud,
          this.projectId
        );
        conflictsSection = formatConflictsForPrompt(conflicts, 300);
      }
      
      // Build prompt
      const prompt = PROACTIVE_THINKING_PROMPT
        .replace('{{CONTEXT}}', context)
        .replace('{{LONG_TERM_MEMORY}}', longTermMemory.text)
        .replace('{{EVENTS}}', formattedEvents)
        .replace('{{CONFLICTS}}', conflictsSection ? `\nDETECTED CONFLICTS:\n${conflictsSection}` : '');
      
      // Call LLM
      const response = await ai.models.generateContent({
        model: ModelConfig.agent,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: ThinkingBudgets.analysis },
          responseMimeType: "application/json",
        },
      });
      
      const text = response.text || '';
      const result = this.parseThinkingResult(text);
      const combinedSuggestions = [...loreSuggestions, ...result.suggestions];

      this.state.lastThinkTime = Date.now();
      this.state.suggestionsGenerated += combinedSuggestions.length;

      // Emit thinking completed event
      eventBus.emit({
        type: 'PROACTIVE_THINKING_COMPLETED',
        payload: {
          suggestionsCount: combinedSuggestions.length,
          thinkingTime: Date.now() - startTime,
          suggestions: combinedSuggestions,
          rawThinking: result.rawThinking,
          memoryContext: {
            longTermMemoryIds: longTermMemory.matches.map(match => match.note.id),
            longTermMemoryPreview: longTermMemory.matches.map(match =>
              `${match.note.id}: ${match.note.text.slice(0, 160)}`
            ),
          },
          contextUsed: {
            compressedContext: context,
            longTermMemory: longTermMemory.text,
            formattedEvents,
            events,
          },
        },
      });

      if (this.onSuggestion) {
        for (const suggestion of combinedSuggestions) {
          this.onSuggestion(suggestion);
        }
      }

      if (this.projectId && (result.significant || loreSuggestions.length > 0)) {
        try {
          const reminders = await getImportantReminders(this.projectId);
          const lines: string[] = [];

          if (combinedSuggestions.length > 0) {
            lines.push('Proactive opportunities to focus on next:');
            for (const suggestion of combinedSuggestions.slice(0, 3)) {
              lines.push(`- ${suggestion.title}: ${suggestion.description}`);
            }
          }

          if (reminders.length > 0) {
            lines.push('Important unresolved issues and stalled goals:');
            for (const reminder of reminders.slice(0, 3)) {
              lines.push(`- ${reminder.title}: ${reminder.description}`);
            }
          }

          const planText = lines.join('\n');
          if (planText.trim()) {
            await this.maybeEvolveBedsideNote(planText, {
              changeReason: 'proactive_thinking',
            });
          }
        } catch (e) {
          console.warn('[ProactiveThinker] Failed to evolve bedside note:', e);
        }
      }

      return {
        ...result,
        suggestions: combinedSuggestions,
        significant: result.significant || loreSuggestions.length > 0,
        thinkingTime: Date.now() - startTime,
      };
      
    } catch (error) {
      console.error('[ProactiveThinker] Thinking failed:', error);
      return {
        suggestions: [],
        thinkingTime: Date.now() - startTime,
        significant: false,
      };
    } finally {
      this.state.isThinking = false;
    }
  }

  private formatEventsForPrompt(events: AppEvent[]): string {
    if (events.length === 0) return 'No recent events.';
    
    const lines: string[] = [];
    for (const event of events.slice(-10)) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      lines.push(`[${time}] ${event.type}: ${JSON.stringify(event.payload).slice(0, 100)}`);
    }
    
    return lines.join('\n');
  }

  private async detectLoreSuggestions(
    state: AppBrainState,
    events: AppEvent[],
  ): Promise<ProactiveSuggestion[]> {
    const sawSignificantEdit = events.some(event => event.type === 'SIGNIFICANT_EDIT_DETECTED');
    if (!sawSignificantEdit) return [];

    const intelligence = state.intelligence.full;
    if (!intelligence?.entities?.nodes?.length) return [];

    const candidates = intelligence.entities.nodes.filter(node =>
      ['character', 'location', 'object'].includes(node.type) && node.mentionCount >= 2,
    );

    const existingLoreNames = state.lore?.characters?.map(character => character.name) ?? [];
    const novelEntities = filterNovelLoreEntities(candidates, existingLoreNames);
    if (novelEntities.length === 0) return [];

    const facts = extractFacts(intelligence);
    const now = Date.now();

    return novelEntities.map(entity => {
      const fact = facts.find(
        candidate => candidate.subject.toLowerCase() === entity.name.toLowerCase(),
      );

      const description = fact
        ? `${fact.subject} ${fact.predicate} ${fact.object}`
        : `Spotted multiple mentions around offset ${entity.firstMention ?? 0}.`;

      return {
        id: `lore-${entity.name}-${now}`,
        type: 'lore_discovery',
        priority: 'medium',
        title: `New ${entity.type === 'object' ? 'item' : entity.type} detected: ${entity.name}`,
        description,
        source: { type: 'entity', id: entity.name, name: entity.name },
        tags: ['lore', entity.type],
        createdAt: now,
        metadata: {
          entityName: entity.name,
          entityType: entity.type,
          evidence: description,
          firstMention: entity.firstMention,
        },
      };
    });
  }

  private parseThinkingResult(text: string): Omit<ThinkingResult, 'thinkingTime'> {
    const parsed = this.safeParseResponse(text);
    if (!parsed) {
      return { suggestions: [], significant: false };
    }

    const suggestions = this.mapSuggestions(parsed.suggestions ?? []);
    return {
      suggestions,
      rawThinking: parsed.reasoning,
      significant: parsed.significant ?? suggestions.length > 0,
    };
  }

  private safeParseResponse(text: string): RawThinkingResponse | null {
    try {
      return JSON.parse(text) as RawThinkingResponse;
    } catch (error) {
      console.warn('[ProactiveThinker] Failed to parse thinking result:', error);
      return null;
    }
  }

  private mapSuggestions(raw: RawSuggestion[]): ProactiveSuggestion[] {
    const timestamp = Date.now();
    return raw.map((suggestion, index) => ({
      id: `proactive-${timestamp}-${index}`,
      type: 'related_memory' as const,
      priority: suggestion.priority ?? 'medium',
      title: suggestion.title ?? 'Suggestion',
      description: suggestion.description ?? '',
      source: {
        type: 'memory' as const,
        id: 'proactive-thinker',
      },
      tags: [suggestion.type ?? 'general'],
      createdAt: timestamp,
    }));
  }

  private clearDebounceTimer(): void {
    if (!this.debounceTimer) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  /**
   * Fetch long-term memory context from BedsideHistorySearch.
   * Provides thematic insights, character arcs, and historical context to the thinker.
   */
  private async fetchLongTermMemoryContext(
    state: AppBrainState,
  ): Promise<{ text: string; matches: BedsideHistoryMatch[] }> {
    if (!this.projectId) return { text: '', matches: [] };

    try {
      // Build a query based on current context (active entities, scene type)
      const queryParts: string[] = ['themes', 'character arcs', 'plot developments'];
      
      // Add active entity names to the query
      if (state.intelligence.hud?.context.activeEntities) {
        const entityNames = state.intelligence.hud.context.activeEntities
          .slice(0, 3)
          .map(e => e.name);
        queryParts.push(...entityNames);
      }
      
      // Add current scene type if available
      if (state.intelligence.hud?.situational.currentScene?.type) {
        queryParts.push(state.intelligence.hud.situational.currentScene.type);
      }

      const query = queryParts.join(' ');
      const matches = await searchBedsideHistory(this.projectId, query, { limit: 5 });

      if (matches.length === 0) {
        return { text: '', matches };
      }

      const lines: string[] = ['LONG-TERM MEMORY (Bedside Notes):'];
      for (const match of matches) {
        const relevance = Math.round(match.similarity * 100);
        const age = this.formatAge(match.note.createdAt);
        lines.push(`- [${relevance}% relevant, ${age}]: ${match.note.text.slice(0, 150)}${match.note.text.length > 150 ? '...' : ''}`);
      }

      return { text: lines.join('\n'), matches };
    } catch (error) {
      console.warn('[ProactiveThinker] Failed to fetch long-term memory:', error);
      return { text: '', matches: [] };
    }
  }

  /**
   * Format timestamp as human-readable age (e.g., "2 days ago", "1 hour ago")
   */
  private formatAge(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private canEvolveBedside(): boolean {
    if (!this.config.allowBedsideEvolve) return false;
    const now = Date.now();
    const elapsed = now - this.state.lastBedsideEvolveAt;
    return elapsed >= this.config.bedsideCooldownMs;
  }

  private async maybeEvolveBedsideNote(
    planText: string,
    options: Parameters<typeof evolveBedsideNote>[2],
  ): Promise<void> {
    if (!this.projectId || !this.canEvolveBedside()) return;
    this.state.lastBedsideEvolveAt = Date.now();
    try {
      await evolveBedsideNote(this.projectId, planText, options);
    } catch (error) {
      console.warn('[ProactiveThinker] Bedside evolve failed:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON & CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

let thinkerInstance: ProactiveThinker | null = null;

/**
 * Get or create the singleton ProactiveThinker instance.
 */
export function getProactiveThinker(config?: Partial<ThinkerConfig>): ProactiveThinker {
  if (!thinkerInstance) {
    thinkerInstance = new ProactiveThinker(config);
  }
  return thinkerInstance;
}

/**
 * Start the proactive thinker with the given configuration.
 */
export function startProactiveThinker(
  getState: () => AppBrainState,
  projectId: string,
  onSuggestion: (suggestion: ProactiveSuggestion) => void,
  config?: Partial<ThinkerConfig>
): ProactiveThinker {
  const thinker = getProactiveThinker(config);
  thinker.start(getState, projectId, onSuggestion);
  return thinker;
}

/**
 * Stop the proactive thinker.
 */
export function stopProactiveThinker(): void {
  if (thinkerInstance) {
    thinkerInstance.stop();
  }
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetProactiveThinker(): void {
  if (thinkerInstance) {
    thinkerInstance.stop();
  }
  thinkerInstance = null;
}
