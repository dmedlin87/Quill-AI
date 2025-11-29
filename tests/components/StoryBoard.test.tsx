import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { StoryBoard } from '@/features/project/components/StoryBoard';
import { useProjectStore } from '@/features/project/store/useProjectStore';
import { Chapter } from '@/types/schema';

vi.mock('@/features/project/store/useProjectStore');
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
        <div {...props}>{children}</div>
      ),
      button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
        <button {...props}>{children}</button>
      ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    LayoutGroup: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

const mockUseProjectStore = useProjectStore as unknown as Mock;

const createMockChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: `ch-${Math.random().toString(36).slice(2)}`,
  projectId: 'proj-1',
  title: 'Test Chapter',
  content: 'This is some test content for the chapter.',
  order: 0,
  updatedAt: Date.now(),
  ...overrides,
});

describe('StoryBoard', () => {
  const mockOnSwitchToEditor = vi.fn();

  const baseStore = () => ({
    chapters: [] as Chapter[],
    activeChapterId: null as string | null,
    selectChapter: vi.fn(),
    createChapter: vi.fn(() => Promise.resolve('new-chapter-id')),
    reorderChapters: vi.fn(() => Promise.resolve()),
    currentProject: {
      id: 'proj-1',
      title: 'Test Novel',
      author: 'Test Author',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering chapters', () => {
    it('renders chapter cards with correct titles', () => {
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'The Beginning', order: 0 }),
        createMockChapter({ id: 'ch-2', title: 'The Middle', order: 1 }),
        createMockChapter({ id: 'ch-3', title: 'The End', order: 2 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
        activeChapterId: 'ch-1',
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('The Beginning')).toBeInTheDocument();
      expect(screen.getByText('The Middle')).toBeInTheDocument();
      expect(screen.getByText('The End')).toBeInTheDocument();
    });

    it('displays correct word count for each chapter', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          title: 'Short Chapter',
          content: 'One two three four five', // 5 words
          order: 0,
        }),
        createMockChapter({
          id: 'ch-2',
          title: 'Longer Chapter',
          content: 'Word '.repeat(100).trim(), // 100 words
          order: 1,
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('5 w')).toBeInTheDocument();
      expect(screen.getByText('100 w')).toBeInTheDocument();
    });

    it('displays pacing score when analysis is present', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          title: 'Analyzed Chapter',
          order: 0,
          lastAnalysis: {
            summary: 'Great chapter',
            strengths: [],
            weaknesses: [],
            pacing: {
              score: 7,
              analysis: 'Good pacing',
              slowSections: [],
              fastSections: [],
            },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('(7/10)')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('shows "Not analyzed" for chapters without pacing data', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          title: 'Unanalyzed Chapter',
          order: 0,
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('Not analyzed')).toBeInTheDocument();
    });

    it('displays correct pacing labels based on score', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-slow',
          title: 'Slow Chapter',
          order: 0,
          lastAnalysis: {
            summary: '',
            strengths: [],
            weaknesses: [],
            pacing: { score: 2, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
        createMockChapter({
          id: 'ch-moderate',
          title: 'Moderate Chapter',
          order: 1,
          lastAnalysis: {
            summary: '',
            strengths: [],
            weaknesses: [],
            pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
        createMockChapter({
          id: 'ch-fast',
          title: 'Fast Chapter',
          order: 2,
          lastAnalysis: {
            summary: '',
            strengths: [],
            weaknesses: [],
            pacing: { score: 9, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('Slow')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Fast')).toBeInTheDocument();
    });

    it('displays chapter summary from analysis', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          title: 'Analyzed Chapter',
          order: 0,
          lastAnalysis: {
            summary: 'This chapter introduces the protagonist beautifully.',
            strengths: [],
            weaknesses: [],
            pacing: { score: 6, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('This chapter introduces the protagonist beautifully.')).toBeInTheDocument();
    });

    it('displays placeholder when no analysis summary', () => {
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'No Analysis', order: 0 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('No analysis yet. Run Deep Analysis to see insights.')).toBeInTheDocument();
    });
  });

  describe('header information', () => {
    it('displays project title in header', () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText(/Test Novel/)).toBeInTheDocument();
    });

    it('displays correct chapter and word count in header', () => {
      const chapters = [
        createMockChapter({ id: 'ch-1', content: 'One two three', order: 0 }),
        createMockChapter({ id: 'ch-2', content: 'Four five', order: 1 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText(/2 chapters, 5 words/)).toBeInTheDocument();
    });

    it('displays analysis status', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          order: 0,
          lastAnalysis: {
            summary: '',
            strengths: [],
            weaknesses: [],
            pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [],
            generalSuggestions: [],
          },
        }),
        createMockChapter({ id: 'ch-2', order: 1 }),
        createMockChapter({ id: 'ch-3', order: 2 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('1/3 analyzed')).toBeInTheDocument();
    });
  });

  describe('drag and drop', () => {
    it('attaches drag handlers to chapter cards', () => {
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'Chapter One', order: 0 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      const chapterCard = screen.getByText('Chapter One').closest('[draggable]');
      expect(chapterCard).toHaveAttribute('draggable', 'true');
    });

    it('calls reorderChapters when drag and drop completes', async () => {
      const store = baseStore();
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'First', order: 0 }),
        createMockChapter({ id: 'ch-2', title: 'Second', order: 1 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      const firstCard = screen.getByText('First').closest('[draggable]');
      const secondCard = screen.getByText('Second').closest('[draggable]');

      if (firstCard && secondCard) {
        // Simulate drag start on first card
        fireEvent.dragStart(firstCard, {
          dataTransfer: { effectAllowed: 'move' },
        });

        // Simulate drag over second card
        fireEvent.dragOver(secondCard, {
          preventDefault: vi.fn(),
        });

        // Simulate drop on second card
        fireEvent.drop(secondCard, {
          preventDefault: vi.fn(),
        });
      }

      await waitFor(() => {
        expect(store.reorderChapters).toHaveBeenCalled();
      });
    });

    it('does not reorder when dropping on same position', () => {
      const store = baseStore();
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'First', order: 0 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      const card = screen.getByText('First').closest('[draggable]');

      if (card) {
        fireEvent.dragStart(card, {
          dataTransfer: { effectAllowed: 'move' },
        });

        fireEvent.drop(card, {
          preventDefault: vi.fn(),
        });
      }

      expect(store.reorderChapters).not.toHaveBeenCalled();
    });
  });

  describe('Quick Create functionality', () => {
    it('renders the Quick Create card', () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      expect(screen.getByText('New Card')).toBeInTheDocument();
    });

    it('shows input form when Quick Create is clicked', async () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('New Card'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Chapter title...')).toBeInTheDocument();
      });
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls createChapter when form is submitted', async () => {
      const store = baseStore();
      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      // Open the form
      fireEvent.click(screen.getByText('New Card'));

      // Fill in title
      const input = await screen.findByPlaceholderText('Chapter title...');
      fireEvent.change(input, { target: { value: 'My New Chapter' } });

      // Submit
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(store.createChapter).toHaveBeenCalledWith('My New Chapter');
      });
    });

    it('creates chapter on Enter key press', async () => {
      const store = baseStore();
      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('New Card'));

      const input = await screen.findByPlaceholderText('Chapter title...');
      fireEvent.change(input, { target: { value: 'Enter Key Chapter' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(store.createChapter).toHaveBeenCalledWith('Enter Key Chapter');
      });
    });

    it('cancels creation on Escape key press', async () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('New Card'));

      const input = await screen.findByPlaceholderText('Chapter title...');
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.getByText('New Card')).toBeInTheDocument();
      });
      expect(screen.queryByPlaceholderText('Chapter title...')).not.toBeInTheDocument();
    });

    it('cancels creation when Cancel button is clicked', async () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('New Card'));
      await screen.findByPlaceholderText('Chapter title...');

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.getByText('New Card')).toBeInTheDocument();
      });
    });

    it('does not create chapter with empty title', async () => {
      const store = baseStore();
      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('New Card'));
      await screen.findByPlaceholderText('Chapter title...');

      // Submit with empty input
      fireEvent.click(screen.getByText('Create'));

      expect(store.createChapter).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('calls selectChapter and onSwitchToEditor when card is clicked', () => {
      const store = baseStore();
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'Clickable Chapter', order: 0 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...store,
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('Clickable Chapter'));

      expect(store.selectChapter).toHaveBeenCalledWith('ch-1');
      expect(mockOnSwitchToEditor).toHaveBeenCalled();
    });

    it('switches to editor view when Editor View button is clicked', () => {
      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters: [],
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      fireEvent.click(screen.getByText('Editor View'));

      expect(mockOnSwitchToEditor).toHaveBeenCalled();
    });
  });

  describe('active chapter indication', () => {
    it('highlights the active chapter card', () => {
      const chapters = [
        createMockChapter({ id: 'ch-1', title: 'Active', order: 0 }),
        createMockChapter({ id: 'ch-2', title: 'Inactive', order: 1 }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
        activeChapterId: 'ch-1',
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      // The active chapter should have the indigo number badge
      const activeCard = screen.getByText('Active').closest('[draggable]');
      expect(activeCard).toBeInTheDocument();

      // Check for the active indicator styling on the number badge
      const activeBadge = activeCard?.querySelector('.bg-indigo-500');
      expect(activeBadge).toBeInTheDocument();
    });
  });

  describe('character avatars', () => {
    it('displays character avatars from analysis', () => {
      const chapters = [
        createMockChapter({
          id: 'ch-1',
          title: 'Chapter with Characters',
          order: 0,
          lastAnalysis: {
            summary: '',
            strengths: [],
            weaknesses: [],
            pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] },
            plotIssues: [],
            characters: [
              { name: 'Alice', bio: '', arc: '', arcStages: [], relationships: [], plotThreads: [], inconsistencies: [], developmentSuggestion: '' },
              { name: 'Bob', bio: '', arc: '', arcStages: [], relationships: [], plotThreads: [], inconsistencies: [], developmentSuggestion: '' },
            ],
            generalSuggestions: [],
          },
        }),
      ];

      mockUseProjectStore.mockReturnValue({
        ...baseStore(),
        chapters,
      });

      render(<StoryBoard onSwitchToEditor={mockOnSwitchToEditor} />);

      // Character initials should be displayed
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });
});
