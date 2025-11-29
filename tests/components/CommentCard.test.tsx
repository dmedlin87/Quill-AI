import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { CommentCard } from '@/features/editor/components/CommentCard';
import type { CommentMarkAttributes } from '@/features/editor/extensions/CommentMark';

const baseComment: CommentMarkAttributes & { quote?: string } = {
  commentId: 'c-1',
  type: 'plot',
  issue: 'A plot issue',
  suggestion: 'A helpful suggestion',
  severity: 'warning',
  quote: 'Highlighted text',
};

describe('CommentCard', () => {
  it('renders issue, suggestion and highlighted quote', () => {
    const onClose = vi.fn();
    const onFixWithAgent = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommentCard
        comment={baseComment}
        position={{ top: 100, left: 120 }}
        onClose={onClose}
        onFixWithAgent={onFixWithAgent}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Issue')).toBeInTheDocument();
    expect(screen.getByText(baseComment.issue)).toBeInTheDocument();
    expect(screen.getByText('Suggestion')).toBeInTheDocument();
    expect(screen.getByText(baseComment.suggestion)).toBeInTheDocument();
    // Header label for the highlighted quote
    expect(
      screen.getByRole('heading', { name: /Highlighted Text/i })
    ).toBeInTheDocument();
  });

  it('calls onFixWithAgent with comment details', () => {
    const onClose = vi.fn();
    const onFixWithAgent = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommentCard
        comment={baseComment}
        position={{ top: 50, left: 60 }}
        onClose={onClose}
        onFixWithAgent={onFixWithAgent}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /fix with agent/i }));

    expect(onFixWithAgent).toHaveBeenCalledWith(
      baseComment.issue,
      baseComment.suggestion,
      baseComment.quote,
    );
  });

  it('calls onDismiss with the comment id', () => {
    const onClose = vi.fn();
    const onFixWithAgent = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommentCard
        comment={baseComment}
        position={{ top: 10, left: 10 }}
        onClose={onClose}
        onFixWithAgent={onFixWithAgent}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledWith(baseComment.commentId);
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();

    render(
      <CommentCard
        comment={baseComment}
        position={{ top: 10, left: 10 }}
        onClose={onClose}
        onFixWithAgent={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
