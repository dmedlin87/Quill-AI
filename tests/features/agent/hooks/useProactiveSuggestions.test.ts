import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProactiveSuggestions } from '@/features/agent/hooks/useProactiveSuggestions';
import { eventBus, startProactiveThinker, stopProactiveThinker, getProactiveThinker } from '@/services/appBrain';
import {
  generateSuggestionsForChapter,
  getImportantReminders,
} from '@/services/memory/proactive';
import { createMemory, evolveBedsideNote } from '@/services/memory';
import { markLoreEntityDismissed } from '@/services/memory/relevance';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';

// Mocks
vi.mock('@/services/appBrain', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        eventBus: {
            subscribe: vi.fn(),
            emit: vi.fn(), // We might need this if we trigger internal events
        },
        startProactiveThinker: vi.fn(),
        stopProactiveThinker: vi.fn(),
        getProactiveThinker: vi.fn(),
    };
});
vi.mock('@/services/memory/proactive');
vi.mock('@/services/memory');
vi.mock('@/services/memory/relevance');
vi.mock('@/features/layout/store/useLayoutStore');

describe('useProactiveSuggestions', () => {
    const mockProjectId = 'p1';
    const mockGetAppBrainState = vi.fn();
    const mockOpenLoreDraft = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        (useLayoutStore.getState as any) = vi.fn().mockReturnValue({
             openLoreDraft: mockOpenLoreDraft
        });

        // Setup EventBus subscribe to return unsubscribe function
        (eventBus.subscribe as any).mockReturnValue(vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes and cleans up correctly', () => {
        const { unmount } = renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
            getAppBrainState: mockGetAppBrainState
        }));

        expect(startProactiveThinker).toHaveBeenCalledWith(
            mockGetAppBrainState,
            mockProjectId,
            expect.any(Function)
        );

        unmount();

        expect(stopProactiveThinker).toHaveBeenCalled();
    });

    it('does not start thinker if disabled', () => {
        renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
            getAppBrainState: mockGetAppBrainState,
            enableProactiveThinking: false
        }));

        expect(startProactiveThinker).not.toHaveBeenCalled();
    });

    it('manually checks for suggestions', async () => {
        const mockSuggestion = { id: 's1', source: { id: 'src1' }, type: 'plot' };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
        }));

        await act(async () => {
            await result.current.checkForSuggestions('c1', 'Chapter 1', 'Content');
        });

        expect(generateSuggestionsForChapter).toHaveBeenCalledWith(
            mockProjectId,
            { chapterId: 'c1', chapterTitle: 'Chapter 1', content: 'Content' }
        );
        expect(result.current.suggestions).toEqual([mockSuggestion]);
    });

    it('deduplicates suggestions', async () => {
        const mockSuggestion1 = { id: 's1', source: { id: 'src1' }, type: 'plot' };

        // Test calling twice with same suggestion
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion1]);

        const { result } = renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
        }));

        await act(async () => {
            await result.current.checkForSuggestions('c1', 'Chapter 1');
        });
        expect(result.current.suggestions.length).toBe(1);

        await act(async () => {
            await result.current.checkForSuggestions('c1', 'Chapter 1');
        });
        expect(result.current.suggestions.length).toBe(1); // Deduped against previous state
    });

    it('dismisses a suggestion', async () => {
        const mockSuggestion = { id: 's1', source: { id: 'src1' }, type: 'plot' };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });
        expect(result.current.suggestions.length).toBe(1);

        act(() => {
            result.current.dismissSuggestion('s1');
        });

        expect(result.current.suggestions.length).toBe(0);
    });

    it('dismisses all suggestions', async () => {
         const mockSuggestion = { id: 's1', source: { id: 'src1' }, type: 'plot' };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });

        act(() => {
            result.current.dismissAll();
        });

        expect(result.current.suggestions.length).toBe(0);
    });

    it('auto-dismisses suggestions', async () => {
        const mockSuggestion = { id: 's1', source: { id: 'src1' }, type: 'plot' };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
            autoDismissMs: 1000
        }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });
        expect(result.current.suggestions.length).toBe(1);

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.suggestions.length).toBe(0);
    });

    it('applies suggestion and records feedback', async () => {
        const mockSuggestion = {
            id: 's1',
            source: { id: 'src1' },
            type: 'plot',
            title: 'Title',
            description: 'Desc'
        };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });

        await act(async () => {
            await result.current.applySuggestion(mockSuggestion as any);
        });

        expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
            projectId: mockProjectId,
            type: 'observation',
            importance: 0.8, // Applied is high importance
        }));
        expect(evolveBedsideNote).toHaveBeenCalled();
        expect(result.current.suggestions.length).toBe(0); // Should auto dismiss on apply
    });

    it('handles lore discovery suggestion application', async () => {
         const mockSuggestion = {
            id: 's1',
            source: { id: 'src1' },
            type: 'lore_discovery',
            title: 'New Char',
            description: 'Bio',
            metadata: { entityName: 'Bob' }
        };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });

        await act(async () => {
            await result.current.applySuggestion(mockSuggestion as any);
        });

        expect(markLoreEntityDismissed).toHaveBeenCalledWith('Bob');
        expect(mockOpenLoreDraft).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Bob',
            bio: 'Bio'
        }));
    });

    it('provides feedback', async () => {
        const mockSuggestion = {
            id: 's1',
            source: { id: 'src1' },
            type: 'plot',
            title: 'Title',
            description: 'Desc'
        };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             await result.current.checkForSuggestions('c1', 'Ch 1');
        });

        // Helpful (keeps suggestion? No, keep it.)
        await act(async () => {
            await result.current.provideFeedback(mockSuggestion as any, 'helpful');
        });
        expect(result.current.suggestions.length).toBe(1);

        // Dismissed (removes suggestion)
        await act(async () => {
            await result.current.provideFeedback(mockSuggestion as any, 'dismissed');
        });
        expect(result.current.suggestions.length).toBe(0);
    });

    it('responds to chapter switch event', async () => {
         const mockSuggestion = { id: 's1', source: { id: 'src1' }, type: 'plot' };
        (generateSuggestionsForChapter as any).mockResolvedValue([mockSuggestion]);

        // We need to capture the event callback
        let eventCallback: any;
        (eventBus.subscribe as any).mockImplementation((event: string, cb: any) => {
             if (event === 'CHAPTER_SWITCHED') eventCallback = cb;
             return vi.fn();
        });

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
             if (eventCallback) {
                 await eventCallback({ type: 'CHAPTER_SWITCHED', payload: { chapterId: 'c2', title: 'Chapter 2' } });
             }
        });

        expect(generateSuggestionsForChapter).toHaveBeenCalledWith(
            mockProjectId,
            expect.objectContaining({ chapterId: 'c2' })
        );
        expect(result.current.suggestions).toEqual([mockSuggestion]);
    });

    it('handles ProactiveThinker events', () => {
        let startedCb: any, completedCb: any;
        (eventBus.subscribe as any).mockImplementation((event: string, cb: any) => {
             if (event === 'PROACTIVE_THINKING_STARTED') startedCb = cb;
             if (event === 'PROACTIVE_THINKING_COMPLETED') completedCb = cb;
             return vi.fn();
        });

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        expect(result.current.isThinking).toBe(false);

        act(() => {
            if (startedCb) startedCb();
        });
        expect(result.current.isThinking).toBe(true);

        act(() => {
            if (completedCb) completedCb();
        });
        expect(result.current.isThinking).toBe(false);
    });

    it('forces think', async () => {
        const mockForceThink = vi.fn();
        (getProactiveThinker as any).mockReturnValue({ forceThink: mockForceThink });

        const { result } = renderHook(() => useProactiveSuggestions({ projectId: mockProjectId }));

        await act(async () => {
            await result.current.forceThink();
        });

        expect(mockForceThink).toHaveBeenCalled();
    });

    it('receives suggestions from background thinker', async () => {
        // Capture the handleProactiveSuggestion callback passed to startProactiveThinker
        let handleSuggestion: any;
        (startProactiveThinker as any).mockImplementation((_state: any, _pid: any, cb: any) => {
            handleSuggestion = cb;
        });

        const { result } = renderHook(() => useProactiveSuggestions({
            projectId: mockProjectId,
            getAppBrainState: mockGetAppBrainState
        }));

        const mockSuggestion = { id: 'bg1', source: { id: 'src_bg' }, type: 'style' };

        act(() => {
            if (handleSuggestion) {
                handleSuggestion(mockSuggestion);
            }
        });

        expect(result.current.suggestions).toContainEqual(mockSuggestion);
    });
});
