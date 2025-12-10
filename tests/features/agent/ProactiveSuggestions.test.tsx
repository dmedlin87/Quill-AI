import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProactiveSuggestions } from '@/features/agent/components/ProactiveSuggestions';
import { eventBus } from '@/services/appBrain';
import type { ProactiveSuggestion } from '@/services/memory/proactive';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ProactiveSuggestions interactions', () => {
  const baseSuggestion: ProactiveSuggestion = {
    id: 'suggestion-1',
    type: 'related_memory',
    title: 'Plot callback',
    description: 'Connect this scene back to the earlier thread.',
    priority: 'high',
    tags: ['plot'],
    source: { type: 'memory', id: 'm1', name: 'Memory 1' },
    suggestedAction: 'Review memory',
    createdAt: 1700000000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles dismiss all, menu toggling, and feedback actions', () => {
    const onDismiss = vi.fn();
    const onDismissAll = vi.fn();
    const emitSpy = vi.spyOn(eventBus, 'emit');

    render(
      <ProactiveSuggestions
        suggestions={[baseSuggestion]}
        onDismiss={onDismiss}
        onDismissAll={onDismissAll}
      />
    );

    fireEvent.click(screen.getByText('Dismiss all'));
    expect(onDismissAll).toHaveBeenCalledTimes(1);

    const menuButton = screen.getByText('⋮');

    fireEvent.click(menuButton);
    expect(screen.getByText("Don't show this again")).toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(screen.queryByText("Don't show this again")).not.toBeInTheDocument();

    fireEvent.click(menuButton);
    const menu = screen.getByText("Don't show this again").closest('div');
    fireEvent.click(within(menu as HTMLElement).getByText('Dismiss'));

    expect(onDismiss).toHaveBeenCalledWith('suggestion-1');
    expect(screen.queryByText("Don't show this again")).not.toBeInTheDocument();
    expect(emitSpy).toHaveBeenCalledWith({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'suggestion-1',
        action: 'dismissed',
        suggestionCategory: 'plot',
      },
    });

    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText("Don't show this again"));

    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledWith({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'suggestion-1',
        action: 'muted',
        suggestionCategory: 'plot',
      },
    });
    expect(screen.queryByText("Don't show this again")).not.toBeInTheDocument();
  });

  it('emits applied feedback and calls onApply', () => {
    const onApply = vi.fn();
    const emitSpy = vi.spyOn(eventBus, 'emit');

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
    expect(emitSpy).toHaveBeenCalledWith({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: 'suggestion-1',
        action: 'applied',
        suggestionCategory: 'plot',
      },
    });
  });
});
