import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '@/features/analysis/components/Dashboard';
import { useEditorActions } from '@/features/core/context/EditorContext';
import { AnalysisResult } from '@/types';

// Mock AnalysisPanel to verify props passing
vi.mock('@/features/analysis/components/AnalysisPanel', () => ({
  AnalysisPanel: vi.fn(({ onNavigate, onFixRequest, analysis, warning, onAnalyzeSelection, hasSelection }) => (
    <div data-testid="mock-analysis-panel">
      <span>Analysis Loaded: {analysis ? 'Yes' : 'No'}</span>
      {warning && <span>Warning: {warning.message}</span>}
      <button onClick={() => onNavigate(10, 20)}>Navigate</button>
      <button onClick={() => onFixRequest('context', 'suggestion')}>Fix</button>
      {hasSelection && <button onClick={onAnalyzeSelection}>Analyze Selection</button>}
    </div>
  )),
}));

// Mock EditorContext
const mockHandleNavigateToIssue = vi.fn();
vi.mock('@/features/core/context/EditorContext', () => ({
  useEditorActions: vi.fn(() => ({
    handleNavigateToIssue: mockHandleNavigateToIssue,
  })),
}));

describe('Dashboard', () => {
  const defaultProps = {
    isLoading: false,
    analysis: null,
    currentText: 'Sample text',
    onFixRequest: vi.fn(),
    onAnalyzeSelection: vi.fn(),
    hasSelection: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useEditorActions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleNavigateToIssue: mockHandleNavigateToIssue,
    });
  });

  it('renders AnalysisPanel with correct props', () => {
    const mockAnalysis = { some: 'data' } as unknown as AnalysisResult;
    render(<Dashboard {...defaultProps} analysis={mockAnalysis} />);

    expect(screen.getByTestId('mock-analysis-panel')).toBeInTheDocument();
    expect(screen.getByText('Analysis Loaded: Yes')).toBeInTheDocument();
  });

  it('uses provided onNavigateToText prop when available', () => {
    const customNavigate = vi.fn();
    render(<Dashboard {...defaultProps} onNavigateToText={customNavigate} />);

    fireEvent.click(screen.getByText('Navigate'));
    expect(customNavigate).toHaveBeenCalledWith(10, 20);
    expect(mockHandleNavigateToIssue).not.toHaveBeenCalled();
  });

  it('falls back to handleNavigateToIssue from context when onNavigateToText is missing', () => {
    render(<Dashboard {...defaultProps} />);

    fireEvent.click(screen.getByText('Navigate'));
    expect(mockHandleNavigateToIssue).toHaveBeenCalledWith(10, 20);
  });

  it('passes through onFixRequest', () => {
    const onFix = vi.fn();
    render(<Dashboard {...defaultProps} onFixRequest={onFix} />);

    fireEvent.click(screen.getByText('Fix'));
    expect(onFix).toHaveBeenCalledWith('context', 'suggestion');
  });

  it('passes warning prop to AnalysisPanel', () => {
    const warning = { message: 'Test Warning', type: 'info' as const };
    render(<Dashboard {...defaultProps} warning={warning} />);
    expect(screen.getByText('Warning: Test Warning')).toBeInTheDocument();
  });

  it('passes selection props correctly', () => {
    const onAnalyze = vi.fn();
    render(<Dashboard {...defaultProps} hasSelection={true} onAnalyzeSelection={onAnalyze} />);

    const button = screen.getByText('Analyze Selection');
    fireEvent.click(button);
    expect(onAnalyze).toHaveBeenCalled();
  });
});
