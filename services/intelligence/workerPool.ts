/**
 * Intelligence Worker Pool (Enhancement 5A)
 * 
 * Pool of Web Workers for parallel manuscript processing.
 * Enables concurrent chapter processing for faster full-project analysis.
 */

import { ManuscriptIntelligence } from '@/types/intelligence';
import { parseStructureCached, extractEntitiesCached, analyzeStyleCached } from './cache';
import { buildTimeline } from './timelineTracker';
import { analyzeVoices } from './voiceProfiler';
import { buildHeatmap } from './heatmapBuilder';
import { createEmptyDelta } from './deltaTracker';
import { buildHUD } from './contextBuilder';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkerJob {
  id: string;
  type: 'PROCESS_FULL' | 'PROCESS_DEBOUNCED' | 'PROCESS_INSTANT';
  chapterId: string;
  text: string;
  cursorOffset?: number;
  priority: 'high' | 'normal' | 'low';
  addedAt: number;
}

export interface WorkerResult {
  id: string;
  jobId: string;
  success: boolean;
  intelligence?: ManuscriptIntelligence;
  error?: string;
  processingTimeMs: number;
}

interface PooledWorker {
  worker: Worker;
  id: string;
  busy: boolean;
  currentJob: WorkerJob | null;
  completedJobs: number;
  totalProcessingTime: number;
}

export interface PoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  queueLength: number;
  totalJobsProcessed: number;
  avgProcessingTime: number;
}

type JobCallback = (result: WorkerResult) => void;

// ─────────────────────────────────────────────────────────────────────────────
// WORKER POOL CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pool of Web Workers for parallel intelligence processing
 */
export class IntelligenceWorkerPool {
  private workers: PooledWorker[] = [];
  private jobQueue: WorkerJob[] = [];
  private callbacks: Map<string, JobCallback> = new Map();
  private isInitialized: boolean = false;
  private workerUrl: string;
  private workersSupported: boolean = true;
  private poolSize: number;
  /** Cached default to avoid repeated capability checks */
  private defaultPoolSize?: number;

