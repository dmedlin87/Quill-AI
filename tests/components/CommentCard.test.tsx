import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const defaultPosition = { top: 10, left: 10 };

const renderCommentCard = (
  overrides: Partial<React.ComponentProps<typeof CommentCard>> = {},
) => {
  const onClose = overrides.onClose ?? vi.fn();
  const onFixWithAgent = overrides.onFixWithAgent ?? vi.fn();
  const onDismiss = overrides.onDismiss ?? vi.fn();

  const { comment = baseComment, position = defaultPosition, ...rest } = overrides;

  const utils = render(
    <CommentCard
      comment={comment}
      position={position}
      onClose={onClose}
      onFixWithAgent={onFixWithAgent}
      onDismiss={onDismiss}
      {...rest}
    />,
  );

  return { onClose, onFixWithAgent, onDismiss, ...utils };
};

describe('CommentCard', () => {
  it('renders issue, suggestion and highlighted quote', () => {
    renderCommentCard({ position: { top: 100, left: 120 } });

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
    const { onFixWithAgent } = renderCommentCard({ position: { top: 50, left: 60 } });

    fireEvent.click(screen.getByRole('button', { name: /fix with agent/i }));

    expect(onFixWithAgent).toHaveBeenCalledWith(
      baseComment.issue,
      baseComment.suggestion,
      baseComment.quote,
    );
  });

  it('calls onDismiss with the comment id', () => {
    const { onDismiss } = renderCommentCard();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledWith(baseComment.commentId);
  });

  it('closes when Escape is pressed', () => {
    const { onClose } = renderCommentCard();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('repositions when near viewport edges', async () => {
    const getBoundingClientRectMock = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 200,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect);

    const innerWidthSpy = vi
      .spyOn(window, 'innerWidth', 'get')
      .mockReturnValue(300);
    const innerHeightSpy = vi
      .spyOn(window, 'innerHeight', 'get')
      .mockReturnValue(400);

    const { container } = renderCommentCard({ position: { top: 300, left: 200 } });

    const card = container.firstChild as HTMLDivElement;

    try {
      await waitFor(() => {
        expect(card.style.top).toBe('70px');
        expect(card.style.left).toBe('80px');
      });
    } finally {
      getBoundingClientRectMock.mockRestore();
      innerWidthSpy.mockRestore();
      innerHeightSpy.mockRestore();
    }
  });

  it('clamps left position when too close to the edge', async () => {
    const getBoundingClientRectMock = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 180,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 180,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect);

    const innerWidthSpy = vi
      .spyOn(window, 'innerWidth', 'get')
      .mockReturnValue(200);
    const innerHeightSpy = vi
      .spyOn(window, 'innerHeight', 'get')
      .mockReturnValue(400);

    const { container } = renderCommentCard({ position: { top: 10, left: 0 } });

    const card = container.firstChild as HTMLDivElement;

    try {
      await waitFor(() => {
        expect(card.style.left).toBe('20px');
      });
    } finally {
      getBoundingClientRectMock.mockRestore();
      innerWidthSpy.mockRestore();
      innerHeightSpy.mockRestore();
    }
  });
});
