import { AnalysisResult, CharacterProfile } from "../../types";
import { Lore } from "../../types/schema";
import { ManuscriptHUD, VoiceFingerprint } from "../../types/intelligence";
import { MicrophoneState, UIState, AppEvent } from "../appBrain/types";

/**
 * Build a roleplay interview block for a character, preserving manuscript context.
 */
export const buildInterviewInstruction = (
  baseInstruction: string,
  character: CharacterProfile
): string => {
  const voice = character.voiceTraits?.trim() || "Consistent with bio";
  const relationships =
    (character.relationships || []).length > 0
      ? character.relationships
          .map(
            (rel) =>
              `- ${rel.name} (${rel.type})${
                rel.dynamic ? `: ${rel.dynamic}` : ""
              }`
          )
          .join("\n")
      : "- None noted.";
  const plotThreads =
    (character.plotThreads || []).length > 0
      ? character.plotThreads.map((thread) => `- ${thread}`).join("\n")
      : "- None noted.";

  const interviewBlock = `
[INTERVIEW MODE: ${character.name}]
You are ${character.name}. This is a roleplay interview. Do not break character.

YOUR IDENTITY:
Bio: ${character.bio || "No biography provided."}
Arc: ${character.arc || "No arc provided."}
Voice: ${voice}

CONTEXT:
You are aware of the story world defined in the Lore.
Relationships:
${relationships}
Plot Threads:
${plotThreads}

You are talking to your Author. Answer their questions to help them write you better.
`;

  return baseInstruction.replace(
    "[FULL MANUSCRIPT CONTEXT]",
    `${interviewBlock}\n\n[FULL MANUSCRIPT CONTEXT]`
  );
};

/**
 * Build intelligence context string from ManuscriptHUD for AI consumption
 */
export const buildIntelligenceContext = (hud: ManuscriptHUD): string => {
  const { situational, context, styleAlerts, prioritizedIssues, stats } = hud;

  let ctx = `[INTELLIGENCE HUD - Real-time Awareness]\n\n`;

  ctx += `[CURRENT POSITION]\n`;
  if (situational.currentScene) {
    ctx += `Scene Type: ${situational.currentScene.type}\n`;
    if (situational.currentScene.pov) {
      ctx += `POV Character: ${situational.currentScene.pov}\n`;
    }
    if (situational.currentScene.location) {
      ctx += `Location: ${situational.currentScene.location}\n`;
    }
    ctx += `Tension: ${situational.tensionLevel.toUpperCase()}\n`;
    ctx += `Dialogue Ratio: ${Math.round(
      situational.currentScene.dialogueRatio * 100
    )}%\n`;
  }
  ctx += `Pacing: ${situational.pacing}\n`;
  ctx += `Progress: Scene ${situational.narrativePosition.sceneIndex} of ${
    situational.narrativePosition.totalScenes
  } (${situational.narrativePosition.percentComplete}%)\n\n`;

  if (context.activeEntities.length > 0) {
    ctx += `[ACTIVE CHARACTERS/ENTITIES]\n`;
    for (const entity of context.activeEntities.slice(0, 6)) {
      ctx += `• ${entity.name} (${entity.type}) - ${entity.mentionCount} mentions`;
      if (entity.aliases.length > 0) {
        ctx += ` [aliases: ${entity.aliases.slice(0, 2).join(", ")}]`;
      }
      ctx += `\n`;
    }
    ctx += `\n`;
  }

  if (context.activeRelationships.length > 0) {
    ctx += `[KEY RELATIONSHIPS IN SCENE]\n`;
    for (const rel of context.activeRelationships.slice(0, 5)) {
      const source = context.activeEntities.find((e) => e.id === rel.source);
      const target = context.activeEntities.find((e) => e.id === rel.target);
      if (source && target) {
        ctx += `• ${source.name} ←${rel.type}→ ${target.name} (${rel.coOccurrences} interactions)\n`;
      }
    }
    ctx += `\n`;
  }

  if (context.openPromises.length > 0) {
    ctx += `[OPEN PLOT THREADS - Need Resolution]\n`;
    for (const promise of context.openPromises) {
      ctx += `⚡ [${promise.type.toUpperCase()}] ${promise.description.slice(
        0,
        80
      )}...\n`;
    }
    ctx += `\n`;
  }

  if (context.recentEvents.length > 0) {
    ctx += `[RECENT NARRATIVE EVENTS]\n`;
    for (const event of context.recentEvents.slice(-3)) {
      ctx += `→ ${event.description.slice(0, 60)}`;
      if (event.temporalMarker) {
        ctx += ` (${event.temporalMarker})`;
      }
      ctx += `\n`;
    }
    ctx += `\n`;
  }

  if (styleAlerts.length > 0) {
    ctx += `[STYLE ALERTS]\n`;
    for (const alert of styleAlerts) {
      ctx += `⚠️ ${alert}\n`;
    }
    ctx += `\n`;
  }

  if (prioritizedIssues.length > 0) {
    ctx += `[PRIORITY ISSUES TO ADDRESS]\n`;
    for (const issue of prioritizedIssues) {
      const icon = issue.severity > 0.7 ? "🔴" : issue.severity > 0.4 ? "🟡" : "🟢";
      ctx += `${icon} ${issue.description}\n`;
    }
    ctx += `\n`;
  }

  ctx += `[MANUSCRIPT METRICS]\n`;
  ctx += `Words: ${stats.wordCount.toLocaleString()} | `;
  ctx += `Reading: ~${stats.readingTime} min | `;
  ctx += `Dialogue: ${stats.dialoguePercent}% | `;
  ctx += `Avg Sentence: ${stats.avgSentenceLength} words\n`;

  return ctx;
};

