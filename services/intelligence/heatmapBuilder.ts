/**
 * Heatmap Builder
 * 
 * Risk scoring per section of the manuscript:
 * - Plot risk (unresolved hooks, contradictions)
 * - Pacing risk (long sentences, dense paragraphs)
 * - Character risk (passive protagonist, missing motivation)
 * - Setting risk (anachronism density)
 * - Style risk (writing quality issues)
 */

import {
  HeatmapSection,
  AttentionHeatmap,
  RiskFlag,
  StructuralFingerprint,
  EntityGraph,
  Timeline,
  StyleFingerprint,
} from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SIZE = 500; // Characters per section for analysis

const RISK_THRESHOLDS = {
  longSentence: 30,          // Words per sentence
  shortSentence: 5,          // Words per sentence
  highDialogue: 0.7,         // 70% dialogue is too much
  lowTension: 0.2,           // Below 0.2 is low tension
  passiveVoiceHigh: 3,       // Per 100 words
  adverbHigh: 4,             // Per 100 words
  filterWordHigh: 3,         // Per 100 words
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

const analyzeSection = (
  text: string,
  offset: number,
  structural: StructuralFingerprint,
  entities: EntityGraph,
  timeline: Timeline,
  style: StyleFingerprint
): HeatmapSection => {
  const length = Math.min(SECTION_SIZE, text.length - offset);
  const sectionText = text.slice(offset, offset + length);
  const flags: RiskFlag[] = [];
  const suggestions: string[] = [];
  
  // Find relevant structural data for this section
  const paragraphs = structural.paragraphs.filter(
    p => p.offset >= offset && p.offset < offset + length
  );
  
  const scenes = structural.scenes.filter(
    s => s.startOffset >= offset && s.startOffset < offset + length
  );
  
  // ─────────────────────────────────────────
  // PLOT RISK
  // ─────────────────────────────────────────
  let plotRisk = 0;
  
  // Check for unresolved promises in this section
  const unresolvedPromises = timeline.promises.filter(
    p => !p.resolved && p.offset >= offset && p.offset < offset + length
  );
  if (unresolvedPromises.length > 0) {
    plotRisk += 0.2 * unresolvedPromises.length;
    flags.push('unresolved_promise');
    suggestions.push(`${unresolvedPromises.length} plot thread(s) introduced here need resolution`);
  }
  
  // Check entity density (too few entities = potentially flat section)
  const sectionEntities = entities.nodes.filter(
    n => n.mentions.some(m => m.offset >= offset && m.offset < offset + length)
  );
  if (sectionEntities.length === 0 && length > 200) {
    plotRisk += 0.1;
    flags.push('character_absent');
    suggestions.push('Consider adding character presence to this section');
  }
  
  plotRisk = Math.min(1, plotRisk);
  
  // ─────────────────────────────────────────
  // PACING RISK
  // ─────────────────────────────────────────
  let pacingRisk = 0;
  
  // Check sentence lengths in this section
  const longSentences = paragraphs.filter(
    p => p.avgSentenceLength > RISK_THRESHOLDS.longSentence
  );
  if (longSentences.length > 0) {
    pacingRisk += 0.15 * longSentences.length;
    flags.push('long_sentences');
    suggestions.push('Break up long sentences for better pacing');
  }
  
  const shortSentences = paragraphs.filter(
    p => p.avgSentenceLength < RISK_THRESHOLDS.shortSentence && p.sentenceCount > 3
  );
  if (shortSentences.length > 2) {
    pacingRisk += 0.1;
    flags.push('short_sentences');
    suggestions.push('Vary sentence length for better rhythm');
  }
  
  // Check tension
  const avgTension = paragraphs.length > 0
    ? paragraphs.reduce((sum, p) => sum + p.tension, 0) / paragraphs.length
    : 0.5;
  
  if (avgTension < RISK_THRESHOLDS.lowTension) {
    pacingRisk += 0.2;
    flags.push('low_tension');
    flags.push('pacing_slow');
    suggestions.push('Consider adding tension or conflict');
  }
  
  // Check dialogue ratio
  const dialogueParagraphs = paragraphs.filter(p => p.type === 'dialogue');
  const dialogueRatio = paragraphs.length > 0 
    ? dialogueParagraphs.length / paragraphs.length 
    : 0;
  
  if (dialogueRatio > RISK_THRESHOLDS.highDialogue) {
    pacingRisk += 0.15;
    flags.push('dialogue_heavy');
    suggestions.push('Balance dialogue with action or description');
  }
  
  // Check for exposition dumps
  const expositionParagraphs = paragraphs.filter(p => p.type === 'exposition');
  if (expositionParagraphs.length > 3) {
    pacingRisk += 0.2;
    flags.push('exposition_dump');
    suggestions.push('Break up exposition with action or dialogue');
  }
  
  pacingRisk = Math.min(1, pacingRisk);
  
  // ─────────────────────────────────────────
  // CHARACTER RISK
  // ─────────────────────────────────────────
  let characterRisk = 0;
  
  // Check if main characters are present
  const topCharacters = entities.nodes
    .filter(n => n.type === 'character')
    .slice(0, 3);
  
  const presentCharacters = topCharacters.filter(
    c => c.mentions.some(m => m.offset >= offset && m.offset < offset + length)
  );
  
  if (presentCharacters.length === 0 && topCharacters.length > 0 && length > 300) {
    characterRisk += 0.2;
    flags.push('character_absent');
    suggestions.push('Main characters are absent from this section');
  }
  
  characterRisk = Math.min(1, characterRisk);
  
  // ─────────────────────────────────────────
  // SETTING RISK
  // ─────────────────────────────────────────
  let settingRisk = 0;
  
  // Check if location is established
  const locationEntities = entities.nodes.filter(n => n.type === 'location');
  const presentLocations = locationEntities.filter(
    l => l.mentions.some(m => m.offset >= offset && m.offset < offset + length)
  );
  
  if (presentLocations.length === 0 && scenes.length > 0 && !scenes[0].location) {
    settingRisk += 0.15;
    flags.push('setting_unclear');
    suggestions.push('Consider establishing the setting more clearly');
  }
  
  settingRisk = Math.min(1, settingRisk);
  
  // ─────────────────────────────────────────
  // STYLE RISK
  // ─────────────────────────────────────────
  let styleRisk = 0;
  
  // Check passive voice in this section
  const passiveInSection = style.flags.passiveVoiceInstances.filter(
    p => p.offset >= offset && p.offset < offset + length
  );
  if (passiveInSection.length >= 2) {
    styleRisk += 0.1 * passiveInSection.length;
    flags.push('passive_voice_heavy');
    suggestions.push('Reduce passive voice for stronger prose');
  }
  
  // Check adverbs
  const adverbsInSection = style.flags.adverbInstances.filter(
    a => a.offset >= offset && a.offset < offset + length
  );
  if (adverbsInSection.length >= 3) {
    styleRisk += 0.05 * adverbsInSection.length;
    flags.push('adverb_overuse');
    suggestions.push('Consider stronger verbs instead of adverbs');
  }
  
  // Check filter words
  const filterWordsInSection = style.flags.filterWordInstances.filter(
    f => f.offset >= offset && f.offset < offset + length
  );
  if (filterWordsInSection.length >= 2) {
    styleRisk += 0.1 * filterWordsInSection.length;
    flags.push('filter_words');
    suggestions.push('Show instead of filtering through character perception');
  }
  
  styleRisk = Math.min(1, styleRisk);
  
  // ─────────────────────────────────────────
  // OVERALL RISK
  // ─────────────────────────────────────────
  const overallRisk = (
    plotRisk * 0.25 +
    pacingRisk * 0.25 +
    characterRisk * 0.2 +
    settingRisk * 0.1 +
    styleRisk * 0.2
  );
  
  return {
    offset,
    length,
    scores: {
      plotRisk,
      pacingRisk,
      characterRisk,
      settingRisk,
      styleRisk,
    },
    overallRisk,
    flags: [...new Set(flags)], // Dedupe
    suggestions: [...new Set(suggestions)].slice(0, 5),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const buildHeatmap = (
  text: string,
  structural: StructuralFingerprint,
  entities: EntityGraph,
  timeline: Timeline,
  style: StyleFingerprint
): AttentionHeatmap => {
  const sections: HeatmapSection[] = [];
  
  // Analyze each section
  for (let offset = 0; offset < text.length; offset += SECTION_SIZE) {
    sections.push(analyzeSection(
      text,
      offset,
      structural,
      entities,
      timeline,
      style
    ));
  }
  
  // Find hotspots (sections with high overall risk)
  const hotspots = sections
    .filter(s => s.overallRisk > 0.5)
    .map(s => ({
      offset: s.offset,
      reason: s.flags[0] || 'Multiple issues',
      severity: s.overallRisk,
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 10);
  
  return {
    sections,
    hotspots,
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getSectionAtOffset = (
  heatmap: AttentionHeatmap,
  offset: number
): HeatmapSection | null => {
  return heatmap.sections.find(
    s => offset >= s.offset && offset < s.offset + s.length
  ) || null;
};

export const getHighRiskSections = (
  heatmap: AttentionHeatmap,
  threshold: number = 0.5
): HeatmapSection[] => {
  return heatmap.sections
    .filter(s => s.overallRisk >= threshold)
    .sort((a, b) => b.overallRisk - a.overallRisk);
};

export const getSuggestionsForRange = (
  heatmap: AttentionHeatmap,
  startOffset: number,
  endOffset: number
): string[] => {
  const suggestions: string[] = [];
  
  for (const section of heatmap.sections) {
    const overlapsRange =
      section.offset < endOffset &&
      section.offset + section.length > startOffset;

    if (overlapsRange) {
      suggestions.push(...section.suggestions);
    }
  }
  
  return [...new Set(suggestions)];
};

export const getRiskSummary = (heatmap: AttentionHeatmap): {
  avgRisk: number;
  topIssues: RiskFlag[];
  hotspotCount: number;
} => {
  const avgRisk = heatmap.sections.length > 0
    ? heatmap.sections.reduce((sum, s) => sum + s.overallRisk, 0) / heatmap.sections.length
    : 0;
  
  // Count all flags
  const flagCounts = new Map<RiskFlag, number>();
  for (const section of heatmap.sections) {
    for (const flag of section.flags) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }
  
  const topIssues = Array.from(flagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([flag]) => flag);
  
  return {
    avgRisk,
    topIssues,
    hotspotCount: heatmap.hotspots.length,
  };
};
