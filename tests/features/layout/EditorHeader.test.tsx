import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    header: ({ children, onMouseEnter, onMouseLeave, initial, animate, transition, ...props }: any) => (
      <header onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...props}>
        {children}
      </header>
    ),
  },
  useReducedMotion: () => false,
}));

// Mock layout store
const mockSetHeaderHovered = vi.fn();
const mockUseLayoutStore = vi.fn();
vi.mock('@/features/layout/store/useLayoutStore', () => ({
  useLayoutStore: (selector: any) => selector(mockUseLayoutStore()),
}));

// Mock project store
const mockUseProjectStore = vi.fn();
vi.mock('@/features/project/store/useProjectStore', () => ({
  useProjectStore: (selector: any) => selector(mockUseProjectStore()),
}));

vi.mock('@/services/pdfExport', () => ({
  pdfExportService: {
    generatePdf: vi.fn(async () => undefined),
  },
}));

vi.mock('@/services/io/docxExporter', () => ({
  exportStandardManuscriptDocx: vi.fn(async () => undefined),
}));

vi.mock('@/services/io/manuscriptExport', () => ({
  createManuscriptExportData: vi.fn(() => ({
    title: 'Test Book',
    author: 'Author Name',
    content: 'content',
    lore: { characters: [], worldRules: [] },
    analysis: null,
  })),
  toManuscriptExportChapters: vi.fn(() => [{ title: 'Chapter 1', content: 'content' }]),
}));

// Mock child components
vi.mock('@/features/shared', () => ({
  UsageBadge: () => <div data-testid="usage-badge">UsageBadge</div>,
}));
vi.mock('@/features/voice', () => ({
  VoiceCommandButton: () => <button data-testid="voice-btn">Voice</button>,
}));

import { EditorHeader } from '@/features/layout/EditorHeader';

describe('EditorHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutStore.mockReturnValue({
      isHeaderHovered: false,
      setHeaderHovered: mockSetHeaderHovered,
    });

    mockUseProjectStore.mockReturnValue({
      currentProject: { title: 'Test Book', author: 'Author Name' },
      chapters: [{ id: 'c1', projectId: 'p1', title: 'Chapter 1', content: 'content', order: 0, updatedAt: Date.now() }],
    });
  });

  it('renders UsageBadge and VoiceCommandButton', () => {
    render(<EditorHeader isZenMode={false} />);
    
    expect(screen.getByTestId('usage-badge')).toBeInTheDocument();
    expect(screen.getByTestId('voice-btn')).toBeInTheDocument();
  });

  it('renders Export Manuscript button when a project is available', () => {
    render(<EditorHeader isZenMode={false} />);

    expect(screen.getByRole('button', { name: 'Export Manuscript' })).toBeInTheDocument();
  });

  it('has banner role', () => {
    render(<EditorHeader isZenMode={false} />);
    
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('calls setHeaderHovered on mouse enter in zen mode', () => {
    render(<EditorHeader isZenMode={true} />);
    
    fireEvent.mouseEnter(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).toHaveBeenCalledWith(true);
  });

  it('does not call setHeaderHovered on mouse enter outside zen mode', () => {
    render(<EditorHeader isZenMode={false} />);
    
    fireEvent.mouseEnter(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).not.toHaveBeenCalled();
  });

  it('calls setHeaderHovered(false) on mouse leave', () => {
    render(<EditorHeader isZenMode={true} />);
    
    fireEvent.mouseLeave(screen.getByRole('banner'));
    
    expect(mockSetHeaderHovered).toHaveBeenCalledWith(false);
  });
});
