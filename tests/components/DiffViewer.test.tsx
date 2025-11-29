import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiffViewer } from '@/features/editor/components/DiffViewer';

describe('DiffViewer', () => {
  it('renders diff content with added and removed text', () => {
    render(
      <DiffViewer
        oldText="old text"
        newText="new text"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        description="Edit description"
      />
    );

    expect(screen.getByText('Review Suggested Edit')).toBeInTheDocument();
    expect(screen.getByText('Edit description')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('calls callbacks when Accept/Reject buttons are clicked', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <DiffViewer
        oldText="before"
        newText="after"
        onAccept={onAccept}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByText('Accept Change'));
    expect(onAccept).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalled();
  });
});
