import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProactiveSuggestions,
  ProactiveSuggestionsBadge,
} from '@/features/agent/components/ProactiveSuggestions';
import type { ProactiveSuggestion } from '@/services/memory/proactive';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ProactiveSuggestions', () => {
  const createSuggestion = (overrides: Partial<ProactiveSuggestion> = {}): ProactiveSuggestion => ({
    id: 'suggestion-1',
    type: 'watched_entity',
    title: 'Test Suggestion',
    description: 'This is a test suggestion description',
    priority: 'medium',
    tags: ['tag1', 'tag2'],
    suggestedAction: 'Take this action',
    source: { type: 'entity', id: 'entity-1', name: 'Test Entity' },
    createdAt: Date.now(),
    ...overrides,
  });

  const defaultProps = {
    suggestions: [createSuggestion()],
    onDismiss: vi.fn(),
    onDismissAll: vi.fn(),
    onAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('returns null when suggestions array is empty', () => {
      const { container } = render(
        <ProactiveSuggestions {...defaultProps} suggestions={[]} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Header', () => {
    it('renders header with Suggestions title', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });

    it('shows suggestion count badge', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ id: '1' }), createSuggestion({ id: '2' })]}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders Dismiss all button', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('Dismiss all')).toBeInTheDocument();
    });

    it('calls onDismissAll when Dismiss all is clicked', () => {
      const onDismissAll = vi.fn();
      render(<ProactiveSuggestions {...defaultProps} onDismissAll={onDismissAll} />);

      fireEvent.click(screen.getByText('Dismiss all'));

      expect(onDismissAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Suggestion Cards', () => {
    it('renders suggestion title', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('Test Suggestion')).toBeInTheDocument();
    });

    it('renders suggestion description', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('This is a test suggestion description')).toBeInTheDocument();
    });

    it('renders type icon for watched_entity', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ type: 'watched_entity' })]}
        />
      );

      expect(screen.getByText('👁️')).toBeInTheDocument();
    });

    it('renders type icon for related_memory', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ type: 'related_memory' })]}
        />
      );

      expect(screen.getByText('💭')).toBeInTheDocument();
    });

    it('renders type icon for active_goal', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ type: 'active_goal' })]}
        />
      );

      expect(screen.getByText('🎯')).toBeInTheDocument();
    });

    it('renders type icon for reminder', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ type: 'reminder' })]}
        />
      );

      expect(screen.getByText('⚡')).toBeInTheDocument();
    });
  });

  describe('Tags', () => {
    it('renders tags when present', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ tags: ['character', 'plot'] })]}
        />
      );

      expect(screen.getByText('character')).toBeInTheDocument();
      expect(screen.getByText('plot')).toBeInTheDocument();
    });

    it('limits displayed tags to 3', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ tags: ['tag1', 'tag2', 'tag3', 'tag4'] })]}
        />
      );

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.queryByText('tag4')).not.toBeInTheDocument();
    });

    it('does not render tags section when tags array is empty', () => {
      const { container } = render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ tags: [] })]}
        />
      );

      // Tags section should not exist
      const tagElements = container.querySelectorAll('.rounded');
      // Only the card and priority dot have rounded classes
      expect(tagElements.length).toBeLessThan(4);
    });
  });

  describe('Priority Styling', () => {
    it('applies high priority styles', () => {
      const { container } = render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ priority: 'high' })]}
        />
      );

      const card = container.querySelector('.border-red-200');
      expect(card).toBeInTheDocument();
    });

    it('applies medium priority styles', () => {
      const { container } = render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ priority: 'medium' })]}
        />
      );

      const card = container.querySelector('.border-amber-200');
      expect(card).toBeInTheDocument();
    });

    it('applies low priority styles', () => {
      const { container } = render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ priority: 'low' })]}
        />
      );

      const card = container.querySelector('.border-blue-200');
      expect(card).toBeInTheDocument();
    });

    it('renders priority indicator dot', () => {
      const { container } = render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ priority: 'high' })]}
        />
      );

      const dot = container.querySelector('.bg-red-500');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders Details → button when onAction and suggestedAction are provided', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('Details →')).toBeInTheDocument();
    });

    it('does not render Details → when suggestedAction is undefined', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ suggestedAction: undefined })]}
        />
      );

      expect(screen.queryByText('Details →')).not.toBeInTheDocument();
    });

    it('does not render Details → when onAction is undefined', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          onAction={undefined}
        />
      );

      expect(screen.queryByText('Details →')).not.toBeInTheDocument();
    });

    it('calls onAction with suggestion when Details → is clicked', () => {
      const suggestion = createSuggestion();
      const onAction = vi.fn();
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[suggestion]}
          onAction={onAction}
        />
      );

      fireEvent.click(screen.getByText('Details →'));

      expect(onAction).toHaveBeenCalledWith(suggestion);
    });

    it('renders Dismiss button for each suggestion', () => {
      render(<ProactiveSuggestions {...defaultProps} />);

      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('calls onDismiss with suggestion id when Dismiss is clicked', () => {
      const onDismiss = vi.fn();
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[createSuggestion({ id: 'test-id' })]}
          onDismiss={onDismiss}
        />
      );

      fireEvent.click(screen.getByText('Dismiss'));

      expect(onDismiss).toHaveBeenCalledWith('test-id');
    });
  });

  describe('Multiple Suggestions', () => {
    it('renders all suggestions', () => {
      render(
        <ProactiveSuggestions
          {...defaultProps}
          suggestions={[
            createSuggestion({ id: '1', title: 'First Suggestion' }),
            createSuggestion({ id: '2', title: 'Second Suggestion' }),
            createSuggestion({ id: '3', title: 'Third Suggestion' }),
          ]}
        />
      );

      expect(screen.getByText('First Suggestion')).toBeInTheDocument();
      expect(screen.getByText('Second Suggestion')).toBeInTheDocument();
      expect(screen.getByText('Third Suggestion')).toBeInTheDocument();
    });
  });
});

describe('ProactiveSuggestionsBadge', () => {
  describe('Empty State', () => {
    it('returns null when count is 0', () => {
      const { container } = render(
        <ProactiveSuggestionsBadge count={0} onClick={vi.fn()} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Rendering', () => {
    it('renders badge with count', () => {
      render(<ProactiveSuggestionsBadge count={5} onClick={vi.fn()} />);

      expect(screen.getByText('5 suggestions')).toBeInTheDocument();
    });

    it('uses singular form for count of 1', () => {
      render(<ProactiveSuggestionsBadge count={1} onClick={vi.fn()} />);

      expect(screen.getByText('1 suggestion')).toBeInTheDocument();
    });

    it('renders sparkle emoji', () => {
      render(<ProactiveSuggestionsBadge count={3} onClick={vi.fn()} />);

      expect(screen.getByText('✨')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when badge is clicked', () => {
      const onClick = vi.fn();
      render(<ProactiveSuggestionsBadge count={2} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
