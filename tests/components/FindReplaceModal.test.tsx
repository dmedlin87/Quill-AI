import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FindReplaceModal } from '@/features/editor/components/FindReplaceModal';

const createMockEditor = () => {
  const chainApi = {
    focus: vi.fn().mockReturnThis(),
    setTextSelection: vi.fn().mockReturnThis(),
    insertContent: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };

  const editor: any = {
    commands: {
      setTextSelection: vi.fn(),
      scrollIntoView: vi.fn(),
      setContent: vi.fn(),
    } as any,
    chain: () => chainApi,
  };

  return { editor, chainApi };
};

describe('FindReplaceModal', () => {
  it('navigates between matches with next/prev buttons', () => {
    const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="Hero meets hero in the hero city"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    const input = screen.getByPlaceholderText('Find...');
    fireEvent.change(input, { target: { value: 'hero' } });

    const nextButton = screen.getByTitle('Next Match (Enter)');
    const prevButton = screen.getByTitle('Previous Match (Shift+Enter)');

    fireEvent.click(nextButton);
    fireEvent.click(prevButton);

    // We cannot rely on specific indices, but selection should be attempted
    expect((editor.commands as any).setTextSelection).toHaveBeenCalled();
  });

  it('replaces current match when Replace is clicked', () => {
    const { editor, chainApi } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="The hero arrived."
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Find...'), {
      target: { value: 'hero' },
    });

    fireEvent.change(screen.getByPlaceholderText('Replace...'), {
      target: { value: 'villain' },
    });

    fireEvent.click(screen.getByText('Replace'));

    expect(chainApi.focus).toHaveBeenCalled();
    expect(chainApi.setTextSelection).toHaveBeenCalled();
    expect(chainApi.insertContent).toHaveBeenCalledWith('villain');
  });

  it('replaces all matches when Replace All is clicked', () => {
    const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="hero and hero again"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Find...'), {
      target: { value: 'hero' },
    });

    fireEvent.change(screen.getByPlaceholderText('Replace...'), {
      target: { value: 'villain' },
    });

    fireEvent.click(screen.getByText('Replace All'));

    expect((editor.commands as any).setContent).toHaveBeenCalledWith(
      'villain and villain again',
    );
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={onClose}
        currentText="Some text"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    const input = screen.getByPlaceholderText('Find...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
