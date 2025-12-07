import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  IntelligenceWorkerPool,
  getWorkerPool,
  initializeWorkerPool,
  processChaptersParallel,
  type WorkerJob,
  type WorkerResult,
  type PoolStats,
} from '@/services/intelligence/workerPool';

// Mock the intelligence processing functions
vi.mock('@/services/intelligence/cache', () => ({
  parseStructureCached: vi.fn(() => ({
    scenes: [],
    paragraphs: [],
    dialogueMap: [],
    stats: { totalWords: 100, totalSentences: 10, totalParagraphs: 5, avgSentenceLength: 10, sentenceLengthVariance: 2, dialogueRatio: 0.3, sceneCount: 1, povShifts: 0, avgSceneLength: 100 },
    processedAt: Date.now(),
  })),
  extractEntitiesCached: vi.fn(() => ({ nodes: [], edges: [], processedAt: Date.now() })),
  analyzeStyleCached: vi.fn(() => ({
    vocabulary: { uniqueWords: 50, totalWords: 100, avgWordLength: 5, lexicalDiversity: 0.5, topWords: [], overusedWords: [], rareWords: [] },
    syntax: { avgSentenceLength: 10, sentenceLengthVariance: 2, minSentenceLength: 3, maxSentenceLength: 20, paragraphLengthAvg: 50, dialogueToNarrativeRatio: 0.3, questionRatio: 0.1, exclamationRatio: 0.02 },
    rhythm: { syllablePattern: [], punctuationDensity: 5, avgClauseCount: 2 },
    flags: { passiveVoiceRatio: 0.1, passiveVoiceInstances: [], adverbDensity: 0.02, adverbInstances: [], filterWordDensity: 0.01, filterWordInstances: [], clicheCount: 0, clicheInstances: [], repeatedPhrases: [] },
    processedAt: Date.now(),
  })),
}));

vi.mock('@/services/intelligence/timelineTracker', () => ({
  buildTimeline: vi.fn(() => ({ events: [], causalChains: [], promises: [], processedAt: Date.now() })),
}));

vi.mock('@/services/intelligence/voiceProfiler', () => ({
  analyzeVoices: vi.fn(() => ({ profiles: {}, consistencyAlerts: [] })),
}));

vi.mock('@/services/intelligence/heatmapBuilder', () => ({
  buildHeatmap: vi.fn(() => ({ sections: [], hotspots: [], processedAt: Date.now() })),
}));

vi.mock('@/services/intelligence/deltaTracker', () => ({
  createEmptyDelta: vi.fn(() => ({
    changedRanges: [],
    invalidatedSections: [],
    affectedEntities: [],
    newPromises: [],
    resolvedPromises: [],
    contentHash: 'hash',
    processedAt: Date.now(),
  })),
}));

vi.mock('@/services/intelligence/contextBuilder', () => ({
  buildHUD: vi.fn(() => ({
    situational: { currentScene: null, currentParagraph: null, narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 }, tensionLevel: 'low', pacing: 'slow' },
    context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
    styleAlerts: [],
    prioritizedIssues: [],
    recentChanges: [],
    stats: { wordCount: 100, readingTime: 1, dialoguePercent: 30, avgSentenceLength: 10 },
    lastFullProcess: Date.now(),
    processingTier: 'instant',
  })),
}));

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private messageHandler: ((data: any) => void) | null = null;

  constructor(_url: URL, _options?: WorkerOptions) {
    // Store reference for test manipulation
    MockWorker.instances.push(this);
  }

  postMessage(data: any) {
    // Simulate async processing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'RESULT', payload: { chapterId: data.chapterId } } } as MessageEvent);
      }
    }, 10);
  }

  terminate() {
    // No-op
  }

  // For test manipulation
  static instances: MockWorker[] = [];
  static reset() {
    MockWorker.instances = [];
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  simulateError(message: string) {
    if (this.onerror) {
      this.onerror({ message } as ErrorEvent);
    }
  }
}

