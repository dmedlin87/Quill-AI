import { reportError } from "../telemetry/errorReporter";

export class AIError extends Error {
  public readonly isRetryable: boolean;
  public readonly cause: unknown;

  constructor(message: string, options?: { isRetryable?: boolean; cause?: unknown }) {
    super(message, { cause: options?.cause });
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.isRetryable = options?.isRetryable ?? false;
    this.cause = options?.cause;
  }
}

export class RateLimitError extends AIError {
  constructor(message = "Rate limit exceeded. Please try again in a moment.", cause?: unknown) {
    super(message, { isRetryable: true, cause });
  }
}

export class AuthError extends AIError {
  constructor(message = "Authentication error. Please check your API key or credentials.", cause?: unknown) {
    super(message, { isRetryable: false, cause });
  }
}

export class UnknownAIError extends AIError {
  constructor(message = "Agent request failed.", cause?: unknown) {
    super(message, { isRetryable: false, cause });
  }
}

// Best-effort normalization of errors coming from the Gemini SDK or network
export const normalizeAIError = (error: unknown, context?: Record<string, unknown>): AIError => {
  if (error instanceof AIError) {
    // Already normalized
    reportError(error, context);
    return error;
  }

  const anyErr = error as any;
  const status: number | undefined =
    anyErr?.status ??
    anyErr?.code ??
    anyErr?.cause?.status ??
    anyErr?.cause?.code ??
    anyErr?.response?.status;

  const message: string =
    typeof anyErr?.message === "string"
      ? anyErr.message
      : typeof anyErr === "string"
      ? anyErr
      : "Agent request failed.";

  let normalized: AIError;

  if (status === 401 || status === 403) {
    normalized = new AuthError(message, error);
  } else if (status === 429) {
    normalized = new RateLimitError(message, error);
  } else {
    normalized = new UnknownAIError(message, error);
  }

  reportError(normalized, context);
  return normalized;
};
