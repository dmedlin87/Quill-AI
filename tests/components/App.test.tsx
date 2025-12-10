import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist store mock so vi.mock factories can reference it safely
const { mockUseProjectStore, mockInit, mockFlushPendingWrites, mockGetActiveChapter } = vi.hoisted(() => ({
  mockUseProjectStore: vi.fn(),
  mockInit: vi.fn(),
  mockFlushPendingWrites: vi.fn(),
  mockGetActiveChapter: vi.fn(),
}));

// Mock feature providers and layout before importing App
vi.mock('@/features/shared', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="editor-provider">{children}</div>
  ),
  EngineProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="engine-provider">{children}</div>
  ),
  UsageProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="usage-provider">{children}</div>
  ),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/analysis', () => ({
  AnalysisProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="analysis-provider">{children}</div>
  ),
  useAnalysis: vi.fn(() => ({
    analysis: null,
    analysisStatus: {
      pacing: 'idle',
      characters: 'idle',
      plot: 'idle',
      setting: 'idle',
      summary: 'idle',
    },
    analyzePacing: vi.fn(),
    analyzeCharacters: vi.fn(),
    analyzePlot: vi.fn(),
    analyzeSetting: vi.fn(),
    runFullAnalysis: vi.fn(),
  })),
}));

vi.mock('@/features/layout', () => ({
  MainLayout: () => <div data-testid="main-layout">Main Layout</div>,
}));

vi.mock('@/features/core', () => ({
  AppBrainProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-brain-provider">{children}</div>
  ),
}));

vi.mock('@/features/project', () => ({
  useProjectStore: mockUseProjectStore,
}));
vi.mock('@/features/project/store/useProjectStore', () => ({
  useProjectStore: mockUseProjectStore,
}));

import App from '@/App';

describe('App', () => {
  let store: any;

  beforeEach(() => {
    mockInit.mockClear();
    mockFlushPendingWrites.mockReset();
    mockGetActiveChapter.mockReset();

    mockFlushPendingWrites.mockResolvedValue({ pendingCount: 0, errors: [] });
    mockGetActiveChapter.mockReturnValue(undefined);

    store = {
      init: mockInit,
      isLoading: false,
      flushPendingWrites: mockFlushPendingWrites,
      projects: [],
      currentProject: null,
      chapters: [],
      activeChapterId: null,
      selectChapter: vi.fn(),
      setActiveChapter: vi.fn(),
      getActiveChapter: mockGetActiveChapter,
    };

    mockUseProjectStore.mockReturnValue(store);
  });

  it('renders full provider tree and MainLayout when store is initialized', () => {
    render(<App />);

    expect(screen.getByTestId('usage-provider')).toBeInTheDocument();
    expect(screen.getByTestId('editor-provider')).toBeInTheDocument();
    expect(screen.getByTestId('engine-provider')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-provider')).toBeInTheDocument();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(store.init).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner while project store is loading', () => {
    mockUseProjectStore.mockReturnValue({
      ...store,
      init: vi.fn(),
      isLoading: true,
      flushPendingWrites: vi.fn(),
    });

    render(<App />);

    expect(screen.getByText('Loading your library...')).toBeInTheDocument();
    expect(screen.queryByTestId('main-layout')).not.toBeInTheDocument();
  });

  it('renders MainLayout when isLoading is false (initialized state)', () => {
    mockUseProjectStore.mockReturnValue({
      ...store,
      init: vi.fn(),
      isLoading: false,
      flushPendingWrites: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});
