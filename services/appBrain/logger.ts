/**
 * AppBrain Logger
 * 
 * Unified logging for AppBrain services with structured context.
 * Provides consistent prefixes, log levels, and optional telemetry integration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogContext {
  projectId?: string;
  chapterId?: string;
  eventType?: string;
  suggestionType?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
  timestamp: number;
  error?: Error;
}

export type LogHandler = (entry: LogEntry) => void;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class AppBrainLogger {
  private level: LogLevel = LogLevel.INFO;
  private handlers: LogHandler[] = [];
  private prefix = '[AppBrain]';

  /**
   * Set the minimum log level.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Add a custom log handler (for telemetry, error reporting, etc.).
   */
  addHandler(handler: LogHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Clear all custom handlers.
   */
  clearHandlers(): void {
    this.handlers = [];
  }

  /**
   * Log a debug message.
   */
  debug(service: string, message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, service, message, context);
  }

  /**
   * Log an info message.
   */
  info(service: string, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, service, message, context);
  }

  /**
   * Log a warning message.
   */
  warn(service: string, message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, service, message, context);
  }

  /**
   * Log an error message.
   */
  error(service: string, message: string, context?: LogContext & { error?: Error }): void {
    this.log(LogLevel.ERROR, service, message, context);
  }

  /**
   * Core logging method.
   */
  private log(level: LogLevel, service: string, message: string, context?: LogContext): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      service,
      message,
      context,
      timestamp: Date.now(),
      error: context?.error instanceof Error ? context.error : undefined,
    };

    // Call custom handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (e) {
        // Don't let handler errors break logging
        console.error(`${this.prefix} Log handler error:`, e);
      }
    }

    // Console output
    const formattedMessage = this.formatMessage(entry);
    const contextString = context && Object.keys(context).length > 0
      ? this.formatContext(context)
      : '';

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, contextString);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, contextString);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, contextString);
        break;
      case LogLevel.ERROR:
        if (entry.error) {
          console.error(formattedMessage, contextString, entry.error);
        } else {
          console.error(formattedMessage, contextString);
        }
        break;
    }
  }

  /**
   * Format the log message with prefix and service name.
   */
  private formatMessage(entry: LogEntry): string {
    return `${this.prefix}[${entry.service}] ${entry.message}`;
  }

  /**
   * Format context object for console output.
   */
  private formatContext(context: LogContext): string {
    // Remove error from context string (it's logged separately)
    const { error, ...rest } = context;
    if (Object.keys(rest).length === 0) {
      return '';
    }
    try {
      return JSON.stringify(rest);
    } catch {
      return '[context not serializable]';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON & EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const appBrainLogger = new AppBrainLogger();

/**
 * Create a scoped logger for a specific service.
 * Convenience wrapper that pre-fills the service name.
 */
export function createServiceLogger(service: string) {
  return {
    debug: (message: string, context?: LogContext) => 
      appBrainLogger.debug(service, message, context),
    info: (message: string, context?: LogContext) => 
      appBrainLogger.info(service, message, context),
    warn: (message: string, context?: LogContext) => 
      appBrainLogger.warn(service, message, context),
    error: (message: string, context?: LogContext & { error?: Error }) => 
      appBrainLogger.error(service, message, context),
  };
}

// Pre-defined service loggers for common AppBrain components
export const eventBusLogger = createServiceLogger('EventBus');
export const eventObserverLogger = createServiceLogger('EventObserver');
export const significantEditLogger = createServiceLogger('SignificantEditMonitor');
export const proactiveThinkerLogger = createServiceLogger('ProactiveThinker');
export const dreamingServiceLogger = createServiceLogger('DreamingService');
export const contextBuilderLogger = createServiceLogger('ContextBuilder');