  constructor(poolSize?: number, workerPath: string = './worker.ts') {
    this.poolSize = poolSize ?? this.computeDefaultPoolSize();
    this.workerUrl = workerPath;
  }
  
  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Check if Workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('[WorkerPool] Web Workers not supported, falling back to main thread');
      this.workersSupported = false;
      this.isInitialized = true;
      return;
    }
    
    try {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(
          new URL(this.workerUrl, import.meta.url),
          { type: 'module' }
        );
        
        const pooledWorker: PooledWorker = {
          worker,
          id: `worker_${i}`,
          busy: false,
          currentJob: null,
          completedJobs: 0,
          totalProcessingTime: 0,
        };
        
        // Set up message handler
        worker.onmessage = (event) => {
          this.handleWorkerMessage(pooledWorker, event.data);
        };
        
        worker.onerror = (error) => {
          this.handleWorkerError(pooledWorker, error);
        };
        
        this.workers.push(pooledWorker);
      }
      
      this.isInitialized = true;
      console.log(`[WorkerPool] Initialized with ${this.poolSize} workers`);
    } catch (error) {
      console.error('[WorkerPool] Failed to initialize:', error);
      this.workersSupported = false;
      this.isInitialized = true;
    }
  }
  
  /**
   * Submit a job to the pool
   */
  submitJob(job: Omit<WorkerJob, 'id' | 'addedAt'>, callback: JobCallback): string {
    const fullJob: WorkerJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      addedAt: Date.now(),
    };
    
    this.callbacks.set(fullJob.id, callback);
    
    // Find an idle worker
    const idleWorker = this.workers.find(w => !w.busy);
    
    if (idleWorker) {
      this.dispatchJob(idleWorker, fullJob);
    } else {
      // Add to queue with priority sorting
      this.jobQueue.push(fullJob);
      this.jobQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }
    
    return fullJob.id;
  }
  
  /**
   * Process multiple chapters in parallel
   */
  async processChapters(
    chapters: Array<{ id: string; text: string }>
  ): Promise<Map<string, ManuscriptIntelligence>> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Fallback: no workers available, process sequentially on main thread
    if (!this.workersSupported || this.workers.length === 0) {
      const results = new Map<string, ManuscriptIntelligence>();
      for (const chapter of chapters) {
        const structural = parseStructureCached(chapter.text);
        const entities = extractEntitiesCached(
          chapter.text,
          structural.paragraphs,
          structural.dialogueMap,
          chapter.id,
        );
        const timeline = buildTimeline(chapter.text, structural.scenes, chapter.id);
        const style = analyzeStyleCached(chapter.text);
        const voice = analyzeVoices(structural.dialogueMap);
        const heatmap = buildHeatmap(chapter.text, structural, entities, timeline, style);
        const delta = createEmptyDelta(chapter.text);
        const intelligence: ManuscriptIntelligence = {
          chapterId: chapter.id,
          structural,
          entities,
          timeline,
          style,
          voice,
          heatmap,
          delta,
          hud: null as any,
        };
        const hud = buildHUD(intelligence, 0);
        intelligence.hud = hud;
        results.set(chapter.id, intelligence);
      }
      return results;
    }
    
    const results = new Map<string, ManuscriptIntelligence>();
    const pending: Promise<void>[] = [];
    
    for (const chapter of chapters) {
      const promise = new Promise<void>((resolve) => {
        this.submitJob(
          {
            type: 'PROCESS_FULL',
            chapterId: chapter.id,
            text: chapter.text,
            priority: 'normal',
          },
          (result) => {
            if (result.success && result.intelligence) {
              results.set(chapter.id, result.intelligence);
            }
            resolve();
          }
        );
      });
      pending.push(promise);
    }
    
    await Promise.all(pending);
    return results;
  }
  
  /**
   * Cancel a pending job
   */
  cancelJob(jobId: string): boolean {
    const queueIndex = this.jobQueue.findIndex(j => j.id === jobId);
    if (queueIndex >= 0) {
      this.jobQueue.splice(queueIndex, 1);
      this.callbacks.delete(jobId);
      return true;
    }
    return false;
  }
  
  /**
   * Cancel all pending jobs for a chapter
   */
  cancelChapterJobs(chapterId: string): number {
    const toRemove = this.jobQueue.filter(j => j.chapterId === chapterId);
    for (const job of toRemove) {
      this.cancelJob(job.id);
    }
    return toRemove.length;
  }
  
  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const totalProcessingTime = this.workers.reduce(
      (sum, w) => sum + w.totalProcessingTime, 0
    );
    const totalJobsProcessed = this.workers.reduce(
      (sum, w) => sum + w.completedJobs, 0
    );
    
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      idleWorkers: this.workers.filter(w => !w.busy).length,
      queueLength: this.jobQueue.length,
      totalJobsProcessed,
      avgProcessingTime: totalJobsProcessed > 0 
        ? totalProcessingTime / totalJobsProcessed 
        : 0,
    };
  }
  
  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const pooledWorker of this.workers) {
      pooledWorker.worker.terminate();
    }
    this.workers = [];
    this.jobQueue = [];
    this.callbacks.clear();
    this.isInitialized = false;
    this.workersSupported = true;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  private dispatchJob(worker: PooledWorker, job: WorkerJob): void {
    worker.busy = true;
    worker.currentJob = job;
    
    worker.worker.postMessage({
      type: job.type,
      id: job.id,
      text: job.text,
      chapterId: job.chapterId,
      cursorOffset: job.cursorOffset || 0,
    });
  }
  
  private handleWorkerMessage(worker: PooledWorker, message: any): void {
    const job = worker.currentJob;
    if (!job) return;
    
    const processingTime = Date.now() - job.addedAt;
    
    // Update worker stats
    worker.completedJobs++;
    worker.totalProcessingTime += processingTime;
    worker.busy = false;
    worker.currentJob = null;
    
    // Call callback
    const callback = this.callbacks.get(job.id);
    if (callback) {
      callback({
        id: worker.id,
        jobId: job.id,
        success: message.type === 'RESULT',
        intelligence: message.payload,
        error: message.type === 'ERROR' ? message.error : undefined,
        processingTimeMs: processingTime,
      });
      this.callbacks.delete(job.id);
    }
    
    // Process next job in queue
    if (this.jobQueue.length > 0) {
      const nextJob = this.jobQueue.shift()!;
      this.dispatchJob(worker, nextJob);
    }
  }
  
  private handleWorkerError(worker: PooledWorker, error: ErrorEvent): void {
    console.error(`[WorkerPool] Worker ${worker.id} error:`, error);
    
    const job = worker.currentJob;
    if (job) {
      const callback = this.callbacks.get(job.id);
      if (callback) {
        callback({
          id: worker.id,
          jobId: job.id,
          success: false,
          error: error.message,
          processingTimeMs: Date.now() - job.addedAt,
        });
        this.callbacks.delete(job.id);
      }
    }
    
    worker.busy = false;
    worker.currentJob = null;
    
    // Process next job
    if (this.jobQueue.length > 0) {
      const nextJob = this.jobQueue.shift()!;
      this.dispatchJob(worker, nextJob);
    }
  }

  private computeDefaultPoolSize(): number {
    if (this.defaultPoolSize !== undefined) return this.defaultPoolSize;
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      this.defaultPoolSize = Math.max(2, navigator.hardwareConcurrency - 1);
    } else {
      this.defaultPoolSize = 2;
    }
    return this.defaultPoolSize;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

let poolInstance: IntelligenceWorkerPool | null = null;

/**
 * Get or create the worker pool singleton
 */
export const getWorkerPool = (poolSize?: number): IntelligenceWorkerPool => {
  if (!poolInstance) {
    poolInstance = new IntelligenceWorkerPool(poolSize);
  }
  return poolInstance;
};

/**
 * Initialize the worker pool (call early in app lifecycle)
 */
export const initializeWorkerPool = async (poolSize?: number): Promise<void> => {
  const pool = getWorkerPool(poolSize);
  await pool.initialize();
};

/**
 * Process chapters using the pool
 */
export const processChaptersParallel = async (
  chapters: Array<{ id: string; text: string }>
): Promise<Map<string, ManuscriptIntelligence>> => {
  const pool = getWorkerPool();
  await pool.initialize();
  return pool.processChapters(chapters);
};
