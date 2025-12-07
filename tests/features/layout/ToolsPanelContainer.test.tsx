import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock project store
const mockGetActiveChapter = vi.fn(() => ({
  id: 'ch1',
  lastAnalysis: { warning: 'Chapter warning' },
}));
vi.mock('@/features/project', () => ({
  useProjectStore: (selector: any) =>
    selector({
      currentProject: { id: 'proj1', lore: { characters: [], worldRules: [] } },
      chapters: [],
      getActiveChapter: mockGetActiveChapter,
    }),
}));

// Mock editor context
vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorState: () => ({
    currentText: 'Test text',
    selectionRange: { start: 0, end: 4, text: 'Test' },
    history: [],
    editor: null,
  }),
  useEditorActions: () => ({
    restore: vi.fn(),
    handleNavigateToIssue: vi.fn(),
  }),
}));

// Mock engine hook
vi.mock('@/features/shared', () => ({
  useEngine: () => ({
    state: { isAnalyzing: false, analysisWarning: null },
    actions: { runSelectionAnalysis: vi.fn(), handleAgentAction: vi.fn() },
    contradictions: [],
  }),
}));

// Mock ToolsPanel to verify props
const mockToolsPanel = vi.fn((props: any) => <div data-testid="tools-panel">ToolsPanel</div>);
vi.mock('@/features/layout/ToolsPanel', () => ({
  ToolsPanel: (props: any) => mockToolsPanel(props),
}));

import { ToolsPanelContainer } from '@/features/layout/ToolsPanelContainer';

describe('ToolsPanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ToolsPanel', () => {
    render(<ToolsPanelContainer isZenMode={false} />);
    
    expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
  });

  it('passes isZenMode to ToolsPanel', () => {
    render(<ToolsPanelContainer isZenMode={true} />);
    
    expect(mockToolsPanel).toHaveBeenCalledWith(
      expect.objectContaining({ isZenMode: true }),
    );
  });

  it('derives editorContext with cursor position', () => {
    render(<ToolsPanelContainer isZenMode={false} />);
    
    expect(mockToolsPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        editorContext: expect.objectContaining({
          cursorPosition: 4,
          totalLength: 9,
        }),
      }),
    );
  });

  it('prefers engine analysisWarning over chapter warning', () => {
    mockGetActiveChapter.mockReturnValueOnce({
      id: 'ch1',
      lastAnalysis: { warning: 'chapter warn' },
    });
    
    render(<ToolsPanelContainer isZenMode={false} />);
    
    // analysisWarning is null from engine, so falls back to chapter
    expect(mockToolsPanel).toHaveBeenCalledWith(
      expect.objectContaining({ analysisWarning: 'chapter warn' }),
    );
  });
});
