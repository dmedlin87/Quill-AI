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
const setDocumentVisibilityState = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
};

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
    setDocumentVisibilityState('visible');
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

    setDocumentVisibilityState('hidden');

    fireEvent(document, new Event('visibilitychange'));
    fireEvent(window, new Event('beforeunload'));

    await waitFor(() => expect(flushPendingWrites).toHaveBeenCalledTimes(2));

    expect(flushPendingWrites).toHaveBeenCalledWith({ keepAlive: true, reason: 'visibilitychange' });
    expect(flushPendingWrites).toHaveBeenCalledWith({ keepAlive: true, reason: 'beforeunload' });
  });

  it('logs info when pending writes flush successfully', async () => {
    const flushPendingWrites = vi.fn().mockResolvedValue({ pendingCount: 2, errors: [] });
    mockUseProjectStore.mockReturnValue({
      ...baseStore,
      flushPendingWrites,
    } as any);

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    render(<App />);

    setDocumentVisibilityState('hidden');
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(flushPendingWrites).toHaveBeenCalled());

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[App] Flushed 2 pending writes during visibilitychange'),
    );

    infoSpy.mockRestore();
  });

  it('logs errors when pending writes flush returns failures', async () => {
    const error = new Error('oops');
    const flushPendingWrites = vi.fn().mockResolvedValue({ pendingCount: 1, errors: [error] });
    mockUseProjectStore.mockReturnValue({
      ...baseStore,
      flushPendingWrites,
    } as any);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);

    setDocumentVisibilityState('hidden');
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(flushPendingWrites).toHaveBeenCalled());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[App] Failed to flush 1 pending writes during visibilitychange'),
      [error],
    );

    errorSpy.mockRestore();
  });

  it('logs unexpected errors when flushing pending writes throws', async () => {
    const error = new Error('boom');
    const flushPendingWrites = vi.fn().mockRejectedValue(error);
    mockUseProjectStore.mockReturnValue({
      ...baseStore,
      flushPendingWrites,
    } as any);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);

    fireEvent(window, new Event('beforeunload'));

    await waitFor(() => expect(flushPendingWrites).toHaveBeenCalled());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[App] Unexpected error while flushing pending writes during beforeunload'),
      error,
    );

    errorSpy.mockRestore();
  });
});
