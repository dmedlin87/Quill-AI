/**
 * Memory Cache (Enhancement 5B)
 * 
 * In-memory LRU cache for frequently accessed memories.
 * Pre-warms cache on project load for fast access.
 */

import { MemoryNote, AgentGoal } from './types';
import { getMemories, getActiveGoals, getWatchedEntities, WatchedEntity } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface MemoryCacheConfig {
  maxEntries: number;
  ttlMs: number;
  preWarmLimit: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entryCount: number;
  oldestEntryAge: number;
  newestEntryAge: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU CACHE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LRU Cache for memory data
 */
class MemoryLRUCache {
  private memoriesCache = new Map<string, CacheEntry<MemoryNote[]>>();
  private goalsCache = new Map<string, CacheEntry<AgentGoal[]>>();
  private watchedCache = new Map<string, CacheEntry<WatchedEntity[]>>();
  
  private hits = 0;
  private misses = 0;
  
  private config: MemoryCacheConfig;
  
  constructor(config: Partial<MemoryCacheConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries || 50,
      ttlMs: config.ttlMs || 30000, // 30 seconds default
      preWarmLimit: config.preWarmLimit || 100,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MEMORIES
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get memories from cache or fetch
   */
  async getMemories(
    projectId: string,
    options: { limit?: number; forceRefresh?: boolean } = {}
  ): Promise<MemoryNote[]> {
    this.pruneExpired(this.memoriesCache);

    const { limit = 50, forceRefresh = false } = options;
    const cacheKey = `${projectId}:${limit}`;
    
    const cached = this.memoriesCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && !forceRefresh && (now - cached.fetchedAt) < this.config.ttlMs) {
      // Cache hit
      this.hits++;
      cached.accessCount++;
      cached.lastAccessedAt = now;
      return cached.data;
    }
    
    // Cache miss - fetch from database
    this.misses++;
    
    const memories = await getMemories({
      scope: 'project',
      projectId,
      limit,
    });
    
    // Store in cache
    this.memoriesCache.set(cacheKey, {
      data: memories,
      fetchedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    });
    
    this.evictIfNeeded(this.memoriesCache);
    
    return memories;
  }
  
  /**
   * Invalidate memories cache for a project
   */
  invalidateMemories(projectId: string): void {
    for (const key of this.memoriesCache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        this.memoriesCache.delete(key);
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // GOALS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get active goals from cache or fetch
   */
  async getGoals(
    projectId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<AgentGoal[]> {
    this.pruneExpired(this.goalsCache);

    const { forceRefresh = false } = options;
    
    const cached = this.goalsCache.get(projectId);
    const now = Date.now();
    
    if (cached && !forceRefresh && (now - cached.fetchedAt) < this.config.ttlMs) {
      this.hits++;
      cached.accessCount++;
      cached.lastAccessedAt = now;
      return cached.data;
    }
    
    this.misses++;
    
    const goals = await getActiveGoals(projectId);
    
    this.goalsCache.set(projectId, {
      data: goals,
      fetchedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    });
    
    this.evictIfNeeded(this.goalsCache);
    
    return goals;
  }
  
  /**
   * Invalidate goals cache for a project
   */
  invalidateGoals(projectId: string): void {
    this.goalsCache.delete(projectId);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // WATCHED ENTITIES
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get watched entities from cache or fetch
   */
  async getWatched(
    projectId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<WatchedEntity[]> {
    this.pruneExpired(this.watchedCache);

    const { forceRefresh = false } = options;
    
    const cached = this.watchedCache.get(projectId);
    const now = Date.now();
    
    if (cached && !forceRefresh && (now - cached.fetchedAt) < this.config.ttlMs) {
      this.hits++;
      cached.accessCount++;
      cached.lastAccessedAt = now;
      return cached.data;
    }
    
    this.misses++;
    
    const watched = await getWatchedEntities(projectId);
    
    this.watchedCache.set(projectId, {
      data: watched,
      fetchedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    });
    
    this.evictIfNeeded(this.watchedCache);
    
    return watched;
  }
  
  /**
   * Invalidate watched cache for a project
   */
  invalidateWatched(projectId: string): void {
    this.watchedCache.delete(projectId);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRE-WARMING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Pre-warm cache for a project
   */
  async preWarm(projectId: string): Promise<void> {
    const startTime = Date.now();
    
    // Fetch all in parallel
    await Promise.all([
      this.getMemories(projectId, { limit: this.config.preWarmLimit, forceRefresh: true }),
      this.getGoals(projectId, { forceRefresh: true }),
      this.getWatched(projectId, { forceRefresh: true }),
    ]);
    
    console.log(
      `[MemoryCache] Pre-warmed project ${projectId} in ${Date.now() - startTime}ms`
    );
  }
  
  /**
   * Pre-warm cache for multiple projects
   */
  async preWarmAll(projectIds: string[]): Promise<void> {
    await Promise.all(projectIds.map(id => this.preWarm(id)));
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CACHE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Invalidate all caches for a project
   */
  invalidateProject(projectId: string): void {
    this.invalidateMemories(projectId);
    this.invalidateGoals(projectId);
    this.invalidateWatched(projectId);
  }
  
  /**
   * Clear all caches
   */
  clear(): void {
    this.memoriesCache.clear();
    this.goalsCache.clear();
    this.watchedCache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.pruneExpired(this.memoriesCache);
    this.pruneExpired(this.goalsCache);
    this.pruneExpired(this.watchedCache);

    const totalEntries = 
      this.memoriesCache.size + 
      this.goalsCache.size + 
      this.watchedCache.size;
    
    const now = Date.now();
    let oldestAge = 0;
    let newestAge = Infinity;
    
    const checkEntries = <T>(cache: Map<string, CacheEntry<T>>) => {
      for (const entry of cache.values()) {
        const age = now - entry.fetchedAt;
        oldestAge = Math.max(oldestAge, age);
        newestAge = Math.min(newestAge, age);
      }
    };
    
    checkEntries(this.memoriesCache);
    checkEntries(this.goalsCache);
    checkEntries(this.watchedCache);
    
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 
        ? this.hits / (this.hits + this.misses) 
        : 0,
      entryCount: totalEntries,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge === Infinity ? 0 : newestAge,
    };
  }
  
  /**
   * Evict least recently used entries if over limit
   */
  private evictIfNeeded<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size <= this.config.maxEntries) return;
    
    // Find LRU entry
    let lruKey: string | null = null;
    let lruTime = Infinity;
    
    for (const [key, entry] of cache) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      cache.delete(lruKey);
    }
  }

  /**
   * Drop expired entries to avoid stale data growth
   */
  private pruneExpired<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size === 0) return;
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.fetchedAt >= this.config.ttlMs) {
        cache.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

let cacheInstance: MemoryLRUCache | null = null;

/**
 * Get the memory cache singleton
 */
export const getMemoryCache = (config?: Partial<MemoryCacheConfig>): MemoryLRUCache => {
  if (!cacheInstance) {
    cacheInstance = new MemoryLRUCache(config);
  }
  return cacheInstance;
};

/**
 * Reset the cache (for testing)
 */
export const resetMemoryCache = (): void => {
  if (cacheInstance) {
    cacheInstance.clear();
  }
  cacheInstance = null;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get memories using the cache
 */
export const getMemoriesCached = async (
  projectId: string,
  options?: { limit?: number; forceRefresh?: boolean }
): Promise<MemoryNote[]> => {
  return getMemoryCache().getMemories(projectId, options);
};

/**
 * Get goals using the cache
 */
export const getGoalsCached = async (
  projectId: string,
  options?: { forceRefresh?: boolean }
): Promise<AgentGoal[]> => {
  return getMemoryCache().getGoals(projectId, options);
};

/**
 * Get watched entities using the cache
 */
export const getWatchedCached = async (
  projectId: string,
  options?: { forceRefresh?: boolean }
): Promise<WatchedEntity[]> => {
  return getMemoryCache().getWatched(projectId, options);
};

/**
 * Pre-warm cache for a project
 */
export const preWarmMemoryCache = async (projectId: string): Promise<void> => {
  return getMemoryCache().preWarm(projectId);
};

/**
 * Invalidate cache when data changes
 */
export const invalidateMemoryCache = (projectId: string): void => {
  getMemoryCache().invalidateProject(projectId);
};
