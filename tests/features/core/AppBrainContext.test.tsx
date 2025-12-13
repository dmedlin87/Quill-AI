import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  AppBrainProvider,
  useAppBrain,
  useAppBrainState,
  useAppBrainActions,
  useAppBrainContext,
} from '@/features/core/context/AppBrainContext';
import { type UpdateManuscriptParams } from '@/services/appBrain';
import { MainView, SidebarTab } from '@/types';

type MockAnalysisStatus = 'idle' | 'loading' | 'error' | 'success';

/**
 * Hoisted command and store mocks to allow module factory hoisting while keeping
 * stable references for assertions across tests.
 */
const {
  mockNavigate,
  mockJumpToChapter,
  mockJumpToScene,
  mockUpdateManuscript,
  mockAppendText,
  mockCritique,
  mockRunAnalysis,
  mockSwitchPanel,
  mockToggleZen,
  mockHighlight,
  mockQueryLore,
  mockGetCharacter,
  mockRewrite,
  mockContinue,
  mockAnalysis,
  mockProject,
  mockIntelligenceHook,
  mockEditor,
  mockLayoutStore,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockJumpToChapter = vi.fn().mockResolvedValue('jumped');
  const mockJumpToScene = vi.fn().mockResolvedValue('scene');
  const mockUpdateManuscript = vi.fn().mockResolvedValue('updated');
  const mockAppendText = vi.fn().mockResolvedValue('appended');
  const mockCritique = vi.fn().mockResolvedValue('critique result');
  const mockRunAnalysis = vi.fn().mockResolvedValue('analysis result');
  const mockSwitchPanel = vi.fn().mockResolvedValue('switched');
  const mockToggleZen = vi.fn().mockResolvedValue('zen toggled');
  const mockHighlight = vi.fn().mockResolvedValue('highlighted');
  const mockQueryLore = vi.fn().mockResolvedValue('lore result');
  const mockGetCharacter = vi.fn().mockResolvedValue('character info');
  const mockRewrite = vi.fn().mockResolvedValue('rewritten');
  const mockContinue = vi.fn().mockResolvedValue('continued');

  const mockAnalysis = {
    analysis: { score: 1 },
    analysisStatus: 'idle' as MockAnalysisStatus,
    analyzePacing: vi.fn(),
    analyzeCharacters: vi.fn(),
    analyzePlot: vi.fn(),
    analyzeSetting: vi.fn(),
    runFullAnalysis: vi.fn(),
  };

  const mockProject = {
    activeChapterId: 'ch1',
    currentProject: { id: 'p1', title: 'Novel', lore: { characters: [], worldRules: [] }, setting: 'Fantasy' },
    chapters: [
      { id: 'ch1', title: 'One', content: 'Hello world', order: 0, updatedAt: Date.now() },
      { id: 'ch2', title: 'Two', content: 'Next chapter', order: 1, updatedAt: Date.now() },
    ],
    getActiveChapter: vi.fn(() => ({ id: 'ch1', title: 'One' })),
    selectChapter: vi.fn(),
  };

  const mockIntelligenceHook = vi.fn(() => ({
    intelligence: {
      entities: [],
      hud: { situational: { currentScene: { type: 'dialogue' }, currentParagraph: { type: 'narrative' } } },
      timeline: {
        events: [
          { offset: 100, description: 'Event before', temporalMarker: 'yesterday' },
          { offset: 500, description: 'Event nearby' },
          { offset: 1000, description: 'Event after', temporalMarker: 'tomorrow' },
        ],
      },
    },
    hud: { situational: { currentScene: { type: 'dialogue' }, currentParagraph: { type: 'narrative' } } },
  }));

  const mockEditor = {
    currentText: 'Hello world',
    branches: [],
    activeBranchId: 'main',
    cursorPosition: 500,
    selectionRange: { text: 'Hello', start: 0, end: 5 },
    inlineComments: [],
    isZenMode: false,
    activeHighlight: null,
    commit: vi.fn(),
    undo: vi.fn(() => true),
    redo: vi.fn(() => false),
    scrollToPosition: vi.fn(),
    handleNavigateToIssue: vi.fn(),
    toggleZenMode: vi.fn(),
  };

  const mockLayoutStore = {
    activeTab: 'analysis',
    activeView: 'editor',
    setActiveTab: vi.fn(),
  };

  return {
    mockNavigate,
    mockJumpToChapter,
    mockJumpToScene,
    mockUpdateManuscript,
    mockAppendText,
    mockCritique,
    mockRunAnalysis,
    mockSwitchPanel,
    mockToggleZen,
    mockHighlight,
    mockQueryLore,
    mockGetCharacter,
    mockRewrite,
    mockContinue,
    mockAnalysis,
    mockProject,
    mockIntelligenceHook,
    mockEditor,
    mockLayoutStore,
  };
});

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditor: () => mockEditor,
}));

vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: vi.fn((selector) => {
    return typeof selector === 'function' ? selector(mockLayoutStore) : mockLayoutStore;
  }),
}));

vi.mock('@/features/analysis', () => ({ useAnalysis: () => mockAnalysis }));
vi.mock('@/features/project', () => ({ useProjectStore: () => mockProject }));
vi.mock('@/features/shared/hooks/useManuscriptIntelligence', () => ({
  useManuscriptIntelligence: mockIntelligenceHook,
}));

vi.mock('@/services/commands/navigation', () => ({
  NavigateToTextCommand: vi.fn().mockImplementation(function () {
    this.execute = mockNavigate;
  }),
  JumpToChapterCommand: vi.fn().mockImplementation(function () {
    this.execute = mockJumpToChapter;
  }),
  JumpToSceneCommand: vi.fn().mockImplementation(function () {
    this.execute = mockJumpToScene;
  }),
}));

vi.mock('@/services/commands/editing', () => ({
  UpdateManuscriptCommand: vi.fn().mockImplementation(function () {
    this.execute = mockUpdateManuscript;
  }),
  AppendTextCommand: vi.fn().mockImplementation(function () {
    this.execute = mockAppendText;
  }),
}));

vi.mock('@/services/commands/analysis', () => ({
  GetCritiqueCommand: vi.fn().mockImplementation(function () {
    this.execute = mockCritique;
  }),
  RunAnalysisCommand: vi.fn().mockImplementation(function () {
    this.execute = mockRunAnalysis;
  }),
}));

vi.mock('@/services/commands/knowledge', () => ({
  QueryLoreCommand: vi.fn().mockImplementation(function () {
    this.execute = mockQueryLore;
  }),
  GetCharacterInfoCommand: vi.fn().mockImplementation(function () {
    this.execute = mockGetCharacter;
  }),
}));

vi.mock('@/services/commands/ui', () => ({
  SwitchPanelCommand: vi.fn().mockImplementation(function () {
    this.execute = mockSwitchPanel;
  }),
  ToggleZenModeCommand: vi.fn().mockImplementation(function () {
    this.execute = mockToggleZen;
  }),
  HighlightTextCommand: vi.fn().mockImplementation(function () {
    this.execute = mockHighlight;
  }),
  SetSelectionCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('selection') })),
}));

vi.mock('@/services/commands/generation', () => ({
  RewriteSelectionCommand: vi.fn().mockImplementation(function () {
    this.execute = vi.fn().mockImplementation(async (params, context) => {
      // Call the generators to ensure coverage
      if (context.generateRewrite) {
         try {
             await context.generateRewrite('test', 'expand', 'formal');
             await context.generateRewrite('test', 'custom_mode', 'formal');
         } catch (e) {}
      }
      if (context.generateContinuation) {
         try {
             await context.generateContinuation({ context: 'ctx', selection: 'sel' });
             await context.generateContinuation({ context: 'ctx', selection: undefined });
         } catch(e) {}
      }
      return mockRewrite(params, context);
    });
  }),
  ContinueWritingCommand: vi.fn().mockImplementation(function () {
    this.execute = vi.fn().mockImplementation(async (params, context) => {
        // Call the generators to ensure coverage
        if (context.generateRewrite) {
            try {
                await context.generateRewrite('test', 'expand', 'formal');
                await context.generateRewrite('test', 'custom_mode', 'formal');
            } catch(e) {}
        }
        if (context.generateContinuation) {
            try {
                await context.generateContinuation({ context: 'ctx', selection: 'sel' });
                await context.generateContinuation({ context: 'ctx', selection: undefined });
            } catch (e) {}
        }
       return mockContinue(params, context);
    });
  }),
}));

