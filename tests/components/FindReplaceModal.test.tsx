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

  it('toggles case sensitivity', () => {
    const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="Hero and hero"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    const input = screen.getByPlaceholderText('Find...');
    fireEvent.change(input, { target: { value: 'Hero' } });

    // Initially not case sensitive, should find 2 matches
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Toggle case sensitivity
    fireEvent.click(screen.getByTitle('Case Sensitive'));

    // Should find 1 match
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('handles regex errors gracefully', () => {
    const { editor } = createMockEditor();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="Some text"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    const input = screen.getByPlaceholderText('Find...');
    // This is hard to trigger with the current implementation because it escapes special characters
    // But let's check if the escaping works as expected for regex chars
    fireEvent.change(input, { target: { value: '[(' } });

    // Should interpret as literal characters, not regex, so valid search for '[('
    // No console error should occur due to escaping
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('handles "Enter" key for next match and "Shift+Enter" for previous match', () => {
    const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="test test test"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    const input = screen.getByPlaceholderText('Find...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Enter -> Next
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/3')).toBeInTheDocument(); // Initially 1/3 (index 0), next -> index 1 (2/3)

    // Shift+Enter -> Prev
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('1/3')).toBeInTheDocument(); // Back to 1/3 (index 0)

    // Shift+Enter again -> Wrap to last
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('3/3')).toBeInTheDocument(); // Index 2
  });

  it('handles "Enter" in replace input to trigger replace', () => {
    const { editor, chainApi } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="test content"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Find...'), { target: { value: 'test' } });
    const replaceInput = screen.getByPlaceholderText('Replace...');
    fireEvent.change(replaceInput, { target: { value: 'fixed' } });

    fireEvent.keyDown(replaceInput, { key: 'Enter' });

    expect(chainApi.insertContent).toHaveBeenCalledWith('fixed');
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

  it('does nothing when next/prev/replace called with no matches', () => {
     const { editor, chainApi } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="Some text"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    // Find something that doesn't exist
    fireEvent.change(screen.getByPlaceholderText('Find...'), { target: { value: 'nonexistent' } });

    fireEvent.click(screen.getByTitle('Next Match (Enter)')); // Next
    fireEvent.click(screen.getByTitle('Previous Match (Shift+Enter)')); // Prev
    fireEvent.click(screen.getByText('Replace')); // Replace

    expect(editor.commands.setTextSelection).not.toHaveBeenCalled();
    expect(chainApi.insertContent).not.toHaveBeenCalled();
  });

  it('does nothing when Replace All called with empty find term', () => {
     const { editor } = createMockEditor();

    render(
      <FindReplaceModal
        isOpen
        onClose={vi.fn()}
        currentText="Some text"
        onTextChange={vi.fn()}
        editor={editor}
      />
    );

    fireEvent.click(screen.getByText('Replace All'));

    expect(editor.commands.setContent).not.toHaveBeenCalled();
  });
});
