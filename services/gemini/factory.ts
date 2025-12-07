import type { Chat, Content, CreateChatParameters } from "@google/genai";
import { ModelConfig } from "../../config/models";
import { AIError, normalizeAIError } from "./errors";
import { ai } from "./client";
import { AGENT_SYSTEM_INSTRUCTION } from "./prompts";
import { getIntensityModifier } from "./critiquePrompts";
import { getExperienceModifier, getAutonomyModifier } from "./experiencePrompts";
import {
  ALL_AGENT_TOOLS,
  VOICE_SAFE_TOOLS,
  QUICK_TOOLS,
  NAVIGATION_TOOLS,
  EDITING_TOOLS,
  ANALYSIS_TOOLS,
  UI_CONTROL_TOOLS,
  KNOWLEDGE_TOOLS,
  GENERATION_TOOLS,
} from "./agentTools";
import {
  PromptBuilder,
  buildInterviewInstruction,
} from "./serializers";
import { Persona, buildPersonaInstruction } from "../../types/personas";
import {
  CritiqueIntensity,
  DEFAULT_CRITIQUE_INTENSITY,
} from "../../types/critiqueSettings";
import {
  ExperienceLevel,
  AutonomyMode,
  DEFAULT_EXPERIENCE,
  DEFAULT_AUTONOMY,
} from "../../types/experienceSettings";
import { AnalysisResult, CharacterProfile } from "../../types";
import { Lore } from "../../types/schema";
import { ManuscriptHUD, VoiceFingerprint } from "../../types/intelligence";

export {
  ALL_AGENT_TOOLS,
  VOICE_SAFE_TOOLS,
  QUICK_TOOLS,
  NAVIGATION_TOOLS,
  EDITING_TOOLS,
  ANALYSIS_TOOLS,
  UI_CONTROL_TOOLS,
  KNOWLEDGE_TOOLS,
  GENERATION_TOOLS,
};

export interface CreateAgentSessionOptions {
  lore?: Lore;
  analysis?: AnalysisResult;
  fullManuscriptContext?: string;
  persona?: Persona;
  intensity?: CritiqueIntensity;
  experience?: ExperienceLevel;
  autonomy?: AutonomyMode;
  intelligenceHUD?: ManuscriptHUD;
  interviewTarget?: CharacterProfile;
  /** Pre-formatted memory context string (from buildAgentContextWithMemory) */
  memoryContext?: string;
  /** Optional voice fingerprint for deep analysis mode */
  voiceFingerprint?: VoiceFingerprint;
  /** If true, include deep voice analytics in the system prompt */
  deepAnalysis?: boolean;
  /** Switch to a voice-safe model/toolset */
  mode?: "text" | "voice";
  /** Optional prior conversation history to preserve context on re-init */
  conversationHistory?: Content[];
}

export const createAgentSession = (
  options: CreateAgentSessionOptions = {},
) => {
  const {
    lore,
    analysis,
    fullManuscriptContext,
    persona,
    intensity = DEFAULT_CRITIQUE_INTENSITY,
    experience = DEFAULT_EXPERIENCE,
    autonomy = DEFAULT_AUTONOMY,
    intelligenceHUD,
    interviewTarget,
    memoryContext,
    voiceFingerprint,
    deepAnalysis,
    mode = "text",
    conversationHistory,
  } = options;

  const intensityModifier = getIntensityModifier(intensity);
  const experienceModifier = getExperienceModifier(experience);
  const autonomyModifier = getAutonomyModifier(autonomy);

  const builder = new PromptBuilder(AGENT_SYSTEM_INSTRUCTION)
    .setIntensity(intensityModifier)
    .addLore(lore)
    .addAnalysis(analysis, voiceFingerprint, deepAnalysis)
    .addContext({
      fullManuscriptContext,
      memoryContext,
      defaultMemoryContext:
        "[AGENT MEMORY]\n(No memories loaded yet. Use memory tools to start building your knowledge base.)",
      experienceModifier,
      autonomyModifier,
      intelligenceHUD,
    });

  let systemInstruction = builder.build();

  if (interviewTarget) {
    systemInstruction = buildInterviewInstruction(
      systemInstruction,
      interviewTarget,
    );
  } else if (persona) {
    systemInstruction = buildPersonaInstruction(systemInstruction, persona);
  }

  const toolset = mode === "voice" ? VOICE_SAFE_TOOLS : ALL_AGENT_TOOLS;
  const model = mode === "voice" ? ModelConfig.liveAudio : ModelConfig.agent;

  const chatParams: CreateChatParameters = {
    model,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: toolset }],
    },
  };

  if (conversationHistory && conversationHistory.length > 0) {
    chatParams.history = conversationHistory;
  }

  return ai.chats.create(chatParams);
};

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use createAgentSession with options object instead
 */
export const createAgentSessionLegacy = (
  lore?: Lore,
  analysis?: AnalysisResult,
  fullManuscriptContext?: string,
  persona?: Persona,
  intensity: CritiqueIntensity = DEFAULT_CRITIQUE_INTENSITY,
  experience: ExperienceLevel = DEFAULT_EXPERIENCE,
  autonomy: AutonomyMode = DEFAULT_AUTONOMY,
  intelligenceHUD?: ManuscriptHUD,
  interviewTarget?: CharacterProfile,
) =>
  createAgentSession({
    lore,
    analysis,
    fullManuscriptContext,
    persona,
    intensity,
    experience,
    autonomy,
    intelligenceHUD,
    interviewTarget,
  });

export interface QuillAgentOptions extends CreateAgentSessionOptions {
  /** Optional telemetry / logging context */
  telemetryContext?: Record<string, unknown>;
}

export class QuillAgent {
  private session: Chat | null = null;

  constructor(private readonly options: QuillAgentOptions) {}

  /**
   * Initializes the underlying Gemini Chat session.
   * Must be called before sendMessage.
   */
  async initialize(): Promise<void> {
    if (this.session) return;
    try {
      this.session = await createAgentSession(this.options);
    } catch (error) {
      throw normalizeAIError(error, {
        phase: "initialize",
        source: "QuillAgent",
        ...this.options.telemetryContext,
      });
    }
  }

  /**
   * Thin wrapper over Chat.sendMessage that normalizes SDK errors
   * into typed AIError instances.
   */
  async sendMessage(
    payload: Parameters<Chat["sendMessage"]>[0],
  ): Promise<Awaited<ReturnType<Chat["sendMessage"]>>> {
    const session = this.getSessionOrThrow();

    try {
      const result = await session.sendMessage(payload);
      return result as Awaited<ReturnType<Chat["sendMessage"]>>;
    } catch (error) {
      throw normalizeAIError(error, {
        phase: "sendMessage",
        source: "QuillAgent",
        ...this.options.telemetryContext,
      });
    }
  }

  /**
   * Convenience helper for plain-text prompts.
   */
  async sendText(message: string): Promise<string> {
    const result = await this.sendMessage({ message });
    return (result as any)?.text ?? "";
  }

  private getSessionOrThrow(): Chat {
    if (!this.session) {
      throw new AIError(
        "Agent session is not initialized. Call initialize() before sendMessage().",
      );
    }
    return this.session;
  }
}
