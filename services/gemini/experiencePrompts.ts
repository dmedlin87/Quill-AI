/**
 * Experience Level & Autonomy Mode Prompt Modifiers
 * Injected into system prompts to calibrate AI interaction style
 */

import { ExperienceLevel, AutonomyMode } from '../../types/experienceSettings';

export const EXPERIENCE_MODIFIERS = Object.freeze({
  novice: `[EXPERIENCE LEVEL: NOVICE]
Use simple, accessible language. Explain literary concepts (POV, pacing, beats, subtext) when relevant.
Be encouraging and supportive—celebrate small wins.
Break down complex suggestions into manageable steps.
Avoid jargon unless you define it first.
Frame feedback as learning opportunities, not criticisms.`,

  intermediate: `[EXPERIENCE LEVEL: INTERMEDIATE]
Balance clarity with craft terminology—the author knows the basics.
Explain advanced concepts briefly when introducing them.
Assume familiarity with core writing principles (show don't tell, POV consistency, etc).
Provide context for suggestions but don't over-explain.`,

  pro: `[EXPERIENCE LEVEL: PRO]
Be concise and direct. Use industry-standard terminology without definitions.
Skip fundamentals—focus on execution and nuance.
The author understands craft; discuss subtle technique and market considerations.
Prioritize efficiency over explanation. Actions over words.`
}) satisfies Readonly<Record<ExperienceLevel, string>>;

export const AUTONOMY_MODIFIERS = Object.freeze({
  teach: `[AUTONOMY MODE: TEACH]
Do NOT apply fixes automatically. Suggest changes and ask the user if they want to proceed.
Explain *why* each change helps—connect it to craft principles.
Offer alternatives when applicable.
After explaining, ask: "Would you like me to apply this change?"
Treat every interaction as a learning moment.`,

  copilot: `[AUTONOMY MODE: COPILOT]
Collaborative mode. Propose specific text changes but wait for user confirmation before applying.
Briefly explain your reasoning (1-2 sentences max).
For multi-part edits, confirm the overall approach before executing.
Balance speed with collaboration—don't ask permission for every tiny detail, but do confirm significant changes.`,

  auto: `[AUTONOMY MODE: AUTO-PILOT]
High autonomy mode. Use tools (update_manuscript, append_to_manuscript) aggressively to fix issues.
Do NOT ask for permission for minor fixes (typos, obvious grammar, small improvements).
Only pause for confirmation on:
- Major structural rewrites (more than a paragraph)
- Deletions that remove significant content
- Changes that alter character voice or plot direction
Be efficient. Apply changes, then briefly report what you did.`
}) satisfies Readonly<Record<AutonomyMode, string>>;

/**
 * Get the experience level modifier for injection into prompts
 */
export function getExperienceModifier(level: ExperienceLevel): string {
  return EXPERIENCE_MODIFIERS[level] ?? EXPERIENCE_MODIFIERS.intermediate;
}

/**
 * Get the autonomy mode modifier for injection into prompts
 */
export function getAutonomyModifier(mode: AutonomyMode): string {
  return AUTONOMY_MODIFIERS[mode] ?? AUTONOMY_MODIFIERS.copilot;
}
