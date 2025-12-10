import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { ProjectSidebar } from '@/features/project/components/ProjectSidebar';
import { useProjectStore } from '@/features/project/store/useProjectStore';

vi.mock('@/features/project/store/useProjectStore');

const mockUseProjectStore = useProjectStore as unknown as Mock;

describe('ProjectSidebar', () => {
  const mockSelectChapter = vi.fn();
  const mockCreateChapter = vi.fn();
  const mockReorderChapters = vi.fn();
  const mockToggleCollapsed = vi.fn();

  const baseStore = {
    chapters: [
      { id: 'ch-1', title: 'Chapter 1', content: 'Content 1', lastAnalysis: null },
      { id: 'ch-2', title: 'Chapter 2', content: 'Content 2', lastAnalysis: { pacing: { score: 8 } } },
      { id: 'ch-3', title: 'Chapter 3', content: 'Content 3', lastAnalysis: { pacing: { score: 5 } } },
    ],
    activeChapterId: 'ch-1',
    selectChapter: mockSelectChapter,
    createChapter: mockCreateChapter,
    reorderChapters: mockReorderChapters,
    currentProject: { title: 'My Novel' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjectStore.mockReturnValue(baseStore);
  });

  it('renders project title and chapters', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    expect(screen.getByText('My Novel')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    expect(screen.getByText('Chapter 3')).toBeInTheDocument();
  });

  it('shows "Untitled" when project title is missing', () => {
    mockUseProjectStore.mockReturnValue({ ...baseStore, currentProject: null });
    
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('selects chapter when clicked', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    fireEvent.click(screen.getByText('Chapter 2'));
    
    expect(mockSelectChapter).toHaveBeenCalledWith('ch-2');
  });

  it('creates new chapter when button is clicked', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    fireEvent.click(screen.getByText('New Chapter'));
    
    expect(mockCreateChapter).toHaveBeenCalled();
  });

  it('displays chapter numbers', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('highlights active chapter', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    // Chapter items are now divs with cursor-pointer class
    const chapter1Item = screen.getByText('Chapter 1').closest('[draggable="true"]');
    const chapter2Item = screen.getByText('Chapter 2').closest('[draggable="true"]');
    
    expect(chapter1Item).toHaveClass('bg-[var(--parchment-50)]');
    expect(chapter2Item).not.toHaveClass('bg-[var(--parchment-50)]');
  });

  it('supports drag and drop reordering', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    const chapter1 = screen.getByText('Chapter 1').closest('[draggable="true"]')!;
    const chapter3 = screen.getByText('Chapter 3').closest('[draggable="true"]')!;
    
    // Start drag
    fireEvent.dragStart(chapter1, {
      dataTransfer: { effectAllowed: 'move' },
    });
    
    // Drag over target
    fireEvent.dragOver(chapter3, { preventDefault: vi.fn() });
    
    // Drop
    fireEvent.drop(chapter3, { preventDefault: vi.fn() });
    
    expect(mockReorderChapters).toHaveBeenCalled();
  });

  it('does not reorder when dropping on same position', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    const chapter1 = screen.getByText('Chapter 1').closest('[draggable="true"]')!;
    
    fireEvent.dragStart(chapter1, {
      dataTransfer: { effectAllowed: 'move' },
    });
    fireEvent.dragOver(chapter1, { preventDefault: vi.fn() });
    fireEvent.drop(chapter1, { preventDefault: vi.fn() });
    
    expect(mockReorderChapters).not.toHaveBeenCalled();
  });

  it('shows analysis indicators for chapters', () => {
    render(<ProjectSidebar collapsed={false} toggleCollapsed={mockToggleCollapsed} />);
    
    // Chapter 2 has high score (8) - should show success indicator
    // Chapter 3 has low score (5) - should show warning indicator
    const indicators = document.querySelectorAll('[class*="rounded-full"]');
    
    // At least 2 indicators should be present (for ch-2 and ch-3)
    expect(indicators.length).toBeGreaterThanOrEqual(2);
  });
});
