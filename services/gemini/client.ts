/**
 * Gemini API Client with Smart Logic
 * 
 * Includes:
 * - Dynamic key switching (Free -> Paid)
 * - Free Mode fallback logic (Pro -> Flash)
 * - Quota exhaustion event handling
 */

import { GoogleGenAI, GenerateContentRequest, GenerateContentResult } from "@google/genai";
import { getApiKey, validateApiKey, getActiveApiKey, markFreeQuotaExhausted, isUsingPaidKey } from "../../config/api";
import { getActiveModelBuild, ModelBuilds, ModelBuildKey } from "../../config/models";
import { eventBus } from "../appBrain/eventBus";

// Initialize with environment key (for initial load)
const initialApiKey = getApiKey();

// Validate on initialization
const validationError = validateApiKey(initialApiKey);
if (validationError) {
  console.warn(`[Quill AI API] ${validationError}`);
}

/**
 * Primary Gemini AI client instance.
 */
const createClient = (Ctor: any, options: { apiKey: string }): GoogleGenAI => {
  try {
    return new Ctor(options);
  } catch {
    return Ctor(options);
  }
};

const buildClient = (apiKey?: string): GoogleGenAI => {
  const key = apiKey ?? getActiveApiKey();
  const error = validateApiKey(key);
  
  if (error) {
    const errorObj = new Error(`[Quill AI API] ${error}`);
    return new Proxy(
      {},
      {
        get() {
          throw errorObj;
        },
      },
    ) as GoogleGenAI;
  }

  return createClient(GoogleGenAI as any, { apiKey: key });
};

// Track the current API key to detect changes
let currentApiKey = getActiveApiKey();
let aiClient = buildClient(currentApiKey);

/**
 * Get the AI client, rebuilding if the API key has changed.
 */
export function getAiClient(): GoogleGenAI {
  const activeKey = getActiveApiKey();
  if (activeKey !== currentApiKey) {
    currentApiKey = activeKey;
    aiClient = buildClient(activeKey);
  }
  return aiClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART GENERATION WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

type GenerateContentFunc = (request: GenerateContentRequest | string) => Promise<GenerateContentResult>;

/**
 * Extracts model ID from request object or string.
 */
function getModelId(request: GenerateContentRequest | string, defaultModel: string): string {
  if (typeof request === 'string') return defaultModel;
  return request.model || defaultModel;
}

/**
 * Smart wrapper for generateContent that handles:
 * 1. 429 Errors (Quota Exhausted)
 * 2. Automatic Key Switching (Normal/Cheap modes)
 * 3. Model Fallback (Free mode: Pro -> Flash)
 * 4. User Prompting (Free mode exhausted)
 */
async function smartGenerateContent(
  originalMethod: GenerateContentFunc,
  request: GenerateContentRequest | string
): Promise<GenerateContentResult> {
  const buildKey = getActiveModelBuild();
  const client = getAiClient();

  // Helper to ensure request has a model ID
  const ensureRequestWithModel = (req: GenerateContentRequest | string, modelId: string): GenerateContentRequest => {
    if (typeof req === 'string') {
      return { model: modelId, contents: [{ role: 'user', parts: [{ text: req }] }] };
    }
    return { ...req, model: req.model || modelId };
  };

  try {
    // Attempt 1: Direct call
    // Note: We use call() to preserve 'this' context if needed, though GoogleGenAI might not need it
    // But safely binding to client.models is safer
    return await originalMethod.call(client.models, request);
  } catch (error: any) {
    // Check for 429 or 503 (sometimes transient, but 429 is quota)
    // Some libraries might wrap error in response
    const status = error?.status || error?.response?.status;
    const isQuotaError = status === 429 || error?.message?.includes('429');

    if (!isQuotaError) {
      throw error;
    }

    console.warn(`[Quill AI] Quota exhausted (${buildKey} mode). Attempting recovery...`);

    // If we are already using the paid key, we can't switch keys. We might just be out of quota.
    // Or if paid key is not configured.
    const usingPaid = isUsingPaidKey();

    // RECOVERY STRATEGY BASED ON MODE

    // 1. NORMAL / CHEAP / DEFAULT (Behavior: Switch to Paid Key)
    if (buildKey !== 'free') {
      if (!usingPaid) {
        // Mark free exhausted -> API config switches to paid key next call
        markFreeQuotaExhausted();

        // Re-fetch client (it will now use paid key if available)
        const newClient = getAiClient();

        // Retry with new key
        try {
          console.info(`[Quill AI] Switching to Paid Key for ${buildKey} mode.`);
          // IMPORTANT: We must get the method from the NEW client
          return await newClient.models.generateContent(request);
        } catch (retryError) {
          // If paid key also fails, throw original or new error
          throw retryError;
        }
      }
    }

    // 2. FREE MODE (Behavior: Pro -> Flash -> Stop)
    if (buildKey === 'free') {
      const requestedModel = getModelId(request, '');
      const proModel = ModelBuilds?.free?.analysis?.id || 'gemini-3-pro-preview';
      const flashModel = ModelBuilds?.cheap?.analysis?.id || 'gemini-2.5-flash';

      // If we failed on Pro, try Flash
      // Note: We check if requestedModel "contains" proModel because some might append suffix
      if (requestedModel.includes(proModel) || requestedModel === '') {
        console.info(`[Quill AI] Free Pro quota exhausted. Falling back to Flash.`);

        // Construct new request with Flash model
        const fallbackRequest = ensureRequestWithModel(request, flashModel);

        try {
          return await client.models.generateContent(fallbackRequest);
        } catch (fallbackError: any) {
          const fallbackStatus = fallbackError?.status || fallbackError?.response?.status;
          const isFallbackQuota = fallbackStatus === 429 || fallbackError?.message?.includes('429');
          if (!isFallbackQuota) throw fallbackError;

          // Flash failed too. Proceed to exhaustion.
        }
      }

      // If we are here, either Flash failed, or we were already on Flash and it failed.
      console.warn(`[Quill AI] Free mode fully exhausted.`);
      eventBus.emit({
        type: 'QUOTA_EXHAUSTED',
        payload: { mode: 'free', model: requestedModel }
      });

      // Throw specific error to stop execution
      throw new Error('FREE_QUOTA_EXHAUSTED');
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proxy object mimicking the GoogleGenAI instance.
 * Intercepts `ai.models.generateContent` to inject smart logic.
 */
export const ai = new Proxy({} as GoogleGenAI, {
  get(_, prop) {
    const realClient = getAiClient();
    const value = (realClient as any)[prop];

    // Intercept 'models' property
    if (prop === 'models') {
      return new Proxy(value, {
        get(target, modelProp) {
          const method = target[modelProp];

          // Intercept 'generateContent'
          if (modelProp === 'generateContent' && typeof method === 'function') {
            return (request: GenerateContentRequest | string) =>
              smartGenerateContent(method, request);
          }

          return method;
        }
      });
    }

    return value;
  },
});

/**
 * Check if the API is properly configured.
 */
export function isApiConfigured(): boolean {
  return !validateApiKey(getActiveApiKey());
}

/**
 * Get API configuration status for UI display.
 */
export function getApiStatus(): { configured: boolean; error?: string } {
  const error = validateApiKey(getActiveApiKey());
  return {
    configured: !error,
    error: error ?? undefined,
  };
}
