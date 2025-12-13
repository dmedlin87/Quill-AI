import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShadowReaderPanel } from '@/features/analysis/components/ShadowReaderPanel';
import { useReaderStore } from '@/features/analysis/readerStore';
import * as EditorContext from '@/features/core/context/EditorContext';
import * as Shared from '@/features/shared';

// Mock dependencies
vi.mock('@/features/analysis/readerStore');
vi.mock('@/features/core/context/EditorContext');
vi.mock('@/features/shared');
vi.mock('@/features/shared/components/AccessibleTooltip', () => ({
  AccessibleTooltip: ({ children }: any) => <div>{children}</div>,
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid'
  }
});

describe('ShadowReaderPanel', () => {
  const mockGenerateReactions = vi.fn();
  const mockSetActivePersona = vi.fn();
  const mockSetInlineComments = vi.fn();
  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const defaultPersona = { id: 'skeptic', name: 'The Skeptic', role: 'Critic', description: 'Desc', icon: '🤔', systemPrompt: '', focus: [] };
  const otherPersona = { id: 'cheerleader', name: 'The Cheerleader', role: 'Fan', description: 'Desc', icon: '🎉', systemPrompt: '', focus: [] };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Store
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      setActivePersona: mockSetActivePersona,
      isReading: false,
      generateReactions: mockGenerateReactions,
      reactions: [],
    });

    // Mock Editor Context
    (EditorContext.useEditorState as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentText: 'Sample text content',
      inlineComments: [],
    });
    (EditorContext.useEditorActions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      setInlineComments: mockSetInlineComments,
    });

    // Mock Shared Utils
    (Shared.findQuoteRange as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ start: 0, end: 10 });
  });

  it('renders persona selector and read button', () => {
    render(<ShadowReaderPanel />);
    expect(screen.getByText('Shadow Reader')).toBeInTheDocument();
    expect(screen.getByText('The Skeptic')).toBeInTheDocument();
    expect(screen.getByText('Read Chapter')).toBeInTheDocument();
  });

  it('handles persona selection', () => {
    render(<ShadowReaderPanel />);
    // Use regex to match the potentially duplicated accessible name "The Cheerleader The Cheerleader"
    // or simply find the text and click the closest button
    const cheerleaderText = screen.getByText('The Cheerleader');
    const button = cheerleaderText.closest('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button!);
    expect(mockSetActivePersona).toHaveBeenCalledWith('cheerleader');
  });

  it('highlights active persona correctly', () => {
     (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: otherPersona, // Set Cheerleader as active
      setActivePersona: mockSetActivePersona,
      isReading: false,
      generateReactions: mockGenerateReactions,
      reactions: [],
    });

    render(<ShadowReaderPanel />);
    // Just ensure no errors in rendering with different active persona
    expect(screen.getByText('The Cheerleader')).toBeInTheDocument();
  });

  it('calls generateReactions when Read Chapter is clicked', () => {
    render(<ShadowReaderPanel />);
    fireEvent.click(screen.getByText('Read Chapter'));
    expect(mockGenerateReactions).toHaveBeenCalledWith('Sample text content');
  });

  it('disables Read button when reading or no text', () => {
    // Case 1: Is Reading
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      isReading: true,
      generateReactions: mockGenerateReactions,
      reactions: [],
    });
    const { rerender } = render(<ShadowReaderPanel />);
    expect(screen.getByText('Reading...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reading.../i })).toBeDisabled();

    // Case 2: No Text
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      isReading: false,
      generateReactions: mockGenerateReactions,
      reactions: [],
    });
    (EditorContext.useEditorState as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentText: '', // Empty text
      inlineComments: [],
    });
    rerender(<ShadowReaderPanel />);
    expect(screen.getByRole('button', { name: /Read Chapter/i })).toBeDisabled();
  });

  it('displays reactions when present', () => {
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '1', issue: 'Confusing plot', severity: 'error', quote: 'Sample' },
        { id: '2', issue: 'Good point', severity: 'info', quote: 'text' },
        { id: '3', issue: 'Maybe change this', severity: 'warning', quote: 'content' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    expect(screen.getByText('Confusing plot')).toBeInTheDocument();
    expect(screen.getByText('"Sample"')).toBeInTheDocument();
    expect(screen.getByText('Good point')).toBeInTheDocument();
    expect(screen.getByText('Maybe change this')).toBeInTheDocument();
  });

  it('adds comment when "Add as Comment" is clicked', () => {
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '1', issue: 'Confusing plot', severity: 'error', quote: 'Sample' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    fireEvent.click(screen.getByText('➕ Add as Comment'));

    expect(mockSetInlineComments).toHaveBeenCalled();
    const callArgs = mockSetInlineComments.mock.calls[0][0];
    expect(callArgs).toHaveLength(1);
    expect(callArgs[0].issue).toContain('The Skeptic says: Confusing plot');
    expect(callArgs[0].severity).toBe('error');
  });

  it('does not add comment if reaction has issue is empty', () => {
      (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '1', issue: '', severity: 'error', quote: 'Sample' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    // Button exists because quote exists
    const button = screen.getByText('➕ Add as Comment');
    fireEvent.click(button);
    expect(mockSetInlineComments).not.toHaveBeenCalled();
  });

  it('does not render add button if quote is missing', () => {
      (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '2', issue: 'Issue', severity: 'error', quote: '' }   // Empty quote
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    expect(screen.queryByText('➕ Add as Comment')).not.toBeInTheDocument();
  });

  it('handles "Add as Comment" when quote range is not found', () => {
    (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '1', issue: 'Confusing plot', severity: 'error', quote: 'Nonexistent quote' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    // Mock findQuoteRange to return null
    (Shared.findQuoteRange as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

    render(<ShadowReaderPanel />);
    fireEvent.click(screen.getByText('➕ Add as Comment'));

    expect(mockConsoleWarn).toHaveBeenCalledWith('Could not find quote range for reaction:', 'Nonexistent quote');
    expect(mockSetInlineComments).not.toHaveBeenCalled();
  });

  it('correctly maps severity levels', () => {
      (useReaderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activePersona: defaultPersona,
      reactions: [
        { id: '1', issue: 'Info issue', severity: 'info', quote: 'Sample' },
        { id: '2', issue: 'Warning issue', severity: 'warning', quote: 'Sample' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    const buttons = screen.getAllByText('➕ Add as Comment');

    // Click first (info)
    fireEvent.click(buttons[0]);
    expect(mockSetInlineComments).toHaveBeenCalled();
    let newComment = mockSetInlineComments.mock.calls[0][0][0];
    expect(newComment.severity).toBe('info');

    mockSetInlineComments.mockClear();

    // Click second (warning)
    fireEvent.click(buttons[1]);
    newComment = mockSetInlineComments.mock.calls[0][0][0];
    expect(newComment.severity).toBe('warning');
  });
});
