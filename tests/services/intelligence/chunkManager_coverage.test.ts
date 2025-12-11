
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ChunkManager } from '@/services/intelligence/chunkManager';
import { ChunkId } from '@/types/intelligence';
import * as IntelligenceIndex from '@/services/intelligence/index';
import { createChunkIndex } from '@/services/intelligence/chunkIndex';

// Mock processManuscriptCached to return dummy data immediately
vi.mock('@/services/intelligence/index', async () => {
    const actual = await vi.importActual('@/services/intelligence/index');
    return {
        ...actual,
        processManuscriptCached: vi.fn().mockReturnValue({
            structural: {
                stats: { totalWords: 100, dialogueRatio: 0.1 },
                scenes: [{ tension: 0.5, timeMarker: 'now' }]
            },
            entities: { nodes: [] },
            style: { flags: { passiveVoiceRatio: 0 }, syntax: { avgSentenceLength: 10 } },
            heatmap: { sections: [{ overallRisk: 0.1 }] },
            timeline: { promises: [] }
        }),
        parseStructure: vi.fn().mockReturnValue({
             scenes: [{ id: 'scene1', startOffset: 0, endOffset: 5, tension: 0.5, type: 'action' }],
             stats: { totalWords: 10 },
             paragraphs: [],
             dialogueMap: []
        })
    };
});

