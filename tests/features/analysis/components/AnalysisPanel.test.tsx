import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalysisPanel } from '@/features/analysis/components/AnalysisPanel';
import { AnalysisResult } from '@/types';
import { Contradiction } from '@/types/schema';
import * as sharedFeatures from '@/features/shared';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    p: ({ children, className, ...props }: any) => <p className={className} {...props}>{children}</p>,
  },
}));

vi.mock('@/features/shared/components/AccessibleTooltip', () => ({
    AccessibleTooltip: ({ children, content }: any) => <div title={content}>{children}</div>
}));

vi.mock('@/features/shared', () => ({
  findQuoteRange: vi.fn(),
}));

// Mock child components
vi.mock('@/features/analysis/components/ScoreCard', () => ({
    ScoreCard: ({ label, score }: any) => <div>{label}: {score}</div>
}));

vi.mock('@/features/analysis/components/IssueCard', () => ({
    IssueCard: ({ title, suggestion, severity, onClick, onFixClick }: any) => (
        <div data-testid="issue-card" onClick={onClick}>
            <p>{title}</p>
            <p>{suggestion}</p>
            <p>Severity: {severity}</p>
            {onFixClick && <button onClick={onFixClick}>Fix</button>}
        </div>
    )
}));

const mockAnalysisResult: AnalysisResult = {
  pacing: { score: 8, analysis: '', slowSections: [], fastSections: [] },
  plotIssues: [
    { issue: 'Plot Hole', suggestion: 'Fix it', quote: 'bad text', location: 'Chapter 1' }
  ],
  settingAnalysis: {
      issues: [
          { issue: 'Anachronism', suggestion: 'Remove it', quote: 'phone' }
      ],
      analysis: '',
      score: 9
  },
  characters: [],
  summary: 'Executive Summary Text',
  strengths: [],
  weaknesses: [],
  generalSuggestions: []
};

