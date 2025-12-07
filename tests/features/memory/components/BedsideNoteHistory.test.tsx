import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BedsideNoteHistory } from '@/features/memory/components/BedsideNoteHistory';
import type { ChainedMemory } from '@/services/memory/chains';

const mockRenderDiff = vi.fn(() => [
  { value: 'unchanged', added: false, removed: false },
  { value: 'added text', added: true, removed: false },
]);

const baseHistory: ChainedMemory[] = [
  {
    memoryId: 'm1',
    version: 1,
    text: 'First version',
    timestamp: Date.now() - 10000,
    changeType: 'initial',
    changeReason: 'Created',
  },
  {
    memoryId: 'm2',
    version: 2,
    text: 'Second version',
    timestamp: Date.now(),
    changeType: 'update',
    changeReason: 'Updated',
  },
];

describe('BedsideNoteHistory', () => {
  it('shows empty message when history is empty', () => {
    render(
      <BedsideNoteHistory
        history={[]}
        pinnedId={null}
        onPin={vi.fn()}
        renderDiff={mockRenderDiff}
      />,
    );
    
    expect(screen.getByText('No bedside-note history yet.')).toBeInTheDocument();
  });

  it('renders each history entry with version', () => {
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId={null}
        onPin={vi.fn()}
        renderDiff={mockRenderDiff}
      />,
    );
    
    expect(screen.getByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  it('displays change reason and type badges', () => {
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId={null}
        onPin={vi.fn()}
        renderDiff={mockRenderDiff}
      />,
    );
    
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('initial')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();
  });

  it('calls onPin with memoryId when pin button clicked', () => {
    const onPin = vi.fn();
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId={null}
        onPin={onPin}
        renderDiff={mockRenderDiff}
      />,
    );
    
    const pinButtons = screen.getAllByRole('button', { name: /pin version/i });
    fireEvent.click(pinButtons[0]);
    
    expect(onPin).toHaveBeenCalledWith('m1');
  });

  it('calls onPin with null when unpinning', () => {
    const onPin = vi.fn();
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId="m1"
        onPin={onPin}
        renderDiff={mockRenderDiff}
      />,
    );
    
    const pinnedButton = screen.getByRole('button', { name: /unpin version 1/i });
    fireEvent.click(pinnedButton);
    
    expect(onPin).toHaveBeenCalledWith(null);
  });

  it('shows Pinned label for pinned entry', () => {
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId="m1"
        onPin={vi.fn()}
        renderDiff={mockRenderDiff}
      />,
    );
    
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('renders diff with added styling', () => {
    render(
      <BedsideNoteHistory
        history={baseHistory}
        pinnedId={null}
        onPin={vi.fn()}
        renderDiff={mockRenderDiff}
      />,
    );
    
    expect(screen.getAllByText(/added text/).length).toBeGreaterThan(0);
  });
});
