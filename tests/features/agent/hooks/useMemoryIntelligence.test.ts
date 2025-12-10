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
         await p2;

         expect(runConsolidation).toHaveBeenCalledTimes(1);
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
});
