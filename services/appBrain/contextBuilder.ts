/**
 * App Brain Context Builder
 * 
 * Generates context strings for AI consumption from unified app state.
 * Provides multiple formats for different use cases (full, compressed, focused).
 */

import { AppBrainState, AppBrainContext, AgentContextOptions } from './types';
import { eventBus } from './eventBus';
import {
  getMemoriesForContext,
  getRelevantMemoriesForContext,
  type MemoryRelevanceOptions,
  getActiveGoals,
  formatMemoriesForPrompt,
  formatGoalsForPrompt,
} from '../memory';
import {
  buildAdaptiveContext,
  getContextBudgetForModel,
  selectContextProfile,
  type ContextProfile,
  type AdaptiveContextResult,
} from './adaptiveContext';
import {
  getCommandHistory
} from '../commands/history';

export interface ContextSection {
  key: string;
  title: string;
  lines: string[];
}

export interface ContextTemplate {
  format: 'markdown' | 'json' | 'xml';
}

export const CHAT_CONTEXT_TEMPLATE: ContextTemplate = { format: 'markdown' };
export const API_CONTEXT_TEMPLATE: ContextTemplate = { format: 'json' };

const renderContext = (template: ContextTemplate, sections: ContextSection[]): string => {
  const nonEmpty = sections.filter(section => section.lines.length > 0);

  switch (template.format) {
    case 'json':
      return JSON.stringify(
        nonEmpty.map(({ key, title, lines }) => ({ key, title, lines })),
        null,
        2
      );
    case 'xml':
      return nonEmpty
        .map(({ key, title, lines }) => {
          const body = lines.map(line => `<line>${line}</line>`).join('');
          return `<section id="${key}"><title>${title}</title>${body}</section>`;
        })
        .join('');
    case 'markdown':
    default:
      return nonEmpty
        .map(({ title, lines }) => `${title ? `[${title}]` : ''}\n${lines.join('\n')}`)
        .join('\n\n');
  }
};

/**
 * Build full context string for agent system prompt
 */
