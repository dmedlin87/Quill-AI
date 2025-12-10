import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { CommentCard } from '@/features/editor/components/CommentCard';
import type { CommentMarkAttributes } from '@/features/editor/extensions/CommentMark';

const baseComment: CommentMarkAttributes & { quote?: string } = {
  commentId: 'c-123',
  type: 'plot',
  issue: 'Continuity break',
  suggestion: 'Foreshadow the twist earlier',
  severity: 'warning',
  quote: 'But the prophecy said otherwise...',
};

const defaultPosition = { top: 200, left: 300 };

const renderCommentCard = (
  overrides: Partial<React.ComponentProps<typeof CommentCard>> = {},
) => {
  const props: React.ComponentProps<typeof CommentCard> = {
    comment: overrides.comment ?? baseComment,
    position: overrides.position ?? defaultPosition,
    onClose: overrides.onClose ?? vi.fn(),
    onFixWithAgent: overrides.onFixWithAgent ?? vi.fn(),
    onDismiss: overrides.onDismiss ?? vi.fn(),
  };

  const utils = render(<CommentCard {...props} />);
  return { ...props, ...utils };
};

describe('CommentCard (features/editor)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('invokes edit/delete style callbacks when buttons are used', () => {
    const onFixWithAgent = vi.fn();
    const onDismiss = vi.fn();

    renderCommentCard({ onFixWithAgent, onDismiss });

    fireEvent.click(screen.getByRole('button', { name: /fix with agent/i }));
    expect(onFixWithAgent).toHaveBeenCalledWith(
      baseComment.issue,
      baseComment.suggestion,
      baseComment.quote,
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(baseComment.commentId);
  });

  it('omits highlighted quote block when no quote is provided', () => {
    renderCommentCard({ comment: { ...baseComment, quote: undefined } });

    expect(screen.queryByText(/highlighted text/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(baseComment.issue, { exact: false }),
    ).toBeInTheDocument();
  });

  it('closes when clicking outside once the guard delay passes', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderCommentCard({ onClose });

    // Allow the delayed event listener to be registered.
    vi.advanceTimersByTime(150);
    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalled();
  });

  it('repositions above the selection when vertical space is limited', async () => {
    const rectMock = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 250,
        height: 320,
        top: 0,
        left: 0,
        bottom: 320,
        right: 250,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect);

    const innerHeightSpy = vi
      .spyOn(window, 'innerHeight', 'get')
      .mockReturnValue(400);

    const { container } = renderCommentCard({
      position: { top: 350, left: 40 },
    });

    const card = container.querySelector('div.fixed') as HTMLDivElement;
    const arrow = container.querySelector('div.absolute.w-3.h-3.rotate-45') as HTMLDivElement;

    await waitFor(() => {
      expect(card.style.top).toBe('-0px'); // 350 - 320 - 30 = 0 -> formatted as '-0px'
      expect(arrow.className).toContain('-bottom-1.5');
    });

    rectMock.mockRestore();
    innerHeightSpy.mockRestore();
  });
});