describe('IntelligenceWorkerPool', () => {
  let originalWorker: typeof Worker;
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWorker.reset();

    // Store original globals
    originalWorker = globalThis.Worker;
    originalNavigator = globalThis.navigator;

    // Mock Worker
    globalThis.Worker = MockWorker as any;

    // Mock navigator.hardwareConcurrency
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 4 },
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original globals
    globalThis.Worker = originalWorker;
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  describe('constructor', () => {
    it('uses provided pool size', () => {
      const pool = new IntelligenceWorkerPool(2);
      expect(pool['poolSize']).toBe(2);
    });

    it('computes default pool size from hardware concurrency', () => {
      const pool = new IntelligenceWorkerPool();
      expect(pool['poolSize']).toBe(3); // hardwareConcurrency - 1, min 2
    });
  });

  describe('initialize', () => {
    it('creates workers based on pool size', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      expect(MockWorker.instances).toHaveLength(2);
    });

    it('does not reinitialize if already initialized', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();
      await pool.initialize();

      expect(MockWorker.instances).toHaveLength(2);
    });

    it('falls back gracefully when Worker is undefined', async () => {
      globalThis.Worker = undefined as any;

      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      expect(pool['workersSupported']).toBe(false);
    });

    it('handles Worker construction errors', async () => {
      globalThis.Worker = class {
        constructor() {
          throw new Error('Worker not supported');
        }
      } as any;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      expect(pool['workersSupported']).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('submitJob', () => {
    it('dispatches job to idle worker immediately', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      const callback = vi.fn();
      const jobId = pool.submitJob(
        { type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' },
        callback
      );

      expect(jobId).toMatch(/^job_/);
    });

    it('queues job when all workers are busy', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      // Submit first job
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      // Submit second job - should be queued
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-2', text: 'test', priority: 'normal' }, vi.fn());

      expect(pool['jobQueue']).toHaveLength(1);
    });

    it('sorts queue by priority', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      // Fill the single worker
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      // Queue jobs with different priorities
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-low', text: 'test', priority: 'low' }, vi.fn());
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-high', text: 'test', priority: 'high' }, vi.fn());
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-normal', text: 'test', priority: 'normal' }, vi.fn());

      const queue = pool['jobQueue'];
      expect(queue[0].priority).toBe('high');
      expect(queue[1].priority).toBe('normal');
      expect(queue[2].priority).toBe('low');
    });
  });

  describe('processChapters', () => {
    it('processes chapters sequentially when workers not supported', async () => {
      globalThis.Worker = undefined as any;

      const pool = new IntelligenceWorkerPool(2);
      const chapters = [
        { id: 'ch-1', text: 'Chapter 1 text' },
        { id: 'ch-2', text: 'Chapter 2 text' },
      ];

      const results = await pool.processChapters(chapters);

      expect(results.size).toBe(2);
      expect(results.has('ch-1')).toBe(true);
      expect(results.has('ch-2')).toBe(true);
    });

    it('processes chapters in parallel when workers available', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      const chapters = [
        { id: 'ch-1', text: 'Chapter 1' },
        { id: 'ch-2', text: 'Chapter 2' },
      ];

      // Process will submit jobs and wait for callbacks
      const resultsPromise = pool.processChapters(chapters);

      // Wait a bit for async processing
      await new Promise((r) => setTimeout(r, 50));

      const results = await resultsPromise;
      expect(results.size).toBe(2);
    });
  });

  describe('cancelJob', () => {
    it('removes job from queue and returns true', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      // Fill the worker
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      // Queue a job
      const jobId = pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-2', text: 'test', priority: 'normal' }, vi.fn());

      expect(pool.cancelJob(jobId)).toBe(true);
      expect(pool['jobQueue']).toHaveLength(0);
    });

    it('returns false for non-queued job', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      expect(pool.cancelJob('non-existent-job')).toBe(false);
    });
  });

  describe('cancelChapterJobs', () => {
    it('cancels all jobs for a specific chapter', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      // Fill the worker
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      // Queue jobs for different chapters
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-2', text: 'test', priority: 'normal' }, vi.fn());
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-2', text: 'test', priority: 'normal' }, vi.fn());
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-3', text: 'test', priority: 'normal' }, vi.fn());

      const removed = pool.cancelChapterJobs('ch-2');

      expect(removed).toBe(2);
      expect(pool['jobQueue']).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns pool statistics', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      const stats = pool.getStats();

      expect(stats.totalWorkers).toBe(2);
      expect(stats.busyWorkers).toBe(0);
      expect(stats.idleWorkers).toBe(2);
      expect(stats.queueLength).toBe(0);
      expect(stats.totalJobsProcessed).toBe(0);
      expect(stats.avgProcessingTime).toBe(0);
    });

    it('reflects busy workers', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      const stats = pool.getStats();
      expect(stats.busyWorkers).toBe(1);
      expect(stats.idleWorkers).toBe(1);
    });
  });

  describe('terminate', () => {
    it('terminates all workers and clears state', async () => {
      const pool = new IntelligenceWorkerPool(2);
      await pool.initialize();

      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, vi.fn());

      pool.terminate();

      expect(pool['workers']).toHaveLength(0);
      expect(pool['jobQueue']).toHaveLength(0);
      expect(pool['isInitialized']).toBe(false);
    });
  });

  describe('worker message handling', () => {
    it('calls callback on successful result', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      const callback = vi.fn();
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, callback);

      // Wait for async message
      await new Promise((r) => setTimeout(r, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          jobId: expect.any(String),
        })
      );
    });

    it('processes next job in queue after completion', async () => {
      const pool = new IntelligenceWorkerPool(1);
      await pool.initialize();

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-1', text: 'test', priority: 'normal' }, callback1);
      pool.submitJob({ type: 'PROCESS_FULL', chapterId: 'ch-2', text: 'test', priority: 'normal' }, callback2);

      // Wait for both to complete
      await new Promise((r) => setTimeout(r, 100));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});

describe('Singleton helpers', () => {
  let originalWorker: typeof Worker;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWorker.reset();
    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as any;

    // Reset singleton by accessing private variable - in real code we'd export a reset function
    // For testing, we'll just work with what we have
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  describe('getWorkerPool', () => {
    it('returns a worker pool instance', () => {
      const pool = getWorkerPool();
      expect(pool).toBeInstanceOf(IntelligenceWorkerPool);
    });
  });

  describe('initializeWorkerPool', () => {
    it('initializes the singleton pool', async () => {
      await initializeWorkerPool(2);
      const pool = getWorkerPool();
      expect(pool['isInitialized']).toBe(true);
    });
  });

  describe('processChaptersParallel', () => {
    it('processes chapters using the singleton pool', async () => {
      const chapters = [{ id: 'ch-1', text: 'Text' }];

      const results = await processChaptersParallel(chapters);

      expect(results.size).toBe(1);
    });
  });
});
