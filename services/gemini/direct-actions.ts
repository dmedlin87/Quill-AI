import { Type, UsageMetadata } from "@google/genai";
import { ModelConfig } from "../../config/models";
import { AIError, normalizeAIError } from "./errors";
import { ai } from "./client";
import {
  CONTEXTUAL_HELP_SYSTEM_INSTRUCTION,
  CONTINUATION_SYSTEM_INSTRUCTION,
  REWRITE_SYSTEM_INSTRUCTION,
} from "./prompts";
import { safeParseJsonWithValidation, validators } from "./resilientParser";

export const rewriteText = async (
  text: string,
  mode: string,
  tone?: string,
  setting?: { timePeriod: string; location: string },
  _signal?: AbortSignal,
): Promise<{ result: string[]; usage?: UsageMetadata }> => {
  if (_signal?.aborted) {
    return { result: [] };
  }

  const model = ModelConfig.analysis;

  const settingInstruction = setting
    ? `The manuscript is set in ${setting.timePeriod} in ${setting.location}. Ensure all language, objects, and dialogue are historically and geographically accurate to this setting.`
    : `Ensure the language matches the established tone of the text.`;

  const systemInstruction = REWRITE_SYSTEM_INSTRUCTION.replace(
    "{{SETTING_INSTRUCTION}}",
    settingInstruction,
  );

  const userMessage = `Original Text: "${text}"
Edit Mode: ${mode}
${mode === "Tone Tuner" ? `Target Tone: ${tone}` : ""}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["variations"],
        },
      },
    });

    const parseResult = safeParseJsonWithValidation(
      response.text,
      validators.isVariationsResponse,
      { variations: [] },
    );

    if (!parseResult.success) {
      console.warn("[rewriteText] Parse failed:", parseResult.error);
    }

    const data = parseResult.data as { variations: string[] };
    return {
      result: data.variations ?? [],
      usage: response.usageMetadata,
    };
  } catch (error) {
    if (_signal?.aborted) {
      return { result: [] };
    }

    const normalized = normalizeAIError(error, {
      mode,
      tone,
      textLength: text.length,
      hasSetting: Boolean(setting),
    });
    console.error("[rewriteText] Failed", normalized);
    throw normalized;
  }
};

export const generateContinuation = async (
  params: { context: string; selection?: string | null },
  _signal?: AbortSignal,
): Promise<{ result: string; usage?: UsageMetadata }> => {
  const model = ModelConfig.analysis;
  const { context, selection } = params;

  const prompt = selection
    ? `Selected text (continue seamlessly):\n${selection}\n\nSurrounding context:\n${context}`
    : `Manuscript context (continue seamlessly):\n${context}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: CONTINUATION_SYSTEM_INSTRUCTION,
      },
    });

    const continuation = response.text?.trim();

    if (!continuation) {
      throw new AIError("No continuation was returned from the model.");
    }

    return { result: continuation, usage: response.usageMetadata };
  } catch (error) {
    const normalized = normalizeAIError(error, { contextLength: context.length });
    console.error("[generateContinuation] Failed to generate continuation", normalized);
    throw normalized;
  }
};

export const getContextualHelp = async (
  text: string,
  type: "Explain" | "Thesaurus",
  _signal?: AbortSignal,
): Promise<{ result: string; usage?: UsageMetadata }> => {
  const model = ModelConfig.tools;

  const prompt = `Type: ${type}\nText: "${text}"\nKeep the answer short and helpful.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { systemInstruction: CONTEXTUAL_HELP_SYSTEM_INSTRUCTION },
  });

  return {
    result: response.text || "No result found.",
    usage: response.usageMetadata,
  };
};
