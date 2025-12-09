import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getMemoriesCached,
  getGoalsCached,
  getWatchedCached,
  preWarmMemoryCache,
  invalidateMemoryCache,
  getMemoryCache,
  resetMemoryCache,
} from '@/services/memory/cache';

const memoryMocks = vi.hoisted(() => ({
  getMemories: vi.fn(),
  getActiveGoals: vi.fn(),
  getWatchedEntities: vi.fn(),
}));

vi.mock('@/services/memory', () => ({
  // Functions used by the cache implementation
  getMemories: (...args: any[]) => memoryMocks.getMemories(...args),
  getActiveGoals: (...args: any[]) => memoryMocks.getActiveGoals(...args),
  getWatchedEntities: (...args: any[]) => memoryMocks.getWatchedEntities(...args),
}));

describe('memory cache (MemoryLRUCache)', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    resetMemoryCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches memories and reports hits/misses in stats', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    memoryMocks.getMemories.mockResolvedValue(notes);

    const cache = getMemoryCache({ ttlMs: 60_000, maxEntries: 10 });

    const first = await getMemoriesCached(projectId, { limit: 10 });
    const second = await getMemoriesCached(projectId, { limit: 10 });

    expect(first).toEqual(notes);
    expect(second).toEqual(notes);
    expect(memoryMocks.getMemories).toHaveBeenCalledTimes(1);

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.entryCount).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.newestEntryAge).toBeGreaterThanOrEqual(0);
  });

  it('respects forceRefresh to bypass cache', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    memoryMocks.getMemories.mockResolvedValue(notes);

    getMemoryCache({ ttlMs: 60_000, maxEntries: 10 });

    await getMemoriesCached(projectId, { limit: 10 });
    await getMemoriesCached(projectId, { limit: 10, forceRefresh: true });

    expect(memoryMocks.getMemories).toHaveBeenCalledTimes(2);
  });

  it('drops expired entries via TTL and fetches again', async () => {
    vi.useFakeTimers();

    const notes = [{ id: 'm1', projectId, text: 'Old note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    memoryMocks.getMemories.mockResolvedValue(notes);

    const cache = getMemoryCache({ ttlMs: 1_000, maxEntries: 10 });

    await cache.getMemories(projectId, { limit: 5 });
    expect(memoryMocks.getMemories).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_500);

    await cache.getMemories(projectId, { limit: 5 });
    expect(memoryMocks.getMemories).toHaveBeenCalledTimes(2);

    const stats = cache.getStats();
    expect(stats.misses).toBeGreaterThanOrEqual(2);
    expect(stats.entryCount).toBe(1);
  });

  it('evicts least recently used entries when over maxEntries', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    memoryMocks.getMemories.mockResolvedValue(notes);

    const cache = getMemoryCache({ ttlMs: 60_000, maxEntries: 2 });

    await cache.getMemories('proj-1', { limit: 10 });
    await cache.getMemories('proj-2', { limit: 10 });
    await cache.getMemories('proj-3', { limit: 10 });

    const callsBefore = memoryMocks.getMemories.mock.calls.length;

    await cache.getMemories('proj-1', { limit: 10 });

    const callsAfter = memoryMocks.getMemories.mock.calls.length;
    expect(callsAfter).toBe(callsBefore + 1);
  });

  it('preWarmMemoryCache populates all caches and uses configured limits', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    const goals = [{ id: 'g1', projectId, title: 'Goal', status: 'active', progress: 0, createdAt: Date.now() }];
    const entities = [{ id: 'e1', projectId, name: 'Watcher', priority: 'high', createdAt: Date.now() }];

    memoryMocks.getMemories.mockResolvedValue(notes as any);
    memoryMocks.getActiveGoals.mockResolvedValue(goals as any);
    memoryMocks.getWatchedEntities.mockResolvedValue(entities as any);

    const cache = getMemoryCache({ preWarmLimit: 25, ttlMs: 60_000, maxEntries: 10 });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await preWarmMemoryCache(projectId);

    expect(memoryMocks.getMemories).toHaveBeenCalledWith({ scope: 'project', projectId, limit: 25 });
    expect(memoryMocks.getActiveGoals).toHaveBeenCalledWith(projectId);
    expect(memoryMocks.getWatchedEntities).toHaveBeenCalledWith(projectId);

    const stats = cache.getStats();
    expect(stats.entryCount).toBeGreaterThanOrEqual(3);

    logSpy.mockRestore();
  });

  it('invalidateMemoryCache clears per-project entries for all caches', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    const goals = [{ id: 'g1', projectId, title: 'Goal', status: 'active', progress: 0, createdAt: Date.now() }];
    const entities = [{ id: 'e1', projectId, name: 'Watcher', priority: 'high', createdAt: Date.now() }];

    memoryMocks.getMemories.mockResolvedValue(notes as any);
    memoryMocks.getActiveGoals.mockResolvedValue(goals as any);
    memoryMocks.getWatchedEntities.mockResolvedValue(entities as any);

    const cache = getMemoryCache({ ttlMs: 60_000, maxEntries: 10 });

    await getMemoriesCached(projectId, { limit: 10 });
    await getGoalsCached(projectId);
    await getWatchedCached(projectId);

    let stats = cache.getStats();
    expect(stats.entryCount).toBe(3);

    invalidateMemoryCache(projectId);

    stats = cache.getStats();
    expect(stats.entryCount).toBe(0);

    await getMemoriesCached(projectId, { limit: 10 });
    await getGoalsCached(projectId);
    await getWatchedCached(projectId);

    expect(memoryMocks.getMemories).toHaveBeenCalledTimes(2);
    expect(memoryMocks.getActiveGoals).toHaveBeenCalledTimes(2);
    expect(memoryMocks.getWatchedEntities).toHaveBeenCalledTimes(2);
  });

  it('resetMemoryCache clears singleton and stats', async () => {
    const notes = [{ id: 'm1', projectId, text: 'Note', topicTags: [], type: 'fact', scope: 'project', importance: 0.5, createdAt: Date.now() }];
    memoryMocks.getMemories.mockResolvedValue(notes);

    const cache = getMemoryCache({ ttlMs: 60_000, maxEntries: 10 });

    await getMemoriesCached(projectId, { limit: 10 });
    await getMemoriesCached(projectId, { limit: 10 });

    const statsBefore = cache.getStats();
    expect(statsBefore.hits + statsBefore.misses).toBeGreaterThan(0);

    resetMemoryCache();

    const fresh = getMemoryCache();
    const statsAfter = fresh.getStats();
    expect(statsAfter.hits).toBe(0);
    expect(statsAfter.misses).toBe(0);
    expect(statsAfter.entryCount).toBe(0);
  });

  it('getStats handles empty caches and returns zero hitRate', () => {
    const cache = getMemoryCache({ ttlMs: 60_000, maxEntries: 10 });

    const stats = cache.getStats();

    expect(stats.entryCount).toBe(0);
    expect(stats.hitRate).toBe(0);
    expect(stats.oldestEntryAge).toBe(0);
    expect(stats.newestEntryAge).toBe(0);
  });
});
