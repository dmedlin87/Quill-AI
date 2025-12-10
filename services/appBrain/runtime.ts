/**
 * AppBrain Runtime
 * 
 * Centralized orchestrator for AppBrain lifecycle management.
 * Owns the startup/shutdown of all AppBrain services and provides
 * a single entry point for initializing the reactive event-driven architecture.
 * 
 * Flow: eventBus → eventObserver → significantEditMonitor → proactiveThinker
 */

import type { AppBrainState } from './types';
import type { ProactiveSuggestion } from '../memory/proactive';
import { eventBus, disableEventPersistence, enableEventPersistence } from './eventBus';
import { startAppBrainEventObserver } from './eventObserver';
import {
  getSignificantEditMonitor,
  startSignificantEditMonitor,
  stopSignificantEditMonitor,
} from './significantEditMonitor';
import {
  getProactiveThinker,
  startProactiveThinker,
  stopProactiveThinker,
  resetProactiveThinker,
  type ThinkerConfig,
} from './proactiveThinker';
import {
  getDreamingService,
  startDreamingService,
  stopDreamingService,
} from './dreamingService';
import { appBrainLogger, LogLevel } from './logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AppBrainRuntimeConfig {
  /** Project ID for memory and context */
  projectId: string;
  /** Function to get current AppBrainState */
  getState: () => AppBrainState;
  /** Callback when a proactive suggestion is generated */
  onSuggestion?: (suggestion: ProactiveSuggestion) => void;
  /** Enable localStorage persistence for event log */
  persistEvents?: boolean;
  /** Configuration for proactive thinker */
  thinkerConfig?: Partial<ThinkerConfig>;
  /** Log level for AppBrain services */
  logLevel?: LogLevel;
  /** Custom settings adapter (replaces direct useSettingsStore dependency) */
  settingsAdapter?: SettingsAdapter;
}

export interface SettingsAdapter {
  /** Get suggestion weights for adaptive relevance filtering */
  getSuggestionWeights: () => Record<string, number>;
}

