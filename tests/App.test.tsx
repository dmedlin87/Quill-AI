import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';

const mockInit = vi.fn();
const mockFlushPendingWrites = vi.fn();
const mockGetActiveChapter = vi.fn();
const baseStore = {
  init: mockInit,
  isLoading: false,
  flushPendingWrites: mockFlushPendingWrites,
  projects: [],
  currentProject: null,
  chapters: [],
  activeChapterId: null,
  getActiveChapter: mockGetActiveChapter,
};

vi.mock('@/features/project', () => {
  const useProjectStore = vi.fn(() => baseStore);
  return { useProjectStore };
});

vi.mock('@/features/shared', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="editor-provider">{children}</div>,
  EngineProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="engine-provider">{children}</div>,
  UsageProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="usage-provider">{children}</div>,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="error-boundary">{children}</div>,
}));

vi.mock('@/features/analysis', () => ({
  AnalysisProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="analysis-provider">{children}</div>,
  useAnalysis: () => ({
    analysisState: {},
    setAnalysisState: vi.fn(),
  }),
}));

vi.mock('@/features/layout', () => ({
  MainLayout: () => <div data-testid="main-layout">Main</div>,
}));

vi.mock('@/features/core', () => ({
  AppBrainProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-brain-provider">{children}</div>
  ),
}));

import App from '@/App';
import { useProjectStore } from '@/features/project';

const mockUseProjectStore = useProjectStore as unknown as Mock;

describe('App', () => {
  let store: ReturnType<typeof mockUseProjectStore>;

  beforeEach(() => {
    mockInit.mockReset();
    mockFlushPendingWrites.mockReset();
    mockGetActiveChapter.mockReset();

    store = {
      ...baseStore,
      flushPendingWrites: mockFlushPendingWrites.mockResolvedValue({ pendingCount: 0, errors: [] }),
    } as any;

    mockUseProjectStore.mockReturnValue(store);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the project store and renders layout when ready', () => {
    render(<App />);

    expect(store.init).toHaveBeenCalled();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });

  it('shows loading state while store initializes', () => {
    mockUseProjectStore.mockReturnValue({
      ...baseStore,
      isLoading: true,
    } as any);

    render(<App />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('flushes pending writes on visibility change and unload', async () => {
    const flushPendingWrites = vi.fn();
    mockUseProjectStore.mockReturnValue({
      ...baseStore,
      flushPendingWrites,
    } as any);

    render(<App />);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    fireEvent(document, new Event('visibilitychange'));
    fireEvent(window, new Event('beforeunload'));

    await waitFor(() => expect(flushPendingWrites).toHaveBeenCalledTimes(2));

    expect(flushPendingWrites).toHaveBeenCalledWith({ keepAlive: true, reason: 'visibilitychange' });
    expect(flushPendingWrites).toHaveBeenCalledWith({ keepAlive: true, reason: 'beforeunload' });
  });
});
