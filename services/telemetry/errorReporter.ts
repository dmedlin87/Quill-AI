export type ErrorContext = Record<string, unknown>;

type Reporter = (error: Error, context?: ErrorContext) => void;

let customReporter: Reporter | null = null;

/**
 * Allows apps to inject a custom reporter (e.g., Sentry, Datadog).
 */
export const setErrorReporter = (reporter: Reporter) => {
  customReporter = reporter;
};

const formatUnknownErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(formatUnknownErrorMessage(error)));

const tryReporter = (label: string, fn: () => void): boolean => {
  try {
    fn();
    return true;
  } catch (reporterError) {
    console.error(`[Telemetry] ${label} reporter failed`, reporterError);
    return false;
  }
};

/**
 * Reports errors with optional context.
 * Falls back to console logging when reporters are unavailable or fail.
 */
export const reportError = (error: unknown, context?: ErrorContext) => {
  const normalizedError = toError(error);
  const sentry = (globalThis as any)?.Sentry;

  const reporters: Array<() => boolean> = [];

  if (customReporter) {
    reporters.push(() => tryReporter("Custom", () => customReporter!(normalizedError, context)));
  }

  if (sentry?.captureException) {
    reporters.push(() => tryReporter("Sentry", () => sentry.captureException(normalizedError, { extra: context })));
  }

  for (const reporter of reporters) {
    if (reporter()) {
      return;
    }
  }

  console.error("[Telemetry] Error captured", normalizedError, context);
};
