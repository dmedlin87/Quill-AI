import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMemoryIntelligence } from '@/features/agent/hooks/useMemoryIntelligence';
import { eventBus } from '@/services/appBrain';
import {
  observeAnalysisResults,
  observeIntelligenceResults,
} from '@/services/memory/autoObserver';
import {
  runConsolidation,
  reinforceMemory,
  getMemoryHealthStats,
} from '@/services/memory/consolidation';
import { getActiveGoals, evolveBedsideNote } from '@/services/memory';
import { serializeBedsideNote } from '@/services/memory/bedsideNoteSerializer';

// Mocks
vi.mock('@/services/appBrain', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        eventBus: {
            subscribe: vi.fn(),
            emit: vi.fn(),
        },
    };
});
vi.mock('@/services/memory/autoObserver');
vi.mock('@/services/memory/consolidation');
vi.mock('@/services/memory');
vi.mock('@/services/memory/bedsideNoteSerializer');

describe('useMemoryIntelligence', () => {
    const mockProjectId = 'p1';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Default Mocks
        (eventBus.subscribe as any).mockReturnValue(vi.fn());
        (observeAnalysisResults as any).mockResolvedValue({ created: [], skipped: 0 });
        (observeIntelligenceResults as any).mockResolvedValue({ created: [], skipped: 0 });
        (runConsolidation as any).mockResolvedValue({ duration: 100, merged: 0 });
        (reinforceMemory as any).mockResolvedValue(true);
        (getMemoryHealthStats as any).mockResolvedValue({ totalMemories: 10 });
        (getActiveGoals as any).mockResolvedValue([]);
        (serializeBedsideNote as any).mockReturnValue({ text: 'Bedside Note' });
        (evolveBedsideNote as any).mockResolvedValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes and runs consolidation on mount', async () => {
        renderHook(() => useMemoryIntelligence({
            projectId: mockProjectId,
            consolidateOnMount: true
        }));

        // Should run consolidation after 2000ms
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(runConsolidation).toHaveBeenCalledWith({ projectId: mockProjectId });
        expect(getMemoryHealthStats).toHaveBeenCalledWith(mockProjectId);
    });

    it('skips consolidation on mount if disabled', async () => {
        renderHook(() => useMemoryIntelligence({
            projectId: mockProjectId,
            consolidateOnMount: false
        }));

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(runConsolidation).not.toHaveBeenCalled();
    });

    it('runs consolidation periodically', async () => {
        renderHook(() => useMemoryIntelligence({
            projectId: mockProjectId,
            consolidateOnMount: false,
            consolidationIntervalMs: 5000
        }));

        expect(runConsolidation).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(5000);
        });

        expect(runConsolidation).toHaveBeenCalledTimes(1);
    });

    it('observes analysis results', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        const mockAnalysis = { summary: 'Sum', weaknesses: [], plotIssues: [], generalSuggestions: [] } as any;

        await act(async () => {
            await result.current.observeAnalysis(mockAnalysis);
        });

        expect(observeAnalysisResults).toHaveBeenCalledWith(mockAnalysis, { projectId: mockProjectId });
        expect(evolveBedsideNote).toHaveBeenCalled();
        expect(result.current.lastObservation).toBeDefined();
    });

    it('handles Bedside Note serialization failure during analysis observation', async () => {
        // serializeBedsideNote returns null if content invalid
        (serializeBedsideNote as any).mockReturnValue({ text: '' });

        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));
        const mockAnalysis = { summary: 'Sum' } as any;

        await act(async () => {
            await result.current.observeAnalysis(mockAnalysis);
        });

        expect(observeAnalysisResults).toHaveBeenCalled();
        // Since text is empty, buildBedsidePlan returns null, so evolveBedsideNote is NOT called
        expect(evolveBedsideNote).not.toHaveBeenCalled();
    });

    it('handles errors when evolving bedside note', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (evolveBedsideNote as any).mockRejectedValue(new Error('Evolve failed'));

        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));
        const mockAnalysis = { summary: 'Sum' } as any;

        await act(async () => {
            await result.current.observeAnalysis(mockAnalysis);
        });

        // It should catch the error and log a warning
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to evolve'), expect.any(Error));
        expect(result.current.isObserving).toBe(false); // Should clear loading state
        consoleSpy.mockRestore();
    });

    it('observes intelligence results', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        const mockIntel = { some: 'data' } as any;

        await act(async () => {
            await result.current.observeIntelligence(mockIntel);
        });

        expect(observeIntelligenceResults).toHaveBeenCalledWith(mockIntel, { projectId: mockProjectId });
    });

    it('consolidates manually', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId, consolidateOnMount: false }));

        await act(async () => {
            await result.current.consolidate();
        });

        expect(runConsolidation).toHaveBeenCalled();
    });

    it('prevents concurrent consolidation', async () => {
         const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId, consolidateOnMount: false }));

         (runConsolidation as any).mockImplementation(() => new Promise(r => setTimeout(r, 100)));

         let p1: any;
         let p2: any;

         await act(async () => {
             p1 = result.current.consolidate();
             p2 = result.current.consolidate();
         });

         await act(async () => {
             vi.advanceTimersByTime(100);
         });

         await p1;
         const res2 = await p2;

         expect(runConsolidation).toHaveBeenCalledTimes(1);
         expect(res2.errors).toContain('Consolidation already in progress');
    });

    it('reinforces used memory', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        await act(async () => {
            await result.current.reinforceUsed('m1', 'retrieval');
        });

        expect(reinforceMemory).toHaveBeenCalledWith({ memoryId: 'm1', reason: 'retrieval' });
    });

    it('handles no project ID', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: null }));

        const res = await act(async () => {
            return await result.current.consolidate();
        });

        expect(runConsolidation).not.toHaveBeenCalled();
        expect(res.errors).toContain('No project ID');
    });

    it('refreshes health stats', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.refreshHealthStats();
        });

        expect(getMemoryHealthStats).toHaveBeenCalled();
        expect(result.current.healthStats?.totalMemories).toBe(10);
    });

    it('handles error when refreshing health stats', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (getMemoryHealthStats as any).mockRejectedValue(new Error('Stats failed'));

        const { result } = renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.refreshHealthStats();
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get health stats'), expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('returns an error when observing intelligence with no project ID', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: null }));

        const mockIntel = { some: 'data' } as any;

        const observation = await act(async () => {
            return await result.current.observeIntelligence(mockIntel);
        });

        expect(observeIntelligenceResults).not.toHaveBeenCalled();
        expect(observation.errors).toContain('No project ID');
    });

    it('returns an error when observing analysis with no project ID', async () => {
        const { result } = renderHook(() => useMemoryIntelligence({ projectId: null }));

        const mockAnalysis = { summary: 'Sum' } as any;

        const observation = await act(async () => {
            return await result.current.observeAnalysis(mockAnalysis);
        });

        expect(observeAnalysisResults).not.toHaveBeenCalled();
        expect(observation.errors).toContain('No project ID');
    });

    it('clears health stats when project ID is cleared', async () => {
        const { result, rerender } = renderHook(
            (props: { projectId: string | null }) =>
                useMemoryIntelligence({ projectId: props.projectId }),
            { initialProps: { projectId: mockProjectId } },
        );

        await act(async () => {
            await result.current.refreshHealthStats();
        });

        expect(result.current.healthStats?.totalMemories).toBe(10);

        rerender({ projectId: null });

        await act(async () => {
            await result.current.refreshHealthStats();
        });

        expect(result.current.healthStats).toBeNull();
    });

    it('cleans up consolidation interval on unmount', async () => {
        const clearSpy = vi.spyOn(global, 'clearInterval');

        const { unmount } = renderHook(() =>
            useMemoryIntelligence({
                projectId: mockProjectId,
                consolidateOnMount: false,
                consolidationIntervalMs: 5000,
            }),
        );

        // Interval registered but not yet fired
        expect(runConsolidation).not.toHaveBeenCalled();

        unmount();

        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });

    it('responds to ANALYSIS_COMPLETED events', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        let callback: (event: any) => void = () => {};

        (eventBus.subscribe as any).mockImplementation((event: string, cb: any) => {
            if (event === 'ANALYSIS_COMPLETED') {
                callback = cb;
            }
            return vi.fn();
        });

        renderHook(() => useMemoryIntelligence({ projectId: mockProjectId }));

        await act(async () => {
            callback({ type: 'ANALYSIS_COMPLETED', payload: 'Section' });
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analysis completed'), 'Section');
        consoleSpy.mockRestore();
    });

    it('does not respond to ANALYSIS_COMPLETED if autoObserve is disabled', async () => {
        let callback: (event: any) => void = () => {};

        (eventBus.subscribe as any).mockImplementation((event: string, cb: any) => {
            if (event === 'ANALYSIS_COMPLETED') {
                callback = cb;
            }
            return vi.fn();
        });

        renderHook(() => useMemoryIntelligence({ projectId: mockProjectId, autoObserveEnabled: false }));

        // The hook returns early if not enabled, so subscription might not even happen.
        // But if it does (e.g. implementation details), callback shouldn't fire logic.
        // Actually the implementation doesn't subscribe if autoObserveEnabled is false.

        expect(eventBus.subscribe).not.toHaveBeenCalledWith('ANALYSIS_COMPLETED', expect.any(Function));
    });
});
