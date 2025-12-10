import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ImportWizard } from '@/features/project/components/ImportWizard';
import type { ParsedChapter } from '@/services/manuscriptParser';

const createChapters = (): ParsedChapter[] => [
  {
    title: 'Duplicate Chapter',
    content: 'short',
  },
  {
    title: 'Duplicate Chapter',
    content: 'This is a much longer chapter with enough words to avoid basic issues. '.repeat(10),
  },
];

describe('ImportWizard multi-step flow', () => {
  it('walks through configure -> review -> complete while surfacing chapter health panels', async () => {
    const initialChapters = createChapters();
    const handleConfirm = vi.fn();

    render(
      <ImportWizard
        initialChapters={initialChapters}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/import wizard/i)).toBeInTheDocument();

    // Quality + issues panel for the first chapter
    await waitFor(() => expect(screen.getByText(/quality score/i)).toBeInTheDocument());
    expect(screen.getByText(/issues \(\d+\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/chapter has very little content/i).length).toBeGreaterThan(0);

    // Search to force empty state, then clear and continue
    const searchInput = screen.getByPlaceholderText(/search chapters/i);
    fireEvent.change(searchInput, { target: { value: 'missing' } });
    expect(await screen.findByText(/no chapters found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/clear search/i));
    await waitFor(() => expect(screen.queryByText(/no chapters found/i)).not.toBeInTheDocument());

    // Navigate to second chapter and adjust title before confirming
    const chapterEntries = screen.getAllByText('Duplicate Chapter');
    fireEvent.click(chapterEntries[chapterEntries.length - 1]);
    const editor = await screen.findByPlaceholderText(/chapter title/i);
    fireEvent.change(editor, { target: { value: 'Renamed Chapter' } });

    fireEvent.click(screen.getByText(/finish import/i));

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalled();
    });

    const confirmedChapters = handleConfirm.mock.calls[0][0] as ParsedChapter[];
    expect(confirmedChapters[1].title).toBe('Renamed Chapter');
    expect(confirmedChapters).toHaveLength(2);
  });

  it('detects and auto-fixes missing Chapter 1 sequence gap', async () => {
    const initialChapters: ParsedChapter[] = [
      {
        title: 'Prologue / Front Matter',
        content: '“This looks like chapter 1 content.”',
      },
      {
        title: 'Chapter 2',
        content: 'Chapter 2 content starts here.',
      },
    ];
    const handleConfirm = vi.fn();

    render(
      <ImportWizard
        initialChapters={initialChapters}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />
    );

    // 1. Verify warning is displayed
    const warnings = await screen.findAllByText(/Sequence Gap: Next is Chapter 2/i);
    expect(warnings.length).toBeGreaterThan(0);

    // 2. Verify Auto-Fix button is present
    const autoFixButton = screen.getByText(/Auto-Fix \d+ Issues/i);
    expect(autoFixButton).toBeInTheDocument();

    // 3. Click Auto-Fix
    fireEvent.click(autoFixButton);

    // 4. Verify title changed to "Chapter 1"
    await waitFor(() => {
      const chapters = screen.getAllByText('Chapter 1');
      expect(chapters.length).toBeGreaterThan(0);
    });

    // 5. Verify warning is gone
    await waitFor(() => {
      expect(screen.queryByText(/Sequence Gap: Next is Chapter 2/i)).not.toBeInTheDocument();
    });
  });
});
