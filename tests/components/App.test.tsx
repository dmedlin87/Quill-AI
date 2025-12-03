import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, type Mock } from 'vitest';

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

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

import App from '@/App';
import { useProjectStore } from '@/features/project';

const mockUseProjectStore = useProjectStore as unknown as Mock;

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders full provider tree and MainLayout when store is initialized', () => {
    const initMock = vi.fn();

    mockUseProjectStore.mockReturnValue({
      init: initMock,
      isLoading: false,
    });

    render(<App />);

    expect(screen.getByTestId('usage-provider')).toBeInTheDocument();
    expect(screen.getByTestId('editor-provider')).toBeInTheDocument();
    expect(screen.getByTestId('engine-provider')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-provider')).toBeInTheDocument();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner while project store is loading', () => {
    mockUseProjectStore.mockReturnValue({
      init: vi.fn(),
      isLoading: true,
    });

    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('main-layout')).not.toBeInTheDocument();
  });

  it('renders MainLayout when isLoading is false (initialized state)', () => {
    mockUseProjectStore.mockReturnValue({
      init: vi.fn(),
      isLoading: false,
    });

    render(<App />);

    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});
