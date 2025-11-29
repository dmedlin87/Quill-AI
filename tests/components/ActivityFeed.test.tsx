import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ActivityFeed } from '@/features/agent/components/ActivityFeed';
import type { HistoryItem } from '@/types';

const makeHistoryItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
  id: overrides.id ?? '1',
  author: overrides.author ?? 'User',
  description: overrides.description ?? 'Edited paragraph',
  timestamp: overrides.timestamp ?? Date.now(),
  previousContent: overrides.previousContent ?? 'old content',
  newContent: overrides.newContent ?? 'new content',
});

describe('ActivityFeed', () => {
  it('renders empty state when no history items', () => {
    render(
      <ActivityFeed
        history={[]}
        onRestore={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });

  it('renders history items in reverse order', () => {
    const first = makeHistoryItem({ id: '1', description: 'First change' });
    const second = makeHistoryItem({ id: '2', description: 'Second change' });

    render(
      <ActivityFeed
        history={[first, second]}
        onRestore={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    const descriptions = screen.getAllByText(/change$/).map(el => el.textContent);
    expect(descriptions[0]).toBe('Second change');
    expect(descriptions[1]).toBe('First change');
  });

  it('fires callbacks when Revert and Diff are clicked', () => {
    const item = makeHistoryItem({ id: 'abc', description: 'Some change' });
    const onRestore = vi.fn();
    const onInspect = vi.fn();

    render(
      <ActivityFeed
        history={[item]}
        onRestore={onRestore}
        onInspect={onInspect}
      />
    );

    fireEvent.click(screen.getByText('Revert'));
    expect(onRestore).toHaveBeenCalledWith('abc');

    fireEvent.click(screen.getByText('Diff'));
    expect(onInspect).toHaveBeenCalledWith(item);
  });
});
