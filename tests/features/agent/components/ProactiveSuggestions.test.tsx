import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ProactiveSuggestions, ProactiveSuggestionsBadge } from '@/features/agent/components/ProactiveSuggestions';
import { ProactiveSuggestion } from '@/services/memory/proactive';
import { eventBus } from '@/services/appBrain';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/services/appBrain', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

const baseSuggestion: ProactiveSuggestion = {
  id: 'test-id',
  title: 'Test Suggestion',
  description: 'Test Description',
  priority: 'medium',
  type: 'related_memory',
  tags: [],
  source: { id: 'source-id', type: 'memory' },
  context: {},
  timestamp: Date.now(),
};

describe('ProactiveSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no suggestions', () => {
    const { container } = render(
      <ProactiveSuggestions
        suggestions={[]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders suggestions count and dismiss all button', () => {
    render(
      <ProactiveSuggestions
        suggestions={[baseSuggestion]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Dismiss all')).toBeInTheDocument();
  });

  it('renders "Thinking..." when isThinking is true', () => {
    render(
      <ProactiveSuggestions
        suggestions={[baseSuggestion]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        isThinking={true}
      />
    );
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  describe('Suggestion Types and Categories', () => {
    const testCategory = (tags: string[], expectedCategory: string) => {
      const suggestion: ProactiveSuggestion = {
        ...baseSuggestion,
        id: `sugg-${tags.join('-')}`,
        type: 'related_memory',
        tags,
      };

      const { unmount } = render(
        <ProactiveSuggestions
          suggestions={[suggestion]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
          onApply={vi.fn()} // Need onApply to render Apply button
        />
      );

      const applyBtn = screen.getByText('✓ Apply');
      fireEvent.click(applyBtn);

      expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          suggestionCategory: expectedCategory,
        }),
      }));
      unmount();
    };

    it('categorizes "plot" memory correctly', () => testCategory(['plot'], 'plot'));
    it('categorizes "character" memory correctly', () => testCategory(['character'], 'character'));
    it('categorizes "pacing" memory correctly', () => testCategory(['pacing'], 'pacing'));
    it('categorizes "style" memory correctly', () => testCategory(['style'], 'style'));
    it('categorizes "continuity" memory correctly', () => testCategory(['continuity'], 'continuity'));
    it('categorizes unknown tags as "other"', () => testCategory(['random'], 'other'));
    it('categorizes other types correctly', () => {
        const suggestion: ProactiveSuggestion = {
            ...baseSuggestion,
            id: 'lore-sugg',
            type: 'lore_discovery',
        };
        const { unmount } = render(
            <ProactiveSuggestions
              suggestions={[suggestion]}
              onDismiss={vi.fn()}
              onDismissAll={vi.fn()}
              onApply={vi.fn()}
            />
        );
        const applyBtn = screen.getByText('Create entry');
        fireEvent.click(applyBtn);
        expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({ suggestionCategory: 'lore_discovery' })
        }));
        unmount();
    });
  });

  describe('Rendering Specific Types', () => {
    it('renders lore discovery specific UI', () => {
      render(
        <ProactiveSuggestions
          suggestions={[{ ...baseSuggestion, type: 'lore_discovery' }]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
        />
      );
      expect(screen.getByText('Lore')).toBeInTheDocument();
    });

    it('renders timeline conflict specific UI', () => {
      render(
        <ProactiveSuggestions
          suggestions={[{
              ...baseSuggestion,
              type: 'timeline_conflict',
              metadata: { previousMarker: 'A', currentMarker: 'B' }
          }]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
        />
      );
      expect(screen.getByText('Timeline')).toBeInTheDocument();
      expect(screen.getByText('Continuity check')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('renders voice inconsistency specific UI', () => {
      render(
        <ProactiveSuggestions
          suggestions={[{
              ...baseSuggestion,
              type: 'voice_inconsistency',
              metadata: {
                  speaker: 'Alice',
                  historicImpression: 'Calm',
                  currentImpression: 'Angry',
                  diffs: [{ label: 'Tone', current: 0.9, historic: 0.1 }]
              }
          }]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
        />
      );
      expect(screen.getByText('Voice consistency')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Calm')).toBeInTheDocument();
      expect(screen.getByText('Angry')).toBeInTheDocument();
      expect(screen.getByText(/Tone: 0.90 vs 0.10/)).toBeInTheDocument();
    });

    it('renders tags when present', () => {
        render(
            <ProactiveSuggestions
              suggestions={[{ ...baseSuggestion, tags: ['tag1', 'tag2'] }]}
              onDismiss={vi.fn()}
              onDismissAll={vi.fn()}
            />
        );
        expect(screen.getByText('tag1')).toBeInTheDocument();
        expect(screen.getByText('tag2')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('opens and closes menu', () => {
      render(
        <ProactiveSuggestions
          suggestions={[baseSuggestion]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
        />
      );

      const menuBtn = screen.getByText('⋮');
      fireEvent.click(menuBtn);
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();

      fireEvent.click(menuBtn); // Toggle off
      expect(screen.queryByText("Don't show this again")).not.toBeInTheDocument();
    });

    it('handles toggling menu between different suggestions', () => {
       const sugg2 = { ...baseSuggestion, id: 's2' };
       render(
        <ProactiveSuggestions
          suggestions={[baseSuggestion, sugg2]}
          onDismiss={vi.fn()}
          onDismissAll={vi.fn()}
        />
      );

      const menuBtns = screen.getAllByText('⋮');
      fireEvent.click(menuBtns[0]);
      // Should show menu for first
      // We can't easily distinguish which menu it is without specific structure query,
      // but we can verify menu is present.
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();

      fireEvent.click(menuBtns[1]);
      // Should show menu for second (and technically close first, but since it's just state replacement, it works)
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();

      fireEvent.click(menuBtns[1]); // Close second
      expect(screen.queryByText("Don't show this again")).not.toBeInTheDocument();
    });

    it('triggers onApply', () => {
        const onApply = vi.fn();
        render(
            <ProactiveSuggestions
              suggestions={[baseSuggestion]}
              onDismiss={vi.fn()}
              onDismissAll={vi.fn()}
              onApply={onApply}
            />
        );
        fireEvent.click(screen.getByText('✓ Apply'));
        expect(onApply).toHaveBeenCalledWith(baseSuggestion);
    });

    it('triggers onAction if suggestedAction is present', () => {
        const onAction = vi.fn();
        const sugg = { ...baseSuggestion, suggestedAction: 'do_something' };
        render(
            <ProactiveSuggestions
              suggestions={[sugg]}
              onDismiss={vi.fn()}
              onDismissAll={vi.fn()}
              onAction={onAction}
            />
        );
        fireEvent.click(screen.getByText('Details →'));
        expect(onAction).toHaveBeenCalledWith(sugg);
    });

    it('triggers onAction with specific label for voice inconsistency', () => {
        const onAction = vi.fn();
        const sugg: ProactiveSuggestion = { ...baseSuggestion, type: 'voice_inconsistency', suggestedAction: 'rephrase' };
        render(
            <ProactiveSuggestions
              suggestions={[sugg]}
              onDismiss={vi.fn()}
              onDismissAll={vi.fn()}
              onAction={onAction}
            />
        );
        fireEvent.click(screen.getByText('Rephrase'));
        expect(onAction).toHaveBeenCalledWith(sugg);
    });
  });
});

describe('ProactiveSuggestionsBadge', () => {
  it('renders correctly', () => {
    render(<ProactiveSuggestionsBadge count={5} onClick={vi.fn()} />);
    expect(screen.getByText('5 suggestions')).toBeInTheDocument();
  });

  it('renders singular text for 1 suggestion', () => {
      render(<ProactiveSuggestionsBadge count={1} onClick={vi.fn()} />);
      expect(screen.getByText('1 suggestion')).toBeInTheDocument();
  });

  it('renders nothing if count is 0', () => {
    const { container } = render(<ProactiveSuggestionsBadge count={0} onClick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
