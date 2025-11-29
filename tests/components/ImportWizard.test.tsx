import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { ImportWizard } from '@/features/project/components/ImportWizard';
import type { ParsedChapter } from '@/services/manuscriptParser';

// Mock crypto.randomUUID for stable IDs
let idCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-id-${idCounter++}`,
});

// Mock window.confirm and window.alert
const mockConfirm = vi.fn(() => true);
const mockAlert = vi.fn();
vi.stubGlobal('confirm', mockConfirm);
vi.stubGlobal('alert', mockAlert);

describe('ImportWizard', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const sampleChapters: ParsedChapter[] = [
    { title: 'Chapter 1: The Beginning', content: 'First chapter content with enough words to pass validation checks. This is the beginning of our story.' },
    { title: 'Chapter 2: The Journey', content: 'Second chapter content with a longer narrative. The journey continues through many lands.' },
    { title: 'Chapter 3: The End', content: 'Third chapter content that wraps up the story. All good things must come to an end.' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockConfirm.mockReturnValue(true);
  });

  describe('Initial State Rendering', () => {
    it('renders the wizard with chapter count and stats', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Import Wizard')).toBeInTheDocument();
      expect(screen.getByText(/3 chapters detected/)).toBeInTheDocument();
    });

    it('displays all chapters from initialChapters', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Chapter 1: The Beginning')).toBeInTheDocument();
      expect(screen.getByText('Chapter 2: The Journey')).toBeInTheDocument();
      expect(screen.getByText('Chapter 3: The End')).toBeInTheDocument();
    });

    it('selects the first chapter by default and shows it in the editor', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // First chapter title should appear in the title input
      const titleInput = screen.getByDisplayValue('Chapter 1: The Beginning');
      expect(titleInput).toBeInTheDocument();
    });

    it('renders wizard step indicators', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Detection')).toBeInTheDocument();
      expect(screen.getByText('Structure')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  describe('Chapter Selection', () => {
    it('changes active chapter when clicking on another chapter', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Click on the second chapter in the list
      fireEvent.click(screen.getByText('Chapter 2: The Journey'));

      // The editor should now show Chapter 2
      expect(screen.getByDisplayValue('Chapter 2: The Journey')).toBeInTheDocument();
    });

    it('toggles chapter selection when clicking the checkbox', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Get all checkbox buttons (they contain the Check icon when selected)
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );

      // Click first chapter's checkbox
      fireEvent.click(checkboxes[0]);

      // Selection indicator should appear
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('shows batch action buttons when chapters are selected', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Initially, Merge button should not be visible (no selection)
      expect(screen.queryByTitle('Merge Selected (⌘M)')).not.toBeInTheDocument();

      // Select a chapter using Select All
      fireEvent.click(screen.getByText('Select All'));

      // Now Merge and Delete buttons should appear
      expect(screen.getByTitle('Merge Selected (⌘M)')).toBeInTheDocument();
      expect(screen.getByTitle('Delete Selected (⌫)')).toBeInTheDocument();
    });

    it('clears selection when clicking Clear button', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select all chapters
      fireEvent.click(screen.getByText('Select All'));
      expect(screen.getByText('3 selected')).toBeInTheDocument();

      // Click Clear
      fireEvent.click(screen.getByText('Clear'));

      // Selection indicator should disappear
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  describe('Merge Action', () => {
    it('disables merge button when fewer than 2 chapters are selected', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select only one chapter
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);

      // Merge button should be disabled
      const mergeButton = screen.getByTitle('Merge Selected (⌘M)');
      expect(mergeButton).toBeDisabled();
    });

    it('merges selected chapters when clicking Merge', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select first two chapters
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      expect(screen.getByText('2 selected')).toBeInTheDocument();

      // Click Merge
      fireEvent.click(screen.getByTitle('Merge Selected (⌘M)'));

      // Should now have 2 chapters (merged + remaining)
      expect(screen.getByText(/2 chapters detected/)).toBeInTheDocument();

      // Merged chapter should have "(Merged)" in title
      expect(screen.getByText(/\(Merged\)/)).toBeInTheDocument();
    });
  });

  describe('Delete Action', () => {
    it('deletes selected chapters when clicking Delete and confirming', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select first chapter
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);

      // Click Delete
      fireEvent.click(screen.getByTitle('Delete Selected (⌫)'));

      // Confirm was called
      expect(mockConfirm).toHaveBeenCalledWith('Delete 1 chapter(s)?');

      // Should now have 2 chapters
      expect(screen.getByText(/2 chapters detected/)).toBeInTheDocument();
      expect(screen.queryByText('Chapter 1: The Beginning')).not.toBeInTheDocument();
    });

    it('does not delete when user cancels the confirmation', () => {
      mockConfirm.mockReturnValueOnce(false);

      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select first chapter
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);

      // Click Delete
      fireEvent.click(screen.getByTitle('Delete Selected (⌫)'));

      // Should still have 3 chapters
      expect(screen.getByText(/3 chapters detected/)).toBeInTheDocument();
    });

    it('prevents deleting the last remaining chapter', () => {
      const singleChapter: ParsedChapter[] = [
        { title: 'Only Chapter', content: 'The only content in this manuscript.' },
      ];

      render(
        <ImportWizard
          initialChapters={singleChapter}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select the only chapter
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);

      // Try to delete
      fireEvent.click(screen.getByTitle('Delete Selected (⌫)'));

      // Alert should be shown instead
      expect(mockAlert).toHaveBeenCalledWith('Cannot delete the only chapter.');
      expect(mockConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Finish Import', () => {
    it('calls onConfirm with chapters when clicking Finish Import', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText('Finish Import'));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith([
        { title: 'Chapter 1: The Beginning', content: expect.any(String) },
        { title: 'Chapter 2: The Journey', content: expect.any(String) },
        { title: 'Chapter 3: The End', content: expect.any(String) },
      ]);
    });

    it('calls onConfirm with modified chapters after merge', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select and merge first two chapters
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(screen.getByTitle('Merge Selected (⌘M)'));

      // Finish import
      fireEvent.click(screen.getByText('Finish Import'));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      const result = mockOnConfirm.mock.calls[0][0];
      expect(result).toHaveLength(2);
      expect(result[0].title).toContain('(Merged)');
    });

    it('calls onConfirm with remaining chapters after delete', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Select and delete first chapter
      const checkboxes = screen.getAllByRole('button').filter(
        btn => btn.className.includes('w-4 h-4 rounded border')
      );
      fireEvent.click(checkboxes[0]);
      fireEvent.click(screen.getByTitle('Delete Selected (⌫)'));

      // Finish import
      fireEvent.click(screen.getByText('Finish Import'));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      const result = mockOnConfirm.mock.calls[0][0];
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Chapter 2: The Journey');
      expect(result[1].title).toBe('Chapter 3: The End');
    });
  });

  describe('Cancel', () => {
    it('calls onCancel when clicking Cancel button', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search', () => {
    it('filters chapters based on search query', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search chapters... (⌘F)');
      fireEvent.change(searchInput, { target: { value: 'Journey' } });

      // Only Chapter 2 should be visible in the list
      expect(screen.getByText('Chapter 2: The Journey')).toBeInTheDocument();
      expect(screen.queryByText('Chapter 1: The Beginning')).not.toBeInTheDocument();
      expect(screen.queryByText('Chapter 3: The End')).not.toBeInTheDocument();
    });

    it('shows no chapters message when search has no matches', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search chapters... (⌘F)');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No chapters found')).toBeInTheDocument();
      expect(screen.getByText('Clear search')).toBeInTheDocument();
    });
  });

  describe('Chapter Editing', () => {
    it('allows editing chapter title', () => {
      render(
        <ImportWizard
          initialChapters={sampleChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const titleInput = screen.getByDisplayValue('Chapter 1: The Beginning');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      // Finish import to verify the change
      fireEvent.click(screen.getByText('Finish Import'));

      const result = mockOnConfirm.mock.calls[0][0];
      expect(result[0].title).toBe('New Title');
    });
  });

  describe('Empty State', () => {
    it('disables Finish Import when no chapters exist', () => {
      // This scenario shouldn't normally happen, but test defensive behavior
      const emptyChapters: ParsedChapter[] = [];

      render(
        <ImportWizard
          initialChapters={emptyChapters}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const finishButton = screen.getByText('Finish Import').closest('button');
      expect(finishButton).toBeDisabled();
    });
  });
});
