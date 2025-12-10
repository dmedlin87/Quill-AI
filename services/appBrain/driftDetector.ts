import { ManuscriptIntelligence } from '@/types/intelligence';
import { BedsideNoteContent, BedsideNoteConflict, BedsideNoteGoalSummary } from '@/services/memory/types';

/**
 * Heuristics-based drift detection.
 * Compares the "Reality" (Intelligence) against the "Intent" (Bedside Note).
 */

const PACING_KEYWORDS = {
  slow: ['slow', 'introspection', 'quiet', 'calm', 'relax', 'breather'],
  fast: ['fast', 'action', 'fight', 'run', 'chase', 'tense', 'urgent', 'rush'],
};

const TENSION_THRESHOLD_HIGH = 0.7;
const TENSION_THRESHOLD_LOW = 0.3;

export function checkNarrativeDrift(
  intelligence: ManuscriptIntelligence,
  plan: BedsideNoteContent
): BedsideNoteConflict[] {
  const conflicts: BedsideNoteConflict[] = [];

  // 1. Check Active Goals vs Entity Presence
  // If a goal explicitly mentions a character, they should probably be in the scene.
  if (plan.activeGoals) {
    for (const goal of plan.activeGoals) {
      if (goal.status !== 'active') continue;

      const mentionedEntities = findEntitiesInText(goal.title, intelligence);
      for (const entityName of mentionedEntities) {
        const entity = intelligence.entities.nodes.find(
          n => n.name.toLowerCase() === entityName.toLowerCase() || n.aliases.includes(entityName)
        );

        // If entity is "missing" (not in nodes or very low mention count)
        // Note: intelligence.entities usually contains ALL entities found in the text.
        // If the goal is "Develop Seth's backstory" and Seth isn't in the chapter, that's a potential drift IF this chapter was meant to address it.
        // But maybe this chapter is about someone else.
        // Hard to say without "Chapter Goals" (Phase 6).
        // For project-level goals, this is weak.
        // SKIPPING for now to avoid noise.
      }
    }
  }

  // 2. Check Pacing/Tone Alignment
  // If current focus or goals mention pacing keywords, check structural stats.
  const intentText = [
    plan.currentFocus,
    ...(plan.activeGoals?.map(g => g.title) ?? [])
  ].join(' ').toLowerCase();

  const impliesSlow = PACING_KEYWORDS.slow.some(k => intentText.includes(k));
  const impliesFast = PACING_KEYWORDS.fast.some(k => intentText.includes(k));

  const actualTension = intelligence.structural.stats.avgTension; // 0 to 1

  if (impliesSlow && actualTension > TENSION_THRESHOLD_HIGH) {
    conflicts.push({
      previous: `Plan implies slower pacing/introspection.`,
      current: `Manuscript tension is high (${Math.round(actualTension * 100)}%).`,
      confidence: 0.8,
      strategy: 'heuristic',
      resolution: 'unresolved'
    });
  }

  if (impliesFast && actualTension < TENSION_THRESHOLD_LOW) {
    conflicts.push({
      previous: `Plan implies fast pacing/action.`,
      current: `Manuscript tension is low (${Math.round(actualTension * 100)}%).`,
      confidence: 0.8,
      strategy: 'heuristic',
      resolution: 'unresolved'
    });
  }

  // 3. Unresolved Promises (Direct Contradiction)
  // If goal says "Resolve X" but X is definitely NOT resolved in the text, we can't easily check 'resolved' state from text alone without model.
  // But we can check if a "Promise" tracked by intelligence is marked resolved.
  
  // Rule: If plan has active goal "X", and intelligence has promise "X" marked RESOLVED, 
  // then the goal is stale (user forgot to complete it).
  if (plan.activeGoals) {
    for (const goal of plan.activeGoals) {
      if (goal.status !== 'active') continue;

      const matchingPromise = intelligence.timeline.promises.find(
        p => p.resolved && (
             p.description.toLowerCase().includes(goal.title.toLowerCase()) || 
             goal.title.toLowerCase().includes(p.description.toLowerCase())
        )
      );

      if (matchingPromise) {
        conflicts.push({
          previous: `Goal "${goal.title}" is active.`,
          current: `Manuscript has resolved promise "${matchingPromise.description}".`,
          confidence: 0.9,
          strategy: 'heuristic',
          resolution: 'unresolved'
        });
      }
    }
  }

  return conflicts;
}

function findEntitiesInText(text: string, intelligence: ManuscriptIntelligence): string[] {
  // Simple check against known entity names or aliases in the intelligence graph
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const node of intelligence.entities.nodes) {
    if (node.type !== 'character') continue;

    const normalizedName = node.name.toLowerCase();
    if (lowerText.includes(normalizedName)) {
      found.push(node.name);
      continue;
    }

    for (const alias of node.aliases ?? []) {
      const normalizedAlias = alias.toLowerCase();
      if (lowerText.includes(normalizedAlias)) {
        found.push(alias);
        break;
      }
    }
  }

  return found;
}