export class PromptBuilder {
  private readonly template: string;
  private intensityModifier = "";
  private loreContext = "";
  private analysisContext = "";
  private memoryContext = "";
  private fullManuscript = "No manuscript content loaded.";
  private experienceModifier = "";
  private autonomyModifier = "";
  private extraBlocks: string[] = [];

  constructor(template: string) {
    this.template = template;
  }

  setIntensity(modifier: string): this {
    this.intensityModifier = modifier;
    return this;
  }

  addLore(lore?: Lore): this {
    if (!lore) return this;

    const chars = lore.characters
      .map(
        (c) => `
    - Name: ${c.name}
    - Bio: ${c.bio}
    - Arc Summary: ${c.arc}
    - Key Development Suggestion: ${c.developmentSuggestion}
    - Known Inconsistencies: ${c.inconsistencies
      .map((i) => i.issue)
      .join(", ") || "None"}
    `
      )
      .join("\n");

    const rules = lore.worldRules.map((r) => `- ${r}`).join("\n");

    this.loreContext = `
    [LORE BIBLE & CONTEXTUAL MEMORY]
    Do not contradict these established facts about the story.
    
    CHARACTERS:
    ${chars}
    
    WORLD RULES / SETTING DETAILS:
    ${rules}
    `;

    return this;
  }

