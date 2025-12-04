import { evolveBedsideNote } from '../memory';
import { eventBus } from './eventBus';

interface SignificantEditOptions {
  threshold?: number;
  debounceMs?: number;
}

class SignificantEditMonitor {
  private static instance: SignificantEditMonitor | null = null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cumulativeDelta = 0;
  private projectId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private threshold: number;
  private debounceMs: number;

  private constructor(options?: SignificantEditOptions) {
    this.threshold = options?.threshold ?? 500;
    this.debounceMs = options?.debounceMs ?? 2000;
  }

  static getInstance(options?: SignificantEditOptions): SignificantEditMonitor {
    if (!this.instance) {
      this.instance = new SignificantEditMonitor(options);
    }
    return this.instance;
  }

  start(projectId: string, options?: SignificantEditOptions) {
    this.stop();

    this.projectId = projectId;
    this.threshold = options?.threshold ?? this.threshold;
    this.debounceMs = options?.debounceMs ?? this.debounceMs;

    this.unsubscribe = eventBus.subscribe('TEXT_CHANGED', (event) => {
      this.cumulativeDelta += Math.abs(event.payload.delta);
      this.scheduleDebounce();
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.projectId = null;
    this.cumulativeDelta = 0;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private async flush() {
    this.debounceTimer = null;

    if (!this.projectId) {
      this.cumulativeDelta = 0;
      return;
    }

    if (this.cumulativeDelta > this.threshold) {
      try {
        await evolveBedsideNote(
          this.projectId,
          'Major edit detected — review continuity.',
          { changeReason: 'significant_edit' },
        );
      } catch (error) {
        console.warn('[SignificantEditMonitor] Failed to evolve bedside note', error);
      }
    }

    this.cumulativeDelta = 0;
  }
}

export const getSignificantEditMonitor = (options?: SignificantEditOptions) =>
  SignificantEditMonitor.getInstance(options);

export const startSignificantEditMonitor = (projectId: string, options?: SignificantEditOptions) =>
  SignificantEditMonitor.getInstance(options).start(projectId, options);

export const stopSignificantEditMonitor = () =>
  SignificantEditMonitor.getInstance().stop();
