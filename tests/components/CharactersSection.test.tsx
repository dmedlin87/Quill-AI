import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { CharactersSection } from '@/features/analysis/components/CharactersSection';
import { createCharacter } from '@/tests/factories/analysisResultFactory';

describe('CharactersSection', () => {
  it('renders character details and arc progression', () => {
    const characters = [
      createCharacter({
        name: 'Aria',
        bio: 'A determined protagonist.',
        arc: 'Learns to trust others.',
      }),
    ];

    render(
      <CharactersSection
        characters={characters}
        onQuoteClick={() => {}}
      />
    );

    expect(screen.getByText('Character Development')).toBeInTheDocument();
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText(/determined protagonist/i)).toBeInTheDocument();
    expect(screen.getByText('Character Arc Summary')).toBeInTheDocument();
  });

  it('invokes callbacks for inconsistency and suggestion fix actions', () => {
    const onQuoteClick = vi.fn();
    const onFixRequest = vi.fn();

    const characters = [
      createCharacter({
        name: 'Aria',
        inconsistencies: [
          {
            issue: 'Age appears inconsistent.',
            quote: 'At sixteen, she had already...',
          },
        ],
        developmentSuggestion: 'Add a moment of doubt before the final decision.',
      }),
    ];

    render(
      <CharactersSection
        characters={characters}
        onQuoteClick={onQuoteClick}
        onFixRequest={onFixRequest}
      />
    );

    // Click inconsistency item triggers quote click
    fireEvent.click(screen.getByText('Age appears inconsistent.'));
    expect(onQuoteClick).toHaveBeenCalledWith('At sixteen, she had already...');

    // Click Fix button inside inconsistency card
    const inconsistencyFix = screen.getByText('✨ Fix');
    fireEvent.click(inconsistencyFix);

    expect(onFixRequest).toHaveBeenCalledWith(
      'Character "Aria" - "At sixteen, she had already..."',
      'Fix this inconsistency: Age appears inconsistent.'
    );

    // Click Fix with Agent for development suggestion
    const suggestionFix = screen.getByText('✨ Fix with Agent');
    fireEvent.click(suggestionFix);

    expect(onFixRequest).toHaveBeenCalledWith(
      'Character "Aria" development',
      'Add a moment of doubt before the final decision.'
    );
  });

  it('handles empty character list gracefully', () => {
    render(
      <CharactersSection
        characters={[]}
        onQuoteClick={() => {}}
      />
    );

    // Empty state message should be shown
    expect(screen.getByText(/No character insights yet/)).toBeInTheDocument();
    // No character cards rendered
    expect(screen.queryByText('Key Character')).not.toBeInTheDocument();
  });
});
