import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExecutiveSummary } from '@/features/analysis/components/ExecutiveSummary';

const useTextToSpeechMock = vi.fn();

vi.mock('@/features/voice', () => ({
  useTextToSpeech: (...args: unknown[]) => useTextToSpeechMock(...args),
}));

describe('ExecutiveSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary text', () => {
    useTextToSpeechMock.mockReturnValue({
      isPlaying: false,
      play: vi.fn(),
      stop: vi.fn(),
    });

    render(<ExecutiveSummary summary="A concise executive summary." />);

    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('A concise executive summary.')).toBeInTheDocument();
  });

  it('calls play when not currently playing', () => {
    const play = vi.fn();
    const stop = vi.fn();

    useTextToSpeechMock.mockReturnValue({
      isPlaying: false,
      play,
      stop,
    });

    render(<ExecutiveSummary summary="Read this aloud." />);

    const button = screen.getByRole('button', { name: /read aloud/i });
    fireEvent.click(button);

    expect(play).toHaveBeenCalledWith('Read this aloud.');
    expect(stop).not.toHaveBeenCalled();
  });

  it('calls stop when already playing', () => {
    const play = vi.fn();
    const stop = vi.fn();

    useTextToSpeechMock.mockReturnValue({
      isPlaying: true,
      play,
      stop,
    });

    render(<ExecutiveSummary summary="Stop reading." />);

    const button = screen.getByRole('button', { name: /stop reading/i });
    fireEvent.click(button);

    expect(stop).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('shows empty-state copy and disables playback when summary is missing', () => {
    const play = vi.fn();
    const stop = vi.fn();

    useTextToSpeechMock.mockReturnValue({
      isPlaying: false,
      play,
      stop,
    });

    render(<ExecutiveSummary summary="   " />);

    expect(
      screen.getByText(/No summary available\./i),
    ).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /read aloud/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'No summary available');

    fireEvent.click(button);
    expect(play).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
