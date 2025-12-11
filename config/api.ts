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

/**
 * Reset the warning state for testing purposes.
 */
export function resetWarningState(): void {
  hasWarnedMissingKey = false;
}

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
 * Checks if the API key is configured.
 */
export function isApiConfigured(): boolean {
  return !!getApiKey();
}

// ============================================================================
// Dual API Key Management
// ============================================================================

/** Track whether free quota has been exhausted this session */
let freeQuotaExhausted = false;

/**
 * Get API keys from settings store (if available) or fall back to env.
 * This is a lazy accessor to avoid circular dependencies.
 */
function getStoredApiKeys(): { freeKey: string; paidKey: string } {
  try {
    // Access localStorage directly to avoid importing the store (circular dep)
    const stored = localStorage.getItem('quill-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        freeKey: parsed?.state?.freeApiKey || '',
        paidKey: parsed?.state?.paidApiKey || '',
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { freeKey: '', paidKey: '' };
}

/**
 * Get the currently active API key.
 * Priority: Free tier key (if configured and not exhausted) > Paid tier key > Environment key
 */
export function getActiveApiKey(): string {
  const { freeKey, paidKey } = getStoredApiKeys();
  
  // If free key is configured and not exhausted, use it
  if (freeKey && !freeQuotaExhausted && !validateApiKey(freeKey)) {
    return freeKey;
  }
  
  // If paid key is configured, use it
  if (paidKey && !validateApiKey(paidKey)) {
    return paidKey;
  }
  
  // Fall back to environment key
  return getApiKey();
}

/**
 * Mark the free tier quota as exhausted.
 * Call this when a 429 error is received on the free key.
 */
export function markFreeQuotaExhausted(): void {
  freeQuotaExhausted = true;
  console.info('[Quill AI] Free tier quota exhausted, switching to paid tier.');
}

/**
 * Reset the quota state (e.g., on page refresh or manual reset).
 */
export function resetQuotaState(): void {
  freeQuotaExhausted = false;
}

/**
 * Check if currently using the paid tier key.
 */
export function isUsingPaidKey(): boolean {
  const { freeKey, paidKey } = getStoredApiKeys();
  
  // Using paid if: free is exhausted, or free not configured but paid is
  if (freeQuotaExhausted && paidKey && !validateApiKey(paidKey)) {
    return true;
  }
  if (!freeKey && paidKey && !validateApiKey(paidKey)) {
    return true;
  }
  return false;
}

/**
 * Check if any API key is configured (stored or environment).
 */
export function isAnyApiKeyConfigured(): boolean {
  const { freeKey, paidKey } = getStoredApiKeys();
  const envKey = getApiKey();
  
  return !!(
    (freeKey && !validateApiKey(freeKey)) ||
    (paidKey && !validateApiKey(paidKey)) ||
    (envKey && !validateApiKey(envKey))
  );
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