export const buildAgentContext = (
  state: AppBrainState,
  options?: AgentContextOptions,
  template: ContextTemplate = CHAT_CONTEXT_TEMPLATE,
): string => {
  const { manuscript, intelligence, analysis, lore, ui, session } = state;
  const sections: ContextSection[] = [];

  const createSection = (key: string, title: string): ContextSection => {
    const section: ContextSection = { key, title, lines: [] };
    sections.push(section);
    return section;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MANUSCRIPT STATE
  // ─────────────────────────────────────────────────────────────────────────
  const manuscriptSection = createSection('manuscript', 'MANUSCRIPT STATE');
  manuscriptSection.lines.push(`Project: ${manuscript.projectTitle}`);
  manuscriptSection.lines.push(`Chapters: ${manuscript.chapters.length}`);
  
  const activeChapter = manuscript.chapters.find(c => c.id === manuscript.activeChapterId);
  if (activeChapter) {
    manuscriptSection.lines.push(`Active Chapter: "${activeChapter.title}" (${manuscript.currentText.length} chars)`);
  }
  
  if (manuscript.setting) {
    manuscriptSection.lines.push(`Setting: ${manuscript.setting.timePeriod}, ${manuscript.setting.location}`);
  }
  
  if (manuscript.branches.length > 0) {
    manuscriptSection.lines.push(`Branches: ${manuscript.branches.length}${manuscript.activeBranchId ? ' (on branch)' : ' (on main)'}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI STATE (What user is doing right now)
  // ─────────────────────────────────────────────────────────────────────────
  const uiSection = createSection('ui', 'CURRENT USER STATE');
  const cursorLine = ui.cursor.scene
    ? `Cursor Position: ${ui.cursor.position} (${ui.cursor.scene} scene)`
    : `Cursor Position: ${ui.cursor.position}`;
  uiSection.lines.push(cursorLine);
  
  if (ui.selection) {
    const previewText = ui.selection.text.length > 100 
      ? ui.selection.text.slice(0, 100) + '...' 
      : ui.selection.text;
    uiSection.lines.push(`Selection: "${previewText}" [${ui.selection.start}-${ui.selection.end}]`);
  } else {
    uiSection.lines.push('Selection: None');
  }
  
  uiSection.lines.push(`Active Panel: ${ui.activePanel}`);
  uiSection.lines.push(`View Mode: ${ui.activeView}${ui.isZenMode ? ' (Zen Mode)' : ''}`);
  uiSection.lines.push(
    `Mic: ${ui.microphone.status}${
      ui.microphone.lastTranscript
        ? ` (heard: "${ui.microphone.lastTranscript.slice(0, 60)}${ui.microphone.lastTranscript.length > 60 ? '...' : ''}")`
        : ''
    }`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // INTELLIGENCE HUD (if available)
  // ─────────────────────────────────────────────────────────────────────────
  if (intelligence.hud) {
    const hud = intelligence.hud;
    const hudSection = createSection('intelligence_hud', 'INTELLIGENCE HUD');
    
    if (hud.situational.currentScene) {
      const scene = hud.situational.currentScene;
      const sceneParts = [`Scene: ${scene.type}`];
      if (scene.pov) sceneParts.push(`POV: ${scene.pov}`);
      if (scene.location) sceneParts.push(`Location: ${scene.location}`);
      hudSection.lines.push(sceneParts.join(', '));
    }
    
    hudSection.lines.push(`Tension: ${hud.situational.tensionLevel.toUpperCase()}`);
    hudSection.lines.push(`Pacing: ${hud.situational.pacing}`);
    hudSection.lines.push(
      `Progress: Scene ${hud.situational.narrativePosition.sceneIndex} of ${hud.situational.narrativePosition.totalScenes} (${hud.situational.narrativePosition.percentComplete}%)`
    );
    
    if (hud.context.activeEntities.length > 0) {
      hudSection.lines.push('');
      hudSection.lines.push('Active Characters:');
      for (const entity of hud.context.activeEntities.slice(0, 5)) {
        hudSection.lines.push(`• ${entity.name} (${entity.type}) - ${entity.mentionCount} mentions`);
      }
    }
    
    if (hud.context.activeRelationships.length > 0) {
      hudSection.lines.push('');
      hudSection.lines.push('Key Relationships:');
      for (const rel of hud.context.activeRelationships.slice(0, 3)) {
        const source = hud.context.activeEntities.find(e => e.id === rel.source);
        const target = hud.context.activeEntities.find(e => e.id === rel.target);
        if (source && target) {
          hudSection.lines.push(`• ${source.name} ←${rel.type}→ ${target.name}`);
        }
      }
    }
    
    if (hud.context.openPromises.length > 0) {
      hudSection.lines.push('');
      hudSection.lines.push('Open Plot Threads:');
      for (const promise of hud.context.openPromises.slice(0, 3)) {
        hudSection.lines.push(`⚡ [${promise.type.toUpperCase()}] ${promise.description.slice(0, 60)}...`);
      }
    }
    
    if (hud.styleAlerts.length > 0) {
      hudSection.lines.push('');
      hudSection.lines.push('Style Alerts:');
      for (const alert of hud.styleAlerts) {
        hudSection.lines.push(`⚠️ ${alert}`);
      }
    }
    
    if (hud.prioritizedIssues.length > 0) {
      hudSection.lines.push('');
      hudSection.lines.push('Priority Issues:');
      for (const issue of hud.prioritizedIssues) {
        const icon = issue.severity > 0.7 ? '🔴' : issue.severity > 0.4 ? '🟡' : '🟢';
        hudSection.lines.push(`${icon} ${issue.description}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYSIS RESULTS
  // ─────────────────────────────────────────────────────────────────────────
  if (analysis.result) {
    const result = analysis.result;
    const analysisSection = createSection('analysis', 'ANALYSIS INSIGHTS');
    
    if (result.summary) {
      analysisSection.lines.push(`Summary: ${result.summary.slice(0, 200)}...`);
    }
    
    if (result.strengths.length > 0) {
      analysisSection.lines.push(`Strengths: ${result.strengths.slice(0, 3).join(', ')}`);
    }
    
    if (result.weaknesses.length > 0) {
      analysisSection.lines.push(`Weaknesses: ${result.weaknesses.slice(0, 3).join(', ')}`);
    }
    
    if (result.plotIssues.length > 0) {
      analysisSection.lines.push('');
      analysisSection.lines.push('Plot Issues:');
      for (const issue of result.plotIssues.slice(0, 3)) {
        analysisSection.lines.push(`• ${issue.issue} (Fix: ${issue.suggestion?.slice(0, 50)}...)`);
      }
    }
  }
  
  if (analysis.inlineComments.length > 0) {
    const activeComments = analysis.inlineComments.filter(c => !c.dismissed);
    const commentsSection = createSection('inline_comments', 'INLINE COMMENTS');
    commentsSection.lines.push(`Active Inline Comments: ${activeComments.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LORE CONTEXT
  // ─────────────────────────────────────────────────────────────────────────
  if (lore.characters.length > 0 || lore.worldRules.length > 0) {
    const loreSection = createSection('lore', 'LORE BIBLE');
    
    if (lore.characters.length > 0) {
      loreSection.lines.push(`Characters (${lore.characters.length}):`);
      for (const char of lore.characters.slice(0, 5)) {
        loreSection.lines.push(`• ${char.name}: ${char.bio?.slice(0, 60) || 'No bio'}...`);
        if (char.inconsistencies && char.inconsistencies.length > 0) {
          loreSection.lines.push(`  ⚠️ Has ${char.inconsistencies.length} inconsistencies`);
        }
      }
    }
    
    if (lore.worldRules.length > 0) {
      loreSection.lines.push('');
      loreSection.lines.push(`World Rules (${lore.worldRules.length}):`);
      for (const rule of lore.worldRules.slice(0, 3)) {
        loreSection.lines.push(`• ${rule.slice(0, 80)}...`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECENT ACTIVITY
  // ─────────────────────────────────────────────────────────────────────────
  const recentEvents = eventBus.formatRecentEventsForAI(5);
  if (recentEvents) {
    const eventsSection = createSection('recent_activity', 'RECENT ACTIVITY');
    eventsSection.lines.push(...recentEvents.trim().split('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECENT AGENT ACTIONS (from Command History)
  // ─────────────────────────────────────────────────────────────────────────
  const commandHistory = getCommandHistory().formatForPrompt(5);
  if (commandHistory) {
    const historySection = createSection('agent_actions', 'RECENT AGENT ACTIONS');
    historySection.lines.push(...commandHistory.trim().split('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEEP ANALYSIS: VOICE FINGERPRINTS (optional)
  // ─────────────────────────────────────────────────────────────────────────
  if (options?.deepAnalysis && intelligence.full?.voice) {
    const voice = intelligence.full.voice;
    const profiles = Object.values(voice.profiles);

    if (profiles.length > 0) {
      const voiceSection = createSection('voice_fingerprints', 'DEEP ANALYSIS: VOICE FINGERPRINTS');
      for (const profile of profiles.slice(0, 5)) {
        const latinatePct = Math.round(profile.metrics.latinateRatio * 100);
        const contractionPct = Math.round(profile.metrics.contractionRatio * 100);
        voiceSection.lines.push(`• ${profile.speakerName}: ${profile.impression} (${latinatePct}% Formal, ${contractionPct}% Casual).`);
      }
      voiceSection.lines.push('Use these metrics to ensure character voice consistency.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AGENT MEMORY (async section - placeholder, populated separately)
  // ─────────────────────────────────────────────────────────────────────────
  const memorySection = createSection('agent_memory', 'AGENT MEMORY');
  memorySection.lines.push('(Memory context loaded separately - see buildAgentContextWithMemory)');

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (session.lastAgentAction) {
    const sessionSection = createSection('session', 'LAST AGENT ACTION');
    sessionSection.lines.push(`${session.lastAgentAction.type}: ${session.lastAgentAction.description}`);
    sessionSection.lines.push(`Result: ${session.lastAgentAction.success ? 'Success' : 'Failed'}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUICK STATS
  // ─────────────────────────────────────────────────────────────────────────
  if (intelligence.hud) {
    const stats = intelligence.hud.stats;
    const statsSection = createSection('stats', 'STATS');
    statsSection.lines.push(
      `Words: ${stats.wordCount.toLocaleString()} | Reading: ~${stats.readingTime} min | Dialogue: ${stats.dialoguePercent}% | Avg Sentence: ${stats.avgSentenceLength} words`
    );
  }

  return renderContext(template, sections);
};

/**
 * Build full context string with memory (async)
 * This is the primary context builder for agent sessions.
 */
const MEMORY_PLACEHOLDER = '[AGENT MEMORY]\n(Memory context loaded separately - see buildAgentContextWithMemory)';

export const buildAgentContextWithMemory = async (
  state: AppBrainState,
  projectId: string | null,
  template: ContextTemplate = CHAT_CONTEXT_TEMPLATE,
): Promise<string> => {
  // Start with base context
  let ctx = buildAgentContext(state, undefined, template);

  // Replace the placeholder memory section with actual memory
  if (projectId) {
    try {
      const [{ author, project }, goals] = await Promise.all([
        getMemoriesForContext(projectId, { limit: 25 }),
        getActiveGoals(projectId),
      ]);

      // Build memory section
      const formattedMemories = formatMemoriesForPrompt({ author, project }, { maxLength: 1500 }) || 'No memories stored yet.';
      const formattedGoals = formatGoalsForPrompt(goals);

      if (template.format === 'markdown') {
        const memoryBlock = `[AGENT MEMORY]\n${formattedMemories}${formattedGoals ? `\n\n${formattedGoals}` : ''}`;
        ctx = ctx.replace(MEMORY_PLACEHOLDER, memoryBlock);
      } else if (template.format === 'json') {
        try {
          const parsed = JSON.parse(ctx) as { key: string; title: string; lines: string[] }[];
          const memorySection = parsed.find(section => section.key === 'agent_memory');
          if (memorySection) {
            const lines: string[] = [formattedMemories];
            if (formattedGoals) {
              lines.push(...formattedGoals.split('\n'));
            }
            memorySection.lines = lines;
          }
          ctx = JSON.stringify(parsed, null, 2);
        } catch {
          // Fallback: append a JSON block if parsing fails
          const memoryLines = formattedGoals ? [formattedMemories, ...formattedGoals.split('\n')] : [formattedMemories];
          const memorySection = JSON.stringify(
            { key: 'agent_memory', title: 'AGENT MEMORY', lines: memoryLines },
            null,
            2
          );
          ctx = `${ctx}\n${memorySection}`;
        }
      } else if (template.format === 'xml') {
        const memoryLines = formattedGoals ? [formattedMemories, ...formattedGoals.split('\n')] : [formattedMemories];
        const memoryXmlLines = memoryLines.map(line => `<line>${line}</line>`).join('');
        const memoryBlock = `<section id="agent_memory"><title>AGENT MEMORY</title>${memoryXmlLines}</section>`;
        const replaced = ctx.replace(/<section id="agent_memory">[\s\S]*?<\/section>/, memoryBlock);
        ctx = replaced === ctx ? `${ctx}${memoryBlock}` : replaced;
      }
    } catch (error) {
      console.warn('Failed to load memory context:', error);
      // Leave placeholder if memory fails
    }
  }

  return ctx;
};

/**
 * Build compressed context for token efficiency (voice mode, etc.)
 */
export const buildCompressedContext = (state: AppBrainState): string => {
  const { manuscript, intelligence, ui } = state;
  let ctx = '';

  // Minimal manuscript info
  const activeChapter = manuscript.chapters.find(c => c.id === manuscript.activeChapterId);
  ctx += `ch:${activeChapter?.title || 'None'}|`;
  ctx += `pos:${ui.cursor.position}|`;
  ctx += `mic:${ui.microphone.status}|`;
  
  if (ui.selection) {
    ctx += `sel:${ui.selection.text.slice(0, 30)}...|`;
  }

  // Minimal intelligence
  if (intelligence.hud) {
    const hud = intelligence.hud;
    if (hud.situational.currentScene) {
      ctx += `scene:${hud.situational.currentScene.type}|`;
    }
    ctx += `tension:${hud.situational.tensionLevel}|`;
    
    const topEntities = hud.context.activeEntities.slice(0, 3).map(e => e.name);
    if (topEntities.length > 0) {
      ctx += `chars:${topEntities.join(',')}|`;
    }
    
    ctx += `words:${hud.stats.wordCount}`;
  }

  return ctx;
};

/**
 * Build navigation-focused context (for search/navigate tools)
 */
export const buildNavigationContext = (state: AppBrainState): string => {
  const { manuscript, intelligence } = state;
  let ctx = '[NAVIGATION CONTEXT]\n\n';

  // Chapter list
  ctx += 'Chapters:\n';
  for (const chapter of manuscript.chapters) {
    const isActive = chapter.id === manuscript.activeChapterId;
    ctx += `${isActive ? '→ ' : '  '}${chapter.order + 1}. "${chapter.title}"\n`;
  }
  ctx += '\n';

  // Entity directory (for character search)
  if (intelligence.entities) {
    const characters = intelligence.entities.nodes.filter(n => n.type === 'character');
    if (characters.length > 0) {
      ctx += 'Characters (searchable):\n';
      for (const char of characters.slice(0, 10)) {
        ctx += `• ${char.name}`;
        if (char.aliases.length > 0) {
          ctx += ` (aliases: ${char.aliases.join(', ')})`;
        }
        ctx += ` - ${char.mentionCount} mentions\n`;
      }
      ctx += '\n';
    }
  }

  // Scene types in current chapter
  if (intelligence.full?.structural) {
    const scenes = intelligence.full.structural.scenes;
    const sceneTypes = [...new Set(scenes.map(s => s.type))];
    ctx += `Scene types in chapter: ${sceneTypes.join(', ')}\n`;
  }

  return ctx;
};

/**
 * Build editing-focused context (for edit tools)
 */
export const buildEditingContext = (state: AppBrainState): string => {
  const { manuscript, ui, intelligence } = state;
  let ctx = '[EDITING CONTEXT]\n\n';

  // Current text state
  ctx += `Current chapter: "${manuscript.chapters.find(c => c.id === manuscript.activeChapterId)?.title}"\n`;
  ctx += `Text length: ${manuscript.currentText.length} characters\n`;
  ctx += `Cursor at: ${ui.cursor.position}\n`;

  // Selection info
  if (ui.selection) {
    ctx += `\nSELECTED TEXT:\n"${ui.selection.text}"\n`;
    ctx += `[Position: ${ui.selection.start}-${ui.selection.end}]\n`;
  }

  // Style context for selection/cursor
  if (intelligence.hud) {
    ctx += `\nSTYLE CONTEXT:\n`;
    ctx += `Pacing: ${intelligence.hud.situational.pacing}\n`;
    ctx += `Tension: ${intelligence.hud.situational.tensionLevel}\n`;
    
    if (intelligence.hud.styleAlerts.length > 0) {
      ctx += `Alerts: ${intelligence.hud.styleAlerts.join('; ')}\n`;
    }
  }

  // Branching state
  if (manuscript.activeBranchId) {
    const branch = manuscript.branches.find(b => b.id === manuscript.activeBranchId);
    ctx += `\nOn branch: "${branch?.name || 'Unknown'}"\n`;
  }

  return ctx;
};

/**
 * Create context builder functions bound to current state
 */
export const createContextBuilder = (getState: () => AppBrainState): AppBrainContext => {
  return {
    getAgentContext: (options?: AgentContextOptions) => buildAgentContext(getState(), options),
    getAgentContextWithMemory: (projectId: string | null) => 
      buildAgentContextWithMemory(getState(), projectId),
    getCompressedContext: () => buildCompressedContext(getState()),
    getNavigationContext: () => buildNavigationContext(getState()),
    getEditingContext: () => buildEditingContext(getState()),
    getRecentEvents: (count?: number) => eventBus.getRecentEvents(count),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART CONTEXT (v1 Enhancement: Token + Memory combo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for getSmartAgentContext
 */
export interface SmartContextOptions {
  /** Context profile to use. If not provided, will be auto-selected. */
  profile?: ContextProfile;
  /** Model role for budget calculation */
  modelRole?: 'agent' | 'analysis';
  /** Memory relevance filters */
  relevance?: MemoryRelevanceOptions;
  /** Interaction mode for auto profile selection */
  mode?: 'text' | 'voice';
  /** Query type hint for auto profile selection */
  queryType?: 'editing' | 'analysis' | 'general';
}

/**
 * Unified entry point for smart agent context.
 * 
 * Combines:
 * - Model-aware token budgeting (from config/models.ts limits)
 * - Automatic context profile selection based on interaction state
 * - Relevance-filtered memory (prioritizes active entities, keywords)
 * - Adaptive section building with truncation
 * 
 * This is the "one obvious way" to get context for agent prompts.
 * 
 * @param state - Current AppBrainState
 * @param projectId - Project ID for memory retrieval
 * @param options - Configuration options
 * @returns AdaptiveContextResult with context string and diagnostics
 */
export async function getSmartAgentContext(
  state: AppBrainState,
  projectId: string | null,
  options: SmartContextOptions = {}
): Promise<AdaptiveContextResult> {
  const {
    modelRole = 'agent',
    mode = 'text',
    queryType = 'general',
    relevance = {},
  } = options;

  // Auto-select profile if not provided
  const profile = options.profile ?? selectContextProfile({
    mode,
    hasSelection: !!state.ui.selection,
    queryType,
  });

  // Get budget from model config
  const budget = getContextBudgetForModel(modelRole, profile);

  // Build relevance options from state if not provided
  const effectiveRelevance: MemoryRelevanceOptions = {
    activeEntityNames: relevance.activeEntityNames ?? 
      state.intelligence.hud?.context.activeEntities.map(e => e.name) ?? [],
    selectionKeywords: relevance.selectionKeywords ?? 
      (state.ui.selection?.text ? extractKeywords(state.ui.selection.text) : []),
    activeChapterId: relevance.activeChapterId ?? state.manuscript.activeChapterId ?? undefined,
  };

  // Build context with adaptive budgeting
  return buildAdaptiveContext(state, projectId, {
    budget,
    relevance: effectiveRelevance,
  });
}

/**
 * Extract simple keywords from text for memory matching.
 * Returns unique words > 3 chars, lowercased, limited to 10.
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Deduplicate and limit
  return [...new Set(words)].slice(0, 10);
}
