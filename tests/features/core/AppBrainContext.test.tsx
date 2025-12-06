import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppBrainProvider, useAppBrain } from '@/features/core/context/AppBrainContext';
import { type UpdateManuscriptParams } from '@/services/appBrain';

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
  mockAnalysis,
  mockProject,
  mockIntelligenceHook,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockJumpToChapter = vi.fn().mockResolvedValue('jumped');
  const mockJumpToScene = vi.fn().mockResolvedValue('scene');
  const mockUpdateManuscript = vi.fn().mockResolvedValue('updated');
  const mockAppendText = vi.fn().mockResolvedValue('appended');

  const mockAnalysis = {
    analysis: { score: 1 },
    analysisStatus: 'idle' as MockAnalysisStatus,
  } satisfies { analysis: { score: number }; analysisStatus: MockAnalysisStatus };

  const mockProject = {
    activeChapterId: 'ch1',
    currentProject: { id: 'p1', title: 'Novel', lore: { characters: [], worldRules: [] } },
    chapters: [
      { id: 'ch1', title: 'One', content: 'Hello world', order: 0, updatedAt: Date.now() },
      { id: 'ch2', title: 'Two', content: 'Next chapter', order: 1, updatedAt: Date.now() },
    ],
    getActiveChapter: vi.fn(() => ({ id: 'ch1', title: 'One' })),
    selectChapter: vi.fn(),
  };

  const mockIntelligenceHook = vi.fn(() => ({
    intelligence: { entities: [], hud: { situational: {} } },
    hud: { situational: {} },
  }));

  return {
    mockNavigate,
    mockJumpToChapter,
    mockJumpToScene,
    mockUpdateManuscript,
    mockAppendText,
    mockAnalysis,
    mockProject,
    mockIntelligenceHook,
  };
});

vi.mock('@/features/core/context/EditorContext', () => ({
  useEditor: () => ({
    currentText: 'Hello world',
    branches: [],
    activeBranchId: 'main',
    cursorPosition: 5,
    selectionRange: { text: 'Hello', start: 0, end: 5 },
    inlineComments: [],
    isZenMode: false,
    activeHighlight: null,
    commitEdit: vi.fn(),
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
  GetCritiqueCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('critique') })),
  RunAnalysisCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('analysis') })),
}));

vi.mock('@/services/commands/knowledge', () => ({
  QueryLoreCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('lore') })),
  GetCharacterInfoCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('character') })),
}));

vi.mock('@/services/commands/ui', () => ({
  SwitchPanelCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('panel') })),
  ToggleZenModeCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('zen') })),
  HighlightTextCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('highlight') })),
  SetSelectionCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('selection') })),
}));

vi.mock('@/services/commands/generation', () => ({
  RewriteSelectionCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('rewrite') })),
  ContinueWritingCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn().mockResolvedValue('continue') })),
}));

vi.mock('@/services/gemini/agent', () => ({ rewriteText: vi.fn(), generateContinuation: vi.fn() }));

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
});
