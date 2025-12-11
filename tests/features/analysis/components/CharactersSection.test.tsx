import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CharactersSection } from '@/features/analysis/components/CharactersSection';
import { AnalysisResult } from '@/types';

type Character = AnalysisResult['characters'][0];

describe('CharactersSection', () => {
  const mockCharacters: Character[] = [
    {
      name: 'John Doe',
      bio: 'A mysterious man.',
      arc: 'Starts mysterious, becomes clear.',
      inconsistencies: [
        { issue: 'Eye color changes', quote: 'His blue eyes...' },
      ],
      developmentSuggestion: 'Explore his past.',
      arcStages: [
        { stage: 'Beginning', description: 'Intro' },
        { stage: 'End', description: 'Conclusion' },
      ],
    },
  ];

  const defaultProps = {
    characters: mockCharacters,
    onQuoteClick: vi.fn(),
    onFixRequest: vi.fn(),
  };

  it('renders "No character insights" when character list is empty', () => {
    render(<CharactersSection {...defaultProps} characters={[]} />);
    expect(screen.getByText(/No character insights yet/i)).toBeInTheDocument();
  });

  it('renders character details correctly', () => {
    render(<CharactersSection {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/"A mysterious man."/)).toBeInTheDocument();
    expect(screen.getByText('Starts mysterious, becomes clear.')).toBeInTheDocument();
  });

  it('renders arc stages', () => {
    render(<CharactersSection {...defaultProps} />);
    expect(screen.getByText('Beginning')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByText('Intro')).toBeInTheDocument();
  });

  it('renders inconsistencies and handles quote click', () => {
    const onQuoteClick = vi.fn();
    render(<CharactersSection {...defaultProps} onQuoteClick={onQuoteClick} />);

    expect(screen.getByText('Eye color changes')).toBeInTheDocument();

    const quote = screen.getByText(/"His blue eyes..."/);
    fireEvent.click(quote.closest('li')!); // Click the list item

    expect(onQuoteClick).toHaveBeenCalledWith('His blue eyes...');
  });

  it('renders fix button for inconsistencies and calls onFixRequest', () => {
    const onFixRequest = vi.fn();
    render(<CharactersSection {...defaultProps} onFixRequest={onFixRequest} />);

    const fixButtons = screen.getAllByText('✨ Fix');
    const inconsistencyFixBtn = fixButtons[0];

    fireEvent.click(inconsistencyFixBtn);

    expect(onFixRequest).toHaveBeenCalledWith(
      'Character "John Doe" - "His blue eyes..."',
      'Fix this inconsistency: Eye color changes'
    );
  });

  it('renders fix button for development suggestion and calls onFixRequest', () => {
    const onFixRequest = vi.fn();
    render(<CharactersSection {...defaultProps} onFixRequest={onFixRequest} />);

    const fixButton = screen.getByText('✨ Fix with Agent');
    fireEvent.click(fixButton);

    expect(onFixRequest).toHaveBeenCalledWith(
      'Character "John Doe" development',
      'Explore his past.'
    );
  });

  it('handles inconsistency fix without quote', () => {
    const charsWithoutQuote = [{
      ...mockCharacters[0],
      inconsistencies: [{ issue: 'Generic issue' }],
    }];
    const onFixRequest = vi.fn();

    render(<CharactersSection {...defaultProps} characters={charsWithoutQuote} onFixRequest={onFixRequest} />);

    const fixButton = screen.getByText('✨ Fix');
    fireEvent.click(fixButton);

    expect(onFixRequest).toHaveBeenCalledWith(
      'Character "John Doe"',
      'Fix this inconsistency: Generic issue'
    );
  });

  it('renders fallback character avatar when name is missing', () => {
      const charsNoName = [{ ...mockCharacters[0], name: '' }];
      render(<CharactersSection {...defaultProps} characters={charsNoName} />);
      // It renders '?' in the avatar div
      expect(screen.getByText('?')).toBeInTheDocument();
  });
});