describe('AnalysisPanel', () => {
    const defaultProps = {
        analysis: null,
        isLoading: false,
        currentText: 'This is the current text with bad text and phone.',
        onNavigate: vi.fn(),
        onFixRequest: vi.fn(),
        warning: null,
        onAnalyzeSelection: vi.fn(),
        hasSelection: false,
        contradictions: [],
        derivedLore: null
    };

    it('displays loading state', () => {
        render(<AnalysisPanel {...defaultProps} isLoading={true} />);
        expect(screen.getByText('Consulting the muse...')).toBeInTheDocument();
    });

    it('displays empty state when no analysis', () => {
        render(<AnalysisPanel {...defaultProps} />);
        expect(screen.getByText('Run an analysis to reveal insights.')).toBeInTheDocument();
    });

    it('displays analysis results', () => {
        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} />);

        expect(screen.getByText('Pacing Score: 8')).toBeInTheDocument();
        expect(screen.getByText('Executive Summary')).toBeInTheDocument();
        expect(screen.getByText('Executive Summary Text')).toBeInTheDocument();
        expect(screen.getByText('Detected Issues')).toBeInTheDocument();

        // Check for issues
        expect(screen.getByText('Plot Hole')).toBeInTheDocument();
        expect(screen.getByText('Anachronism')).toBeInTheDocument();
    });

    it('handles no issues state', () => {
        const noIssuesAnalysis = {
            ...mockAnalysisResult,
            plotIssues: [],
            settingAnalysis: undefined
        };
        render(<AnalysisPanel {...defaultProps} analysis={noIssuesAnalysis} />);

        expect(screen.getByText('No issues detected. Great work!')).toBeInTheDocument();
    });

    it('displays warning banner', () => {
        const warning = {
            message: 'Text too long',
            removedChars: 100,
            removedPercent: 10
        };
        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} warning={warning} />);

        expect(screen.getByText('Analysis Warning')).toBeInTheDocument();
        expect(screen.getByText('Text too long')).toBeInTheDocument();
        expect(screen.getByText(/Removed 100 characters/)).toBeInTheDocument();
    });

    it('enables analyze selection button when selection exists', () => {
        const warning = { message: 'Warning' };
        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} warning={warning} hasSelection={true} />);

        const button = screen.getByRole('button', { name: /analyze selection/i });
        expect(button).toBeEnabled();
        fireEvent.click(button);
        expect(defaultProps.onAnalyzeSelection).toHaveBeenCalled();
    });

    it('disables analyze selection button when no selection', () => {
        const warning = { message: 'Warning' };
        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} warning={warning} hasSelection={false} />);

        const button = screen.getByRole('button', { name: /analyze selection/i });
        expect(button).toBeDisabled();
    });

    it('handles issue interactions', () => {
        vi.mocked(sharedFeatures.findQuoteRange).mockReturnValue({ start: 10, end: 20 });

        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} />);

        const issueCards = screen.getAllByTestId('issue-card');

        // Click on issue card (navigate)
        fireEvent.click(issueCards[0]);
        expect(sharedFeatures.findQuoteRange).toHaveBeenCalledWith(expect.any(String), 'bad text');
        expect(defaultProps.onNavigate).toHaveBeenCalledWith(10, 20);

        // Click on fix button
        const fixButtons = screen.getAllByText('Fix');
        fireEvent.click(fixButtons[0]);
        expect(defaultProps.onFixRequest).toHaveBeenCalledWith('"bad text" (Chapter 1)', 'Fix it');
    });

    it('handles quote click failure gracefully', () => {
        vi.mocked(sharedFeatures.findQuoteRange).mockReturnValue(null as any);
        vi.clearAllMocks();

        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} />);
        const issueCards = screen.getAllByTestId('issue-card');
        fireEvent.click(issueCards[0]);

        expect(sharedFeatures.findQuoteRange).toHaveBeenCalled();
        expect(defaultProps.onNavigate).not.toHaveBeenCalled();
    });

    it('handles issue fix without location', () => {
         const analysisWithoutLocation = {
            ...mockAnalysisResult,
            plotIssues: [
                { issue: 'Plot Hole', suggestion: 'Fix it', quote: 'bad text', location: '' }
            ]
        };
        render(<AnalysisPanel {...defaultProps} analysis={analysisWithoutLocation} />);

        const fixButtons = screen.getAllByText('Fix');
        fireEvent.click(fixButtons[0]);
        expect(defaultProps.onFixRequest).toHaveBeenCalledWith('"bad text"', 'Fix it');
    });

    it('handles issue fix without quote', () => {
        const analysisWithoutQuote = {
           ...mockAnalysisResult,
           plotIssues: [
               { issue: 'Plot Hole', suggestion: 'Fix it', location: 'Chapter 1' }
           ]
       };
       render(<AnalysisPanel {...defaultProps} analysis={analysisWithoutQuote} />);

       const fixButtons = screen.getAllByText('Fix');
       // This triggers handleQuoteClick with undefined quote, which should return early
       fireEvent.click(fixButtons[0].parentElement!);
       expect(defaultProps.onNavigate).not.toHaveBeenCalled();

       fireEvent.click(fixButtons[0]);
       expect(defaultProps.onFixRequest).toHaveBeenCalledWith('Chapter 1', 'Fix it');
   });

   it('handles issue fix with unknown location fallback', () => {
        const analysisMinimal = {
           ...mockAnalysisResult,
           plotIssues: [
               { issue: 'Plot Hole', suggestion: 'Fix it', location: '' }
           ]
       };
       render(<AnalysisPanel {...defaultProps} analysis={analysisMinimal} />);

       const fixButtons = screen.getAllByText('Fix');
       fireEvent.click(fixButtons[0]);
       expect(defaultProps.onFixRequest).toHaveBeenCalledWith('Unknown location', 'Fix it');
   });

   it('displays contradictions and handles navigation', () => {
        const contradictions: Contradiction[] = [
            { type: 'character_attribute' as const, characterName: 'Bob', attribute: 'Eye Color', originalValue: 'Blue', newValue: 'Green', position: 100, originalChapterId: 'ch1', newChapterId: 'ch2' }
        ];
       render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} contradictions={contradictions} />);

       expect(screen.getByText('Contradictions')).toBeInTheDocument();
       expect(screen.getByText('Character Attribute')).toBeInTheDocument();
       expect(screen.getByText('Bob • Eye Color')).toBeInTheDocument();
       expect(screen.getByText('Blue → Green')).toBeInTheDocument();

       const jumpButton = screen.getByText('Jump to text');
       fireEvent.click(jumpButton);
       expect(defaultProps.onNavigate).toHaveBeenCalledWith(100, 150);
   });

   it('displays contradictions without character name or attribute', () => {
        const contradictions: Contradiction[] = [
            { type: 'timeline' as const, originalValue: 'A', newValue: 'B', position: 200, originalChapterId: 'ch1', newChapterId: 'ch2' }
        ];
        render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} contradictions={contradictions} />);

        expect(screen.getByText('Timeline')).toBeInTheDocument();
        expect(screen.getByText('detail')).toBeInTheDocument();
    });

   it('displays derived lore', () => {
       const derivedLore = {
           worldRules: ['Magic is real'],
            characters: [{ 
                name: 'Alice', 
                bio: 'A mage', 
                traits: [], 
                arc: 'Hero Journey', 
                arcStages: [], 
                relationships: [], 
                plotThreads: [], 
                inconsistencies: [], 
                developmentSuggestion: '' 
            }]
       };
       render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} derivedLore={derivedLore} />);

       expect(screen.getByText('Derived Lore')).toBeInTheDocument();
       expect(screen.getByText('World Rules')).toBeInTheDocument();
       expect(screen.getByText('Magic is real')).toBeInTheDocument();
       expect(screen.getByText('Characters')).toBeInTheDocument();
       expect(screen.getByText('Alice')).toBeInTheDocument();
       expect(screen.getByText('A mage')).toBeInTheDocument();
   });

   it('displays message when no contradictions or lore', () => {
       render(<AnalysisPanel {...defaultProps} analysis={mockAnalysisResult} contradictions={[]} derivedLore={null} />);

       expect(screen.getByText('Intelligence HUD')).toBeInTheDocument();
       expect(screen.getByText('Run the intelligence pass to surface contradictions and derived lore.')).toBeInTheDocument();
   });
});