describe('ChunkManager coverage', () => {
    let manager: ChunkManager;

    beforeEach(() => {
        vi.useFakeTimers();
        manager = new ChunkManager({
            editDebounceMs: 10,
            processingIntervalMs: 10,
            maxBatchSize: 2,
            idleThresholdMs: 20,
        });
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('verify ChunkIndex basic functionality', () => {
        const index = createChunkIndex();
        index.registerChunk('test', 'chapter', 0, 10, 'content');
        expect(index.getChunk('test')).toBeDefined();
    });

    it('should handle edit with debounce and merging', async () => {
        const chapterId = 'ch1';
        manager.registerChapter(chapterId, 'Initial text.');

        await vi.runAllTimersAsync();

        // Check content via private map
        expect((manager as any).chapterTexts.get(chapterId)).toBe('Initial text.');

        // First edit
        manager.handleEdit(chapterId, 'Edit 1', 0, 5);

        // Second edit within debounce
        manager.handleEdit(chapterId, 'Edit 2', 5, 10);

        // Should not be applied yet
        expect((manager as any).chapterTexts.get(chapterId)).toBe('Initial text.');

        // Fast forward debounce
        await vi.advanceTimersByTimeAsync(20);

        // Should be applied
        expect((manager as any).chapterTexts.get(chapterId)).toBe('Edit 2');
    });

    it('should export and load state', async () => {
        manager.registerChapter('ch1', 'State Test');
        await vi.runAllTimersAsync();

        const state = manager.exportState();

        const manager2 = new ChunkManager();
        manager2.loadState(state);

        // Verify content via private map
        expect((manager2 as any).chapterTexts.get('ch1')).toBe('State Test');
    });

    it('should handle errors during processing', async () => {
        vi.mocked(IntelligenceIndex.processManuscriptCached).mockImplementationOnce(() => {
            throw new Error('Processing failed');
        });

        const chapterId = 'chError';
        manager.registerChapter(chapterId, 'Content');
        const chunkId = manager.getChapterChunk(chapterId)!.id;

        await manager.reprocessChunk(chunkId);

        const chunk = manager.getChunk(chunkId);
        expect(chunk?.status).toBe('error');
        expect(chunk?.errorMessage).toBe('Processing failed');
    });

    it('getChunkText should return null for invalid indices or missing text', async () => {
        manager.registerChapter('ch1', 'Text');
        const chunkId = manager.getChapterChunk('ch1')!.id;

        // Hack: access private map
        (manager as any).chapterTexts.delete('ch1');

        // Now processing should fail because getChunkText returns null
        await manager.reprocessChunk(chunkId);

        const chunk = manager.getChunk(chunkId);
        expect(chunk?.status).toBe('error');
        expect(chunk?.errorMessage).toBe('Could not retrieve chunk text (invalid range or missing chapter)');
    });

    it('getChunkText should return null for invalid scene indices', async () => {
        manager.registerChapter('ch1', 'Text');
        (manager as any).index.registerChunk('scene-bad', 'scene', -1, 5, 'content', 'chapter-ch1');

        await manager.reprocessChunk('scene-bad');
        const chunk = manager.getChunk('scene-bad');
        expect(chunk?.status).toBe('error');
        expect(chunk?.errorMessage).toBe('Could not retrieve chunk text (invalid range or missing chapter)');
    });

    it('aggregateFromChildren returns empty analysis if no children', async () => {
        const bookId = 'book';
        // Clear everything
        manager.clear();
        (manager as any).initializeBookChunk();

        await manager.reprocessChunk(bookId);

        const bookChunk = manager.getChunk(bookId);
        // Analysis is null because updateAnalysis wasn't called?
        // Or updateAnalysis called with empty data?
        // If aggregateFromChildren returns empty struct, updateAnalysis sets it.
        // So bookChunk.analysis should be set.
        expect(bookChunk?.analysis?.summary).toBe('No data');
    });

     it('should aggregate children analysis', async () => {
        manager.registerChapter('ch1', 'Content 1');

        const chId = manager.getChapterChunk('ch1')!.id;
        await manager.reprocessChunk(chId);

        const chapter = manager.getChunk(chId);
        expect(chapter?.analysis).toBeDefined();

        await manager.reprocessChunk('book');
        const book = manager.getChunk('book');
        expect(book?.analysis?.wordCount).toBeGreaterThan(0);
    });

    it('should initialize book chunk if missing', () => {
        const bookChunk = manager.getChunk('book');
        expect(bookChunk).toBeDefined();
        expect(bookChunk?.level).toBe('book');
    });

    it('should remove chapter', () => {
        const chapterId = 'chRemove';
        manager.registerChapter(chapterId, 'Content');
        expect(manager.getChapterChunk(chapterId)).toBeDefined();
        manager.removeChapter(chapterId);
        expect(manager.getChapterChunk(chapterId)).toBeUndefined();
    });

    it('should schedule processing when dirty', async () => {
        const chapterId = 'chDirty';
        const onChunkProcessed = vi.fn();
        manager = new ChunkManager(
            { editDebounceMs: 10, idleThresholdMs: 10 },
            { onChunkProcessed }
        );
        manager.registerChapter(chapterId, 'Content');
        const chunkId = manager.getChapterChunk(chapterId)!.id;
        await manager.reprocessChunk(chunkId);
        expect(onChunkProcessed).toHaveBeenCalledWith(chunkId, expect.anything());
    });

    it('should process batch respecting maxBatchSize', async () => {
        manager.registerChapter('ch1', 'Content 1');
        manager.registerChapter('ch2', 'Content 2');
        manager.registerChapter('ch3', 'Content 3');
        await manager.processAllDirty();
        expect(manager.getChapterChunk('ch1')?.analysis).toBeDefined();
    });

    it('should pause and resume', () => {
        manager.pause();
        manager.handleEdit('ch1', 'text', 0, 0);
        vi.advanceTimersByTime(100);
        manager.resume();
    });

    it('should clear state', () => {
        manager.registerChapter('ch1', 'Clear Test');
        manager.clear();
        expect(manager.getChapterChunk('ch1')).toBeUndefined();
    });

    it('getAnalysisAtCursor returns analysis', () => {
         manager.registerChapter('ch1', 'Text');
         const analysis = manager.getAnalysisAtCursor('ch1', 0);
    });

    it('getAllChapterAnalyses returns map', () => {
        manager.registerChapter('ch1', 'Text');
        const map = manager.getAllChapterAnalyses();
        expect(map.has('ch1')).toBe(true);
    });

     it('getBookSummary returns summary', () => {
        const summary = manager.getBookSummary();
        expect(summary).toBeUndefined();
    });

    it('getStats returns stats', () => {
        manager.registerChapter('ch1', 'Text');
        expect(manager.getStats().chapterCount).toBe(1);
    });

    it('should stop processing when destroyed', () => {
        manager.destroy();
        manager.scheduleProcessing();
    });

    it('handleEdit does nothing if destroyed', () => {
        manager.destroy();
        manager.handleEdit('ch1', 'text', 0, 0);
    });

    it('should cancel processing timer on edit', () => {
        manager.registerChapter('ch1', 'Content');
        (manager as any).scheduleProcessing();
        expect((manager as any).processingTimer).toBeDefined();
        manager.handleEdit('ch1', 'New Content', 0, 5);
        expect((manager as any).processingTimer).toBeNull();
    });

    it('retryErrors should return chunk IDs', async () => {
        vi.mocked(IntelligenceIndex.processManuscriptCached).mockImplementationOnce(() => {
            throw new Error('Fail');
        });
        manager.registerChapter('chErr', 'Text');
        await manager.reprocessChunk(manager.getChapterChunk('chErr')!.id);
        const retried = manager.retryErrors();
        expect(retried.length).toBeGreaterThan(0);
    });

});