export interface AppBrainRuntimeStatus {
  isRunning: boolean;
  projectId: string | null;
  services: {
    eventObserver: boolean;
    significantEditMonitor: boolean;
    proactiveThinker: boolean;
    dreamingService: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME CLASS
// ─────────────────────────────────────────────────────────────────────────────

class AppBrainRuntimeImpl {
  private isRunning = false;
  private projectId: string | null = null;
  private cleanupFns: Array<() => void> = [];
  private config: AppBrainRuntimeConfig | null = null;

  /**
   * Start the AppBrain runtime with the given configuration.
   * 
   * This initializes the full event-driven architecture:
   * 1. Configures event persistence
   * 2. Starts the event observer (subscribes to CHAPTER_CHANGED, TEXT_CHANGED)
   * 3. Starts the proactive thinker (subscribes to all events)
   * 
   * The SignificantEditMonitor and DreamingService are started lazily
   * by the eventObserver when a CHAPTER_CHANGED event fires.
   */
  start(config: AppBrainRuntimeConfig): void {
    if (this.isRunning) {
      appBrainLogger.warn('Runtime', 'start() called while already running. Call stop() first.');
      return;
    }

    this.config = config;
    this.projectId = config.projectId;

    appBrainLogger.info('Runtime', `Starting AppBrain runtime for project: ${config.projectId}`);

    // Configure log level
    if (config.logLevel !== undefined) {
      appBrainLogger.setLevel(config.logLevel);
    }

    // Configure event persistence
    if (config.persistEvents === false) {
      disableEventPersistence();
    } else {
      enableEventPersistence();
    }

    // Start the event observer (wires CHAPTER_CHANGED → monitor/dreaming, TEXT_CHANGED → monitor)
    const cleanupObserver = startAppBrainEventObserver();
    this.cleanupFns.push(cleanupObserver);

    // Start the proactive thinker (subscribes to all events for background analysis)
    const defaultOnSuggestion = (suggestion: ProactiveSuggestion) => {
      appBrainLogger.debug('Runtime', `Suggestion generated: ${suggestion.title}`, { suggestion });
    };

    startProactiveThinker(
      config.getState,
      config.projectId,
      config.onSuggestion ?? defaultOnSuggestion,
      config.thinkerConfig
    );
    this.cleanupFns.push(() => stopProactiveThinker());

    this.isRunning = true;
    appBrainLogger.info('Runtime', 'AppBrain runtime started successfully');
  }

  /**
   * Stop the AppBrain runtime and clean up all services.
   */
  stop(): void {
    if (!this.isRunning) {
      appBrainLogger.debug('Runtime', 'stop() called while not running');
      return;
    }

    appBrainLogger.info('Runtime', 'Stopping AppBrain runtime');

    // Run cleanup functions in reverse order
    for (const cleanup of this.cleanupFns.reverse()) {
      try {
        cleanup();
      } catch (error) {
        appBrainLogger.error('Runtime', 'Error during cleanup', { error });
      }
    }
    this.cleanupFns = [];

    // Stop services that may have been started by eventObserver
    stopSignificantEditMonitor();
    stopDreamingService();

    this.isRunning = false;
    this.projectId = null;
    this.config = null;

    appBrainLogger.info('Runtime', 'AppBrain runtime stopped');
  }

  /**
   * Restart the runtime with the same or new configuration.
   */
  restart(config?: Partial<AppBrainRuntimeConfig>): void {
    const currentConfig = this.config;
    this.stop();

    if (currentConfig) {
      this.start({ ...currentConfig, ...config });
    } else if (config && 'projectId' in config && 'getState' in config) {
      this.start(config as AppBrainRuntimeConfig);
    } else {
      appBrainLogger.warn('Runtime', 'Cannot restart: no previous config and incomplete new config');
    }
  }

  /**
   * Switch to a new project without full restart.
   * Updates projectId and restarts monitors with new context.
   */
  switchProject(projectId: string): void {
    if (!this.isRunning || !this.config) {
      appBrainLogger.warn('Runtime', 'Cannot switch project: runtime not running');
      return;
    }

    appBrainLogger.info('Runtime', `Switching project from ${this.projectId} to ${projectId}`);

    // Stop current monitors
    stopSignificantEditMonitor();
    stopProactiveThinker();

    // Update project ID
    this.projectId = projectId;
    this.config.projectId = projectId;

    // Restart proactive thinker with new project
    startProactiveThinker(
      this.config.getState,
      projectId,
      this.config.onSuggestion ?? (() => {}),
      this.config.thinkerConfig
    );

    // SignificantEditMonitor will be restarted by next CHAPTER_CHANGED event
  }

  /**
   * Get current runtime status.
   */
  getStatus(): AppBrainRuntimeStatus {
    return {
      isRunning: this.isRunning,
      projectId: this.projectId,
      services: {
        eventObserver: this.isRunning,
        significantEditMonitor: !!getSignificantEditMonitor(),
        proactiveThinker: !!getProactiveThinker(),
        dreamingService: !!getDreamingService(),
      },
    };
  }

  /**
   * Force a proactive thinking cycle (for manual triggers).
   */
  async forceThink(): Promise<void> {
    if (!this.isRunning) {
      appBrainLogger.warn('Runtime', 'Cannot force think: runtime not running');
      return;
    }

    const thinker = getProactiveThinker();
    await thinker.forceThink();
  }

  /**
   * Get the current configuration (read-only).
   */
  getConfig(): Readonly<AppBrainRuntimeConfig> | null {
    return this.config ? { ...this.config } : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON & EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

let runtimeInstance: AppBrainRuntimeImpl | null = null;

/**
 * Get the singleton AppBrain runtime instance.
 */
export function getAppBrainRuntime(): AppBrainRuntimeImpl {
  if (!runtimeInstance) {
    runtimeInstance = new AppBrainRuntimeImpl();
  }
  return runtimeInstance;
}

/**
 * Start the AppBrain runtime with the given configuration.
 */
export function startAppBrainRuntime(config: AppBrainRuntimeConfig): void {
  getAppBrainRuntime().start(config);
}

/**
 * Stop the AppBrain runtime.
 */
export function stopAppBrainRuntime(): void {
  getAppBrainRuntime().stop();
}

/**
 * Reset all AppBrain services and singletons (for testing).
 * This is a comprehensive reset that clears all state.
 */
export function resetAppBrainForTests(): void {
  appBrainLogger.debug('Runtime', 'Resetting AppBrain for tests');

  // Stop runtime if running
  if (runtimeInstance) {
    runtimeInstance.stop();
    runtimeInstance = null;
  }

  // Reset individual service singletons
  resetProactiveThinker();
  stopSignificantEditMonitor();
  stopDreamingService();

  // Clear event bus state
  eventBus.dispose();

  appBrainLogger.debug('Runtime', 'AppBrain reset complete');
}

export type { AppBrainRuntimeImpl as AppBrainRuntime };
