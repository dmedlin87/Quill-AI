/**
 * Context Builder
 * 
 * Smart context window assembly for AI consumption:
 * - Situational awareness (current scene, tension, pacing)
 * - Relevant entities and relationships
 * - Open plot threads
 * - Recent changes
 * - Prioritized issues
 */

import {
  ManuscriptHUD,
  SituationalAwareness,
  RelevantContext,
  ManuscriptIntelligence,
  RiskFlag,
  Scene,
  ClassifiedParagraph,
} from '../../types/intelligence';
import { getSceneAtOffset, getParagraphAtOffset } from './structuralParser';
import { getEntitiesInRange, getRelatedEntities } from './entityExtractor';
import { getUnresolvedPromises, getEventsInRange } from './timelineTracker';
import { getSectionAtOffset } from './heatmapBuilder';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_WINDOW = {
  entityRadius: 2000,      // Characters around cursor to look for entities
  eventRadius: 3000,       // Characters around cursor for timeline events
  maxEntities: 10,         // Max entities to include
  maxRelationships: 15,    // Max relationships to include
  maxPromises: 5,          // Max open plot threads
  maxEvents: 5,            // Max recent events
  maxAlerts: 5,            // Max style alerts
  maxIssues: 5,            // Max prioritized issues
};

// ─────────────────────────────────────────────────────────────────────────────
// SITUATIONAL AWARENESS
// ─────────────────────────────────────────────────────────────────────────────

