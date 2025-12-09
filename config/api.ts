/**
 * API Configuration
 * 
 * Centralized API settings and security utilities.
 * 
 * SECURITY NOTE: This application uses client-side API key injection via Vite's
 * `define` feature. For production deployments, consider:
 * 1. Using a server-side proxy to hide the API key
 * 2. Implementing API key rotation
 * 3. Using restricted API keys with domain restrictions
 */

let hasWarnedMissingKey = false;

function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }

  // Support Vite-style injected env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[name]) {
    return (import.meta as any).env[name] as string;
  }

  return undefined;
}

/**
 * Retrieves the API key from environment.
 * In production, this should be replaced with a secure key retrieval mechanism.
 */
export function getApiKey(): string {
  // Test override to allow isolation from real env keys
  const testOverride = getEnvVar('TEST_API_KEY_OVERRIDE');
  if (testOverride !== undefined) {
    const trimmed = testOverride.trim();
    if (!trimmed && !hasWarnedMissingKey) {
      hasWarnedMissingKey = true;
      console.warn(
        '[Quill AI] No API key configured. Set GEMINI_API_KEY in your environment.'
      );
    }
    return trimmed;
  }

  const key =
    getEnvVar('API_KEY') ||
    getEnvVar('GEMINI_API_KEY') ||
    getEnvVar('VITE_GEMINI_API_KEY') ||
    '';

  if (!key && !hasWarnedMissingKey) {
    hasWarnedMissingKey = true;
    console.warn(
      '[Quill AI] No API key configured. Set GEMINI_API_KEY in your environment.'
    );
  }

  return key.trim();
}

/**
 * Validates that an API key is present and has valid format.
 * Returns error message or null if valid.
 */
export function validateApiKey(key: string): string | null {
  if (!key) {
    return 'API key is missing. Please configure GEMINI_API_KEY.';
  }
  
  if (key.length < 20) {
    return 'API key appears to be invalid (too short).';
  }
  
  return null;
}

/**
 * API request configuration defaults
 */
export const ApiDefaults = {
  /** Maximum text length to send to analysis (characters) */
  maxAnalysisLength: 3_000_000,
  
  /** Estimated characters per token (rough approximation) */
  charsPerToken: 4,
  
  /** Default timeout for API requests (ms) */
  requestTimeout: 120_000,
  
  /** Retry configuration */
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
} as const;

/**
 * Estimates token count from text (rough approximation)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / ApiDefaults.charsPerToken);
}
