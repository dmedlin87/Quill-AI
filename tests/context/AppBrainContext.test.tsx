import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AppBrainProvider, useAppBrain } from '@/features/core/context/AppBrainContext';

// Mocks for underlying hooks and services used by AppBrainProvider

// Editor mock state backing variables so we can simulate changes across rerenders
let mockSelection: { start: number; end: number; text: string } | null = null;
let mockCursor = 0;

const mockEditor: any = {};
Object.defineProperty(mockEditor, 'selectionRange', {
  get() {
    return mockSelection;
  },
});
Object.defineProperty(mockEditor, 'cursorPosition', {
  get() {
    return mockCursor;
  },
});

mockEditor.currentText = 'Hello world';
mockEditor.branches = [];
mockEditor.activeBranchId = null;
mockEditor.isZenMode = false;
mockEditor.inlineComments = [];
mockEditor.activeHighlight = null;
mockEditor.handleNavigateToIssue = vi.fn();
mockEditor.scrollToPosition = vi.fn();

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditor: () => mockEditor,
}));

const mockAnalysisCtx = {
  analysis: null,
  analysisStatus: {
    pacing: 'idle',
    characters: 'idle',
    plot: 'idle',
    setting: 'idle',
  },
  analyzePacing: vi.fn(),
  analyzeCharacters: vi.fn(),
  analyzePlot: vi.fn(),
  analyzeSetting: vi.fn(),
  runFullAnalysis: vi.fn(),
};

vi.mock('@/features/analysis', () => ({
  useAnalysis: () => mockAnalysisCtx,
}));

const mockProjectStore: any = {
  currentProject: {
    id: 'p1',
    title: 'Test Project',
    setting: 'Test Setting',
    lore: {
      characters: [],
      worldRules: [],
    },
    manuscriptIndex: null,
  },
  chapters: [
    { id: 'ch1', title: 'Chapter 1', content: 'Hello world', order: 0, updatedAt: Date.now() },
  ],
  activeChapterId: 'ch1',
  getActiveChapter: vi.fn(() => mockProjectStore.chapters[0]),
  selectChapter: vi.fn(),
};

vi.mock('@/features/project', () => ({
  useProjectStore: () => mockProjectStore,
}));

const mockHud = {
  situational: {
    currentScene: { type: 'scene-type' },
    currentParagraph: { type: 'paragraph-type' },
  },
};

const mockIntelligence = {
  entities: null,
  timeline: null,
  style: null,
  heatmap: null,
  hud: { lastFullProcess: 123 },
};

vi.mock('@/features/shared/hooks/useManuscriptIntelligence', () => ({
  useManuscriptIntelligence: () => ({ intelligence: mockIntelligence, hud: mockHud }),
}));

// appBrain service mocks
const subscribe = vi.fn();
const subscribeAll = vi.fn();
export const emitSelectionChanged = vi.fn();
export const emitCursorMoved = vi.fn();
export const emitChapterSwitched = vi.fn();

const contextBuilderFactory = (getState: () => any) => ({
  getAgentContext: () => `TITLE:${getState().manuscript.projectTitle}`,
  getCompressedContext: () => 'COMPRESSED',
});

vi.mock('@/services/appBrain', () => ({
  eventBus: { subscribe, subscribeAll },
  emitSelectionChanged,
  emitCursorMoved,
  emitChapterSwitched,
  createContextBuilder: (getState: () => any) => contextBuilderFactory(getState),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppBrainProvider>{children}</AppBrainProvider>
);

describe('AppBrainContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection = null;
    mockCursor = 0;
    mockProjectStore.activeChapterId = 'ch1';
  });

  it('throws when useAppBrain is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAppBrain());
    }).toThrow('useAppBrain must be used within AppBrainProvider');

    consoleSpy.mockRestore();
  });

  it('provides unified state and context builders inside provider', () => {
    const { result } = renderHook(() => useAppBrain(), { wrapper });

    const value = result.current;
    expect(value.state.manuscript.projectId).toBe('p1');
    expect(value.state.manuscript.projectTitle).toBe('Test Project');
    expect(value.state.manuscript.currentText).toBe('Hello world');

    expect(value.state.ui.cursor.position).toBe(0);
    expect(value.state.ui.cursor.scene).toBe('scene-type');
    expect(value.state.ui.cursor.paragraph).toBe('paragraph-type');

    // Context builders should be created via createContextBuilder and see latest state
    expect(value.context.getCompressedContext()).toBe('COMPRESSED');
    expect(value.context.getAgentContext()).toBe('TITLE:Test Project');

    // Event subscriptions are exposed from eventBus
    expect(typeof value.subscribe).toBe('function');
    expect(typeof value.subscribeAll).toBe('function');
  });

  it('emits selection and cursor events when editor state changes', () => {
    const { rerender } = renderHook(() => useAppBrain(), { wrapper });

    // Change selection and cursor backing values and rerender
    act(() => {
      mockSelection = { start: 1, end: 4, text: 'ell' };
      mockCursor = 3;
    });

    rerender();

    expect(emitSelectionChanged).toHaveBeenCalledWith('ell', 1, 4);
    expect(emitCursorMoved).toHaveBeenCalledWith(3, 'scene-type');
  });

  it('emits chapter switched event when active chapter changes', () => {
    const { rerender } = renderHook(() => useAppBrain(), { wrapper });

    act(() => {
      mockProjectStore.activeChapterId = 'ch2';
      mockProjectStore.chapters.push({
        id: 'ch2',
        title: 'Chapter 2',
        content: 'More text',
        order: 1,
        updatedAt: Date.now(),
      });
    });

    rerender();

    expect(emitChapterSwitched).toHaveBeenCalledWith('ch2', 'Chapter 2');
  });
});