  addAnalysis(
    analysis?: AnalysisResult,
    voiceFingerprint?: VoiceFingerprint,
    deepAnalysis?: boolean
  ): this {
    if (!analysis) return this;

    let analysisContext = `
    [DEEP ANALYSIS INSIGHTS]
    Use these insights to answer questions about plot holes, pacing, and character arcs.
    
    SUMMARY: ${analysis.summary}
    STRENGTHS: ${analysis.strengths.join(", ")}
    WEAKNESSES: ${analysis.weaknesses.join(", ")}
    
    PLOT ISSUES:
    ${analysis.plotIssues
      .map((p) => `- ${p.issue} (Fix: ${p.suggestion})`)
      .join("\n")}
    
    CHARACTERS (FROM ANALYSIS):
    ${analysis.characters
      .map((c) => `- ${c.name}: ${c.arc} (Suggestion: ${c.developmentSuggestion})`)
      .join("\n")}
    `;

    if (deepAnalysis && voiceFingerprint && Object.keys(voiceFingerprint.profiles).length > 0) {
      const profiles = Object.values(voiceFingerprint.profiles);
      let voiceContext = `
    [DEEP ANALYSIS: VOICE FINGERPRINTS]
    `;
      for (const profile of profiles.slice(0, 5)) {
        const latinatePct = Math.round(profile.metrics.latinateRatio * 100);
        const contractionPct = Math.round(profile.metrics.contractionRatio * 100);
        voiceContext += `• ${profile.speakerName}: ${profile.impression} (${latinatePct}% Formal, ${contractionPct}% Casual).\n`;
      }
      voiceContext += "Use these metrics to ensure character voice consistency.\n";

      analysisContext += `\n${voiceContext}`;
    }

    this.analysisContext = analysisContext;
    return this;
  }

  addContext(options: {
    fullManuscriptContext?: string;
    memoryContext?: string;
    defaultMemoryContext: string;
    experienceModifier: string;
    autonomyModifier: string;
    intelligenceHUD?: ManuscriptHUD;
  }): this {
    const {
      fullManuscriptContext,
      memoryContext,
      defaultMemoryContext,
      experienceModifier,
      autonomyModifier,
      intelligenceHUD,
    } = options;

    if (fullManuscriptContext) {
      this.fullManuscript = fullManuscriptContext;
    }

    this.memoryContext = memoryContext || defaultMemoryContext;
    this.experienceModifier = experienceModifier;
    this.autonomyModifier = autonomyModifier;

    if (intelligenceHUD) {
      const intelligenceContext = buildIntelligenceContext(intelligenceHUD);
      this.extraBlocks.push(intelligenceContext);
    }

    return this;
  }

  build(): string {
    let systemInstruction = this.template
      .replace("{{INTENSITY_MODIFIER}}", this.intensityModifier)
      .replace("{{LORE_CONTEXT}}", this.loreContext)
      .replace("{{ANALYSIS_CONTEXT}}", this.analysisContext)
      .replace("{{MEMORY_CONTEXT}}", this.memoryContext)
      .replace("{{FULL_MANUSCRIPT}}", this.fullManuscript);

    if (this.experienceModifier || this.autonomyModifier) {
      systemInstruction += `\n\n${this.experienceModifier}\n\n${this.autonomyModifier}`;
    }

    if (this.extraBlocks.length > 0) {
      systemInstruction += `\n\n${this.extraBlocks.join("\n\n")}`;
    }

    return systemInstruction;
  }
}

const formatPreview = (value: string, limit = 120) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

export const buildAgentMessageContext = (options: {
  smartContext: string;
  mode: "text" | "voice";
  microphone: MicrophoneState;
  ui: UIState;
  recentEvents: AppEvent[];
  userMessage: string;
}): string => {
  const { smartContext, mode, microphone, ui, recentEvents, userMessage } = options;
  const eventsText =
    recentEvents.length > 0
      ? [...recentEvents]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-5)
          .map(
            (ev) =>
              `${timeFormatter.format(ev.timestamp)} UTC: ${ev.type}`
          )
          .join("\n")
      : "None";

  const selectionPreview = ui.selection
    ? `"${formatPreview(ui.selection.text, 100)}"`
    : "None";

  return `
[CURRENT CONTEXT]
${smartContext}

[INPUT MODE]
Agent mode: ${mode}. Microphone: ${microphone.status}${
    microphone.lastTranscript
      ? ` (last transcript: "${formatPreview(microphone.lastTranscript)}")`
      : ""
  }.

[USER STATE]
Cursor: ${ui.cursor.position}
Selection: ${selectionPreview}

[RECENT EVENTS]
${eventsText}

[USER REQUEST]
${userMessage}
`;
};
