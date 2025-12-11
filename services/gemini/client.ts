/**
 * Gemini API Client
 * 
 * Centralized AI client initialization with security validation.
 * 
 * SECURITY NOTE: API key is injected at build time via Vite.
 * For production, consider implementing a server-side proxy.
 */

import { GoogleGenAI } from "@google/genai";
import { getApiKey, validateApiKey, getActiveApiKey } from "../../config/api";

// Initialize with environment key (for initial load)
const initialApiKey = getApiKey();

// Validate on initialization - log but DO NOT throw, so the UI can still load
const validationError = validateApiKey(initialApiKey);
if (validationError) {
  // Log for debugging context
  console.warn(`[Quill AI API] ${validationError}`);
  // We intentionally do not throw here so that the application can render
  // even when the Gemini API key is missing. Calls to the client will fail
  // at request-time instead of crashing the entire app at import-time.
}

/**
 * Primary Gemini AI client instance.
 * Shared across all service modules.
 *
 * Tests may mock GoogleGenAI as a plain function; support both constructor and factory forms.
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
 * This enables dynamic switching between free/paid keys.
 */
export function getAiClient(): GoogleGenAI {
  const activeKey = getActiveApiKey();
  if (activeKey !== currentApiKey) {
    currentApiKey = activeKey;
    aiClient = buildClient(activeKey);
  }
  return aiClient;
}

// Export for backwards compatibility - but prefer getAiClient() for dynamic key support
export const ai = new Proxy({} as GoogleGenAI, {
  get(_, prop) {
    return (getAiClient() as any)[prop];
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