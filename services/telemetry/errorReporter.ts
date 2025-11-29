export type ErrorContext = Record<string, unknown>;

type Reporter = (error: Error, context?: ErrorContext) => void;

let customReporter: Reporter | null = null;

/**
 * Allows apps to inject a custom reporter (e.g., Sentry, Datadog).
 */
export const setErrorReporter = (reporter: Reporter) => {
  customReporter = reporter;
};

/**
 * Reports errors with optional context.
 * Falls back to console logging when no reporter is configured.
 */
export const reportError = (error: unknown, context?: ErrorContext) => {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown error');

  const sentry = (globalThis as any)?.Sentry;

  try {
    if (customReporter) {
      customReporter(normalizedError, context);
    } else if (sentry?.captureException) {
      sentry.captureException(normalizedError, { extra: context });
    } else {
      console.error('[Telemetry] Error captured', normalizedError, context);
    }
  } catch (reporterError) {
    console.error('[Telemetry] Reporter failed', reporterError);
  }
};