const buildSituationalAwareness = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number
): SituationalAwareness => {
  const { structural } = intelligence;
  
  // Get current scene and paragraph
  const currentScene = getSceneAtOffset(structural, cursorOffset);
  const currentParagraph = getParagraphAtOffset(structural, cursorOffset);
  
  // Calculate narrative position
  const sceneIndex = currentScene 
    ? structural.scenes.findIndex(s => s.id === currentScene.id)
    : -1;
  
  const totalScenes = structural.scenes.length;
  const percentComplete = totalScenes > 0 
    ? Math.round((sceneIndex + 1) / totalScenes * 100)
    : 0;
  
  // Determine tension level
  const tension = currentScene?.tension || 0.5;
  const tensionLevel: 'low' | 'medium' | 'high' = 
    tension < 0.3 ? 'low' : tension > 0.7 ? 'high' : 'medium';
  
  // Determine pacing
  const avgSentenceLength = currentParagraph?.avgSentenceLength || 15;
  const pacing: 'slow' | 'moderate' | 'fast' =
    avgSentenceLength > 25 ? 'slow' : avgSentenceLength < 10 ? 'fast' : 'moderate';
  
  return {
    currentScene,
    currentParagraph,
    narrativePosition: {
      sceneIndex: sceneIndex + 1,
      totalScenes,
      percentComplete,
    },
    tensionLevel,
    pacing,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANT CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const buildRelevantContext = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number
): RelevantContext => {
  const { entities, timeline } = intelligence;
  
  // Get entities near cursor
  const startOffset = Math.max(0, cursorOffset - CONTEXT_WINDOW.entityRadius);
  const endOffset = cursorOffset + CONTEXT_WINDOW.entityRadius;
  
  const nearbyEntities = getEntitiesInRange(entities, startOffset, endOffset);
  const activeEntities = nearbyEntities.slice(0, CONTEXT_WINDOW.maxEntities);
  
  // Get relationships for active entities
  const activeRelationships = [];
  const seenEdges = new Set<string>();
  
  for (const entity of activeEntities) {
    const related = getRelatedEntities(entities, entity.id);
    for (const { relationship } of related) {
      if (!seenEdges.has(relationship.id)) {
        seenEdges.add(relationship.id);
        activeRelationships.push(relationship);
      }
    }
  }
  
  // Get open plot promises
  const openPromises = getUnresolvedPromises(timeline)
    .slice(0, CONTEXT_WINDOW.maxPromises);
  
  // Get recent timeline events
  const eventStart = Math.max(0, cursorOffset - CONTEXT_WINDOW.eventRadius);
  const recentEvents = getEventsInRange(timeline, eventStart, cursorOffset)
    .slice(-CONTEXT_WINDOW.maxEvents);
  
  return {
    activeEntities,
    activeRelationships: activeRelationships.slice(0, CONTEXT_WINDOW.maxRelationships),
    openPromises,
    recentEvents,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE ALERTS
// ─────────────────────────────────────────────────────────────────────────────

const buildStyleAlerts = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number
): string[] => {
  const { style, heatmap } = intelligence;
  const alerts: string[] = [];
  
  // Get current section
  const section = getSectionAtOffset(heatmap, cursorOffset);
  
  // Add section-specific alerts
  if (section) {
    if (section.flags.includes('passive_voice_heavy')) {
      alerts.push(`Passive voice detected (${section.scores.styleRisk.toFixed(1)} risk)`);
    }
    if (section.flags.includes('adverb_overuse')) {
      alerts.push('High adverb density in this section');
    }
    if (section.flags.includes('filter_words')) {
      alerts.push('Filter words detected - consider showing instead of telling');
    }
    if (section.flags.includes('long_sentences')) {
      alerts.push('Long sentences may slow pacing');
    }
    if (section.flags.includes('exposition_dump')) {
      alerts.push('Heavy exposition - consider breaking up with action');
    }
  }
  
  // Add global alerts based on overall style
  if (style.flags.passiveVoiceRatio > 3) {
    alerts.push(`Overall passive voice: ${style.flags.passiveVoiceRatio.toFixed(1)} per 100 words`);
  }
  if (style.flags.adverbDensity > 4) {
    alerts.push(`Adverb density: ${style.flags.adverbDensity.toFixed(1)} per 100 words`);
  }
  if (style.flags.clicheCount > 0) {
    alerts.push(`${style.flags.clicheCount} cliché(s) detected`);
  }
  if (style.vocabulary.overusedWords.length > 0) {
    alerts.push(`Overused words: ${style.vocabulary.overusedWords.slice(0, 3).join(', ')}`);
  }
  
  return alerts.slice(0, CONTEXT_WINDOW.maxAlerts);
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITIZED ISSUES
// ─────────────────────────────────────────────────────────────────────────────

type PrioritizedIssue = { type: RiskFlag; description: string; offset: number; severity: number };
const buildPrioritizedIssues = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number
): PrioritizedIssue[] => {
  const { heatmap, timeline, style } = intelligence;
  const issues: PrioritizedIssue[] = [];
  const seen = new Set<string>();

  const addIssue = (issue: PrioritizedIssue) => {
    const key = `${issue.type}:${issue.offset}:${issue.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  };

  // Get issues from heatmap sections near cursor
  const nearbyStart = Math.max(0, cursorOffset - 2000);
  const nearbyEnd = cursorOffset + 2000;

  // 1) Use explicit heatmap sections when available
  for (const section of heatmap.sections) {
    if (section.offset >= nearbyStart && section.offset < nearbyEnd) {
      for (const flag of section.flags) {
        addIssue({
          type: flag,
          description: section.suggestions[0] || `${flag} detected`,
          offset: section.offset,
          severity: section.overallRisk,
        });
      }
    }
  }

  // 2) Also consider the primary section at the cursor offset (even if not in sections[])
  const primarySection = getSectionAtOffset(heatmap, cursorOffset);
  if (primarySection) {
    for (const flag of primarySection.flags) {
      addIssue({
        type: flag,
        description: primarySection.suggestions[0] || `${flag} detected`,
        offset: primarySection.offset,
        severity: primarySection.overallRisk,
      });
    }
  }
  
  // Add unresolved plot promises as issues
  for (const promise of timeline.promises.filter(p => !p.resolved)) {
    addIssue({
      type: 'unresolved_promise',
      description: `Unresolved: ${promise.description.slice(0, 50)}...`,
      offset: promise.offset,
      severity: 0.6,
    });
  }

  // Add clichés as issues
  for (const cliche of style.flags.clicheInstances) {
    addIssue({
      type: 'filter_words', // Using existing flag as proxy for clichés
      description: `Cliché: "${cliche.phrase}"`,
      offset: cliche.offset,
      severity: 0.4,
    });
  }
  
  // Sort by severity and proximity to cursor
  return issues
    .sort((a, b) => {
      const proximityA = Math.abs(a.offset - cursorOffset);
      const proximityB = Math.abs(b.offset - cursorOffset);
      // Weight severity more than proximity
      return (b.severity * 1000 - proximityB) - (a.severity * 1000 - proximityA);
    })
    .slice(0, CONTEXT_WINDOW.maxIssues);
};

// ─────────────────────────────────────────────────────────────────────────────
// QUICK STATS
// ─────────────────────────────────────────────────────────────────────────────

const buildQuickStats = (intelligence: ManuscriptIntelligence): {
  wordCount: number;
  readingTime: number;
  dialoguePercent: number;
  avgSentenceLength: number;
} => {
  const { structural, style } = intelligence;
  
  return {
    wordCount: structural.stats.totalWords,
    readingTime: Math.ceil(structural.stats.totalWords / 200), // 200 WPM
    dialoguePercent: Math.round(structural.stats.dialogueRatio * 100),
    avgSentenceLength: Math.round(style.syntax.avgSentenceLength * 10) / 10,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const buildHUD = (
  intelligence: ManuscriptIntelligence,
  cursorOffset: number
): ManuscriptHUD => {
  return {
    situational: buildSituationalAwareness(intelligence, cursorOffset),
    context: buildRelevantContext(intelligence, cursorOffset),
    styleAlerts: buildStyleAlerts(intelligence, cursorOffset),
    prioritizedIssues: buildPrioritizedIssues(intelligence, cursorOffset),
    recentChanges: intelligence.delta.changedRanges.slice(-5),
    stats: buildQuickStats(intelligence),
    lastFullProcess: intelligence.structural.processedAt,
    processingTier: 'background',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT STRING BUILDER (for AI prompts)
// ─────────────────────────────────────────────────────────────────────────────

export const buildAIContextString = (hud: ManuscriptHUD): string => {
  const { situational, context, styleAlerts, prioritizedIssues, stats } = hud;
  
  let contextStr = '';
  
  // Situational awareness
  contextStr += `[SITUATIONAL AWARENESS]\n`;
  if (situational.currentScene) {
    contextStr += `Current Scene: ${situational.currentScene.type} scene`;
    if (situational.currentScene.pov) {
      contextStr += `, POV: ${situational.currentScene.pov}`;
    }
    if (situational.currentScene.location) {
      contextStr += `, Location: ${situational.currentScene.location}`;
    }
    contextStr += `\n`;
  }
  contextStr += `Tension Level: ${situational.tensionLevel.toUpperCase()}\n`;
  contextStr += `Pacing: ${situational.pacing}\n`;
  contextStr += `Position: Scene ${situational.narrativePosition.sceneIndex} of ${situational.narrativePosition.totalScenes} (${situational.narrativePosition.percentComplete}% complete)\n\n`;
  
  // Active entities
  if (context.activeEntities.length > 0) {
    contextStr += `[ACTIVE ENTITIES IN SCENE]\n`;
    for (const entity of context.activeEntities.slice(0, 5)) {
      contextStr += `- ${entity.name} (${entity.type}): mentioned ${entity.mentionCount} times\n`;
    }
    contextStr += `\n`;
  }
  
  // Relationships
  if (context.activeRelationships.length > 0) {
    contextStr += `[KEY RELATIONSHIPS]\n`;
    for (const rel of context.activeRelationships.slice(0, 5)) {
      const source = context.activeEntities.find(e => e.id === rel.source);
      const target = context.activeEntities.find(e => e.id === rel.target);
      if (source && target) {
        contextStr += `- ${source.name} ${rel.type} ${target.name}\n`;
      }
    }
    contextStr += `\n`;
  }
  
  // Open plot threads
  if (context.openPromises.length > 0) {
    contextStr += `[OPEN PLOT THREADS]\n`;
    for (const promise of context.openPromises) {
      contextStr += `- [${promise.type.toUpperCase()}] ${promise.description.slice(0, 80)}\n`;
    }
    contextStr += `\n`;
  }
  
  // Style alerts
  if (styleAlerts.length > 0) {
    contextStr += `[STYLE ALERTS]\n`;
    for (const alert of styleAlerts) {
      contextStr += `⚠️ ${alert}\n`;
    }
    contextStr += `\n`;
  }
  
  // Priority issues
  if (prioritizedIssues.length > 0) {
    contextStr += `[PRIORITY ISSUES]\n`;
    for (const issue of prioritizedIssues) {
      const severityLabel = issue.severity > 0.7 ? '🔴' : issue.severity > 0.4 ? '🟡' : '🟢';
      contextStr += `${severityLabel} ${issue.description}\n`;
    }
    contextStr += `\n`;
  }
  
  // Quick stats
  contextStr += `[MANUSCRIPT STATS]\n`;
  contextStr += `Words: ${stats.wordCount.toLocaleString()} | `;
  contextStr += `Reading time: ${stats.readingTime} min | `;
  contextStr += `Dialogue: ${stats.dialoguePercent}% | `;
  contextStr += `Avg sentence: ${stats.avgSentenceLength} words\n`;
  
  return contextStr;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESSED CONTEXT (for token efficiency)
// ─────────────────────────────────────────────────────────────────────────────

export const buildCompressedContext = (hud: ManuscriptHUD): string => {
  const { situational, context, prioritizedIssues, stats } = hud;
  
  // Ultra-compact format for token efficiency
  let ctx = '';
  
  // Scene info
  if (situational.currentScene) {
    ctx += `Scene:${situational.currentScene.type}`;
    if (situational.currentScene.pov) ctx += `,POV:${situational.currentScene.pov}`;
    ctx += `,tension:${situational.tensionLevel}`;
    ctx += `|`;
  }
  
  // Top entities
  const topEntities = context.activeEntities.slice(0, 3).map(e => e.name);
  if (topEntities.length > 0) {
    ctx += `chars:${topEntities.join(',')}|`;
  }
  
  // Open threads count
  if (context.openPromises.length > 0) {
    ctx += `open_threads:${context.openPromises.length}|`;
  }
  
  // Top issue
  if (prioritizedIssues.length > 0) {
    ctx += `issue:${prioritizedIssues[0].type}|`;
  }
  
  // Key stats
  ctx += `words:${stats.wordCount},dialogue:${stats.dialoguePercent}%`;
  
  return ctx;
};
