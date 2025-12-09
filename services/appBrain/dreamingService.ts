import { eventBus, emitDreamingStateChanged, emitIdleStatusChanged } from './eventBus';
import { runDreamingCycle } from '../memory/dreaming';

const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

class DreamingService {
  private static instance: DreamingService | null = null;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private unsubscribe: (() => void) | null = null;
  private projectId: string | null = null;
  private isActive = false;

  static getInstance(): DreamingService {
    if (!this.instance) {
      this.instance = new DreamingService();
    }
    return this.instance;
  }

  start(): void {
    this.stop();
    this.unsubscribe = eventBus.subscribeAll((event) => {
      if (event.type === 'CHAPTER_CHANGED') {
        this.projectId = event.payload.projectId;
        this.resetIdleTimer();
      }

      if (event.type === 'TEXT_CHANGED') {
        this.interrupt();
        this.resetIdleTimer();
      }
    });

    this.resetIdleTimer();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clearIdleTimer();
    this.interrupt();
    emitIdleStatusChanged(false);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.beginDreaming(), IDLE_THRESHOLD_MS);
    emitIdleStatusChanged(false);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private interrupt(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.isActive) {
      this.isActive = false;
      emitDreamingStateChanged(false);
    }
  }

  private async beginDreaming(): Promise<void> {
    if (!this.projectId || this.isActive) return;

    this.abortController = new AbortController();
    this.isActive = true;
    emitIdleStatusChanged(true);
    emitDreamingStateChanged(true);

    try {
      await runDreamingCycle(this.projectId, this.abortController.signal);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.warn('[DreamingService] Dreaming cycle failed', error);
      }
    } finally {
      this.isActive = false;
      emitDreamingStateChanged(false);
      this.abortController = null;
      this.resetIdleTimer();
    }
  }
}

export const getDreamingService = () => DreamingService.getInstance();
export const startDreamingService = () => DreamingService.getInstance().start();
export const stopDreamingService = () => DreamingService.getInstance().stop();