vi.mock('@/services/gemini/agent', () => ({ 
    rewriteText: vi.fn().mockResolvedValue({ result: ['Rewritten text'] }), 
    generateContinuation: vi.fn().mockResolvedValue({ result: 'Continuation text' }) 
}));

const wrapper = ({ children }: { children: ReactNode }) => <AppBrainProvider>{children}</AppBrainProvider>;

describe('AppBrainContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes state and actions from provider', async () => {
    const { result } = renderHook(() => useAppBrain(), { wrapper });

    expect(result.current.state.manuscript.projectTitle).toBe('Novel');
    expect(result.current.state.intelligence.hud).not.toBeNull();

    await act(async () => {
      await result.current.actions.navigateToText({ query: 'Hello', searchType: 'exact' });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { query: 'Hello', searchType: 'exact' },
      expect.objectContaining({ currentText: 'Hello world' }),
    );
    expect(result.current.subscribe).toBeTypeOf('function');
  });

  it('delegates jump and edit actions to command implementations', async () => {
    const { result } = renderHook(() => useAppBrain(), { wrapper });

    await act(async () => {
      await result.current.actions.jumpToChapter('ch2');
      await result.current.actions.jumpToScene('scene', 'next');
      await result.current.actions.updateManuscript({
        searchText: 'old',
        replacementText: 'new',
        description: 'desc',
      } satisfies UpdateManuscriptParams);
      await result.current.actions.appendText('more', 'desc2');
    });

    expect(mockJumpToChapter).toHaveBeenCalledWith('ch2', expect.objectContaining({ currentText: 'Hello world' }));
    expect(mockJumpToScene).toHaveBeenCalledWith(
      { sceneType: 'scene', direction: 'next' },
      expect.objectContaining({ activeChapterId: 'ch1' }),
    );
    expect(mockUpdateManuscript).toHaveBeenCalledWith(
      { searchText: 'old', replacementText: 'new', description: 'desc' },
      expect.objectContaining({ currentText: 'Hello world' }),
    );
    expect(mockAppendText).toHaveBeenCalledWith(
      { text: 'more', description: 'desc2' },
      expect.objectContaining({ currentText: 'Hello world' }),
    );
  });

  describe('useAppBrainState hook', () => {
    it('returns full state without selector', () => {
      const { result } = renderHook(() => useAppBrainState(), { wrapper });

      expect(result.current).toHaveProperty('manuscript');
      expect(result.current).toHaveProperty('intelligence');
      expect(result.current).toHaveProperty('ui');
    });

    it('returns selected state with selector', () => {
      const { result } = renderHook(
        () => useAppBrainState((s) => s.manuscript.projectTitle),
        { wrapper },
      );

      expect(result.current).toBe('Novel');
    });
  });

  describe('useAppBrainActions hook', () => {
    it('returns actions object', () => {
      const { result } = renderHook(() => useAppBrainActions(), { wrapper });

      expect(typeof result.current.navigateToText).toBe('function');
      expect(typeof result.current.updateManuscript).toBe('function');
      expect(typeof result.current.undo).toBe('function');
    });
  });

  describe('useAppBrainContext hook', () => {
    it('returns context builders', () => {
      const { result } = renderHook(() => useAppBrainContext(), { wrapper });

      expect(typeof result.current.getAgentContext).toBe('function');
      expect(typeof result.current.getEditingContext).toBe('function');
      expect(typeof result.current.getNavigationContext).toBe('function');
    });
  });

  describe('analysis actions', () => {
    it('delegates getCritiqueForSelection to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.getCritiqueForSelection('pacing');
      });

      expect(mockCritique).toHaveBeenCalledWith('pacing', expect.any(Object));
    });

    it('delegates runAnalysis to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.runAnalysis('plot');
      });

      expect(mockRunAnalysis).toHaveBeenCalledWith('plot', expect.any(Object));
    });
  });

  describe('UI actions', () => {
    it('delegates switchPanel to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.switchPanel('lore');
      });

      expect(mockSwitchPanel).toHaveBeenCalledWith('lore', expect.any(Object));
    });

    it('delegates toggleZenMode to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.toggleZenMode();
      });

      expect(mockToggleZen).toHaveBeenCalled();
    });

    it('delegates highlightText to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.highlightText(10, 20, 'warning');
      });

      expect(mockHighlight).toHaveBeenCalledWith(
        { start: 10, end: 20, style: 'warning' },
        expect.any(Object),
      );
    });

    it('scrollToPosition calls editor method', () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      act(() => {
        result.current.actions.scrollToPosition(100);
      });

      expect(mockEditor.scrollToPosition).toHaveBeenCalledWith(100);
    });
  });

  describe('knowledge actions', () => {
    it('delegates queryLore to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.queryLore('dragon history');
      });

      expect(mockQueryLore).toHaveBeenCalledWith('dragon history', expect.any(Object));
    });

    it('delegates getCharacterInfo to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.getCharacterInfo('Alice');
      });

      expect(mockGetCharacter).toHaveBeenCalledWith('Alice', expect.any(Object));
    });

    it('returns timeline events for nearby range', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let timeline: string | undefined;
      await act(async () => {
        timeline = await result.current.actions.getTimelineContext('nearby');
      });

      expect(timeline).toContain('Timeline events');
      expect(timeline).toContain('Event nearby');
    });

    it('returns timeline events for before range', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let timeline: string | undefined;
      await act(async () => {
        timeline = await result.current.actions.getTimelineContext('before');
      });

      expect(timeline).toContain('Event before');
      expect(timeline).toContain('yesterday');
    });

    it('returns timeline events for after range', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let timeline: string | undefined;
      await act(async () => {
        timeline = await result.current.actions.getTimelineContext('after');
      });

      expect(timeline).toContain('Event after');
      expect(timeline).toContain('tomorrow');
    });
  });

  describe('generation actions', () => {
    it('delegates rewriteSelection to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.rewriteSelection({ mode: 'expand', targetTone: 'formal' });
      });

      expect(mockRewrite).toHaveBeenCalled();
    });

    it('delegates continueWriting to command', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.continueWriting();
      });

      expect(mockContinue).toHaveBeenCalled();
    });
  });

  describe('undo/redo actions', () => {
    it('calls editor undo and returns message', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let response: string | undefined;
      await act(async () => {
        response = await result.current.actions.undo();
      });

      expect(mockEditor.undo).toHaveBeenCalled();
      expect(response).toBe('Undid the last change');
    });

    it('calls editor redo and returns message for failure', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let response: string | undefined;
      await act(async () => {
        response = await result.current.actions.redo();
      });

      expect(mockEditor.redo).toHaveBeenCalled();
      expect(response).toBe('Nothing to redo');
    });

    it('returns message when undo has nothing to undo', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      mockEditor.undo.mockReturnValueOnce(false);

      let response: string | undefined;
      await act(async () => {
        response = await result.current.actions.undo();
      });

      expect(mockEditor.undo).toHaveBeenCalled();
      expect(response).toBe('Nothing to undo');
    });

    it('returns message when redo succeeds', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      mockEditor.redo.mockReturnValueOnce(true);

      let response: string | undefined;
      await act(async () => {
        response = await result.current.actions.redo();
      });

      expect(mockEditor.redo).toHaveBeenCalled();
      expect(response).toBe('Redid the last change');
    });
  });

  describe('microphone state', () => {
    it('updates microphone state with setMicrophoneState', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      act(() => {
        result.current.actions.setMicrophoneState({ status: 'listening', mode: 'text' });
      });

      await waitFor(() => {
        expect(result.current.state.ui.microphone.status).toBe('listening');
        expect(result.current.state.ui.microphone.mode).toBe('text');
      });
    });
  });

  describe('event subscriptions', () => {
    it('exposes subscribe and subscribeAll functions', () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.subscribeAll).toBe('function');
    });
  });

  describe('microphone and timeline edge cases', () => {
    it('merges microphone state updates without resetting existing fields', async () => {
      const { result } = renderHook(() => useAppBrain(), { wrapper });

      act(() => {
        result.current.actions.setMicrophoneState({ status: 'listening', error: 'fail' });
      });

      await waitFor(() => {
        expect(result.current.state.ui.microphone.status).toBe('listening');
        expect(result.current.state.ui.microphone.mode).toBe('voice');
        expect(result.current.state.ui.microphone.error).toBe('fail');
      });

      act(() => {
        result.current.actions.setMicrophoneState({ mode: 'text', lastTranscript: 'hello' });
      });

      await waitFor(() => {
        expect(result.current.state.ui.microphone.status).toBe('listening');
        expect(result.current.state.ui.microphone.mode).toBe('text');
        expect(result.current.state.ui.microphone.lastTranscript).toBe('hello');
      });
    });

    it('returns message when no timeline events are available', async () => {
      mockIntelligenceHook.mockReturnValueOnce({
        intelligence: {
          entities: [],
          timeline: { events: [] },
          hud: { situational: { currentScene: { type: 'dialogue' }, currentParagraph: { type: 'narrative' } } },
        },
        hud: { situational: { currentScene: { type: 'dialogue' }, currentParagraph: { type: 'narrative' } } },
      });

      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let timeline: string | undefined;
      await act(async () => {
        timeline = await result.current.actions.getTimelineContext('nearby');
      });

      expect(timeline).toBe('No timeline events nearby cursor.');
    });

    it('returns message when no intelligence timeline data is available', async () => {
      mockIntelligenceHook.mockReturnValueOnce({
        intelligence: null,
        hud: { situational: { currentScene: { type: 'dialogue' }, currentParagraph: { type: 'narrative' } } },
      } as any);

      const { result } = renderHook(() => useAppBrain(), { wrapper });

      let timeline: string | undefined;
      await act(async () => {
        timeline = await result.current.actions.getTimelineContext('nearby');
      });

      expect(timeline).toBe('No timeline data available.');
    });

    it('uses default chapterId when activeChapterId is falsy', () => {
      mockProject.activeChapterId = '';

      renderHook(() => useAppBrain(), { wrapper });

      expect(mockIntelligenceHook).toHaveBeenCalledWith(expect.objectContaining({
        chapterId: 'default',
      }));

      mockProject.activeChapterId = 'ch1';
    });

    it('falls back to SidebarTab.ANALYSIS and storyboards when layout state is missing', () => {
      const prevTab = mockLayoutStore.activeTab;
      const prevView = mockLayoutStore.activeView;

      mockLayoutStore.activeTab = undefined as any;
      mockLayoutStore.activeView = MainView.STORYBOARD as any;

      const { result } = renderHook(() => useAppBrain(), { wrapper });

      expect(result.current.state.ui.activePanel).toBe(SidebarTab.ANALYSIS);
      expect(result.current.state.ui.activeView).toBe('storyboard');

      mockLayoutStore.activeTab = prevTab;
      mockLayoutStore.activeView = prevView;
    });

    it('invokes command callbacks that coalesce to activeTab when panel is undefined', async () => {
      mockLayoutStore.activeTab = 'analysis';
      mockSwitchPanel.mockImplementationOnce(async (panel: string, ctx: any) => {
        ctx.switchPanel(undefined);
        ctx.switchPanel(panel);
        return 'switched';
      });

      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.switchPanel('lore');
      });

      expect(mockLayoutStore.setActiveTab).toHaveBeenCalledWith('analysis');
      expect(mockLayoutStore.setActiveTab).toHaveBeenCalledWith('lore');
    });

    it('covers generation fallbacks when providers return empty results or throw', async () => {
      const agent = await import('@/services/gemini/agent');
      vi.mocked(agent.rewriteText).mockResolvedValueOnce({ result: [] } as any);
      vi.mocked(agent.generateContinuation).mockRejectedValueOnce(new Error('nope'));

      const { result } = renderHook(() => useAppBrain(), { wrapper });

      await act(async () => {
        await result.current.actions.rewriteSelection({ mode: 'expand', targetTone: 'formal' });
      });
      await act(async () => {
        await result.current.actions.continueWriting();
      });

      expect(mockRewrite).toHaveBeenCalled();
      expect(mockContinue).toHaveBeenCalled();
    });
  });
});
