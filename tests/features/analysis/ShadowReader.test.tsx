import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('ShadowReaderPanel', () => {
  const mockGenerateReactions = vi.fn();
  const mockSetActivePersona = vi.fn();
  const mockSetInlineComments = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Store
    (useReaderStore as any).mockReturnValue({
      activePersona: { id: 'skeptic', name: 'The Skeptic', role: 'Critic', description: 'Desc', icon: '🤔', systemPrompt: '', focus: [] },
      setActivePersona: mockSetActivePersona,
      isReading: false,
      generateReactions: mockGenerateReactions,
      reactions: [],
    });

    // Mock Editor Context
    (EditorContext.useEditorState as any).mockReturnValue({
      currentText: 'Sample text content',
      inlineComments: [],
    });
    (EditorContext.useEditorActions as any).mockReturnValue({
      setInlineComments: mockSetInlineComments,
    });

    // Mock Shared Utils
    (Shared.findQuoteRange as any).mockReturnValue({ start: 0, end: 10 });
  });

  it('renders persona selector and read button', () => {
    render(<ShadowReaderPanel />);
    expect(screen.getByText('Shadow Reader')).toBeInTheDocument();
    expect(screen.getByText('The Skeptic')).toBeInTheDocument();
    expect(screen.getByText('Read Chapter')).toBeInTheDocument();
  });

  it('calls generateReactions when Read Chapter is clicked', () => {
    render(<ShadowReaderPanel />);
    fireEvent.click(screen.getByText('Read Chapter'));
    expect(mockGenerateReactions).toHaveBeenCalledWith('Sample text content');
  });

  it('displays reactions when present', () => {
    (useReaderStore as any).mockReturnValue({
      activePersona: { id: 'skeptic', name: 'The Skeptic' },
      reactions: [
        { id: '1', issue: 'Confusing plot', severity: 'error', quote: 'Sample' }
      ],
      isReading: false,
      generateReactions: mockGenerateReactions,
    });

    render(<ShadowReaderPanel />);
    expect(screen.getByText('Confusing plot')).toBeInTheDocument();
    expect(screen.getByText('"Sample"')).toBeInTheDocument();
  });

  it('adds comment when "Add as Comment" is clicked', () => {
    (useReaderStore as any).mockReturnValue({
      activePersona: { id: 'skeptic', name: 'The Skeptic' },
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
  });
});
