import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutiveSummary } from '@/features/analysis/components/ExecutiveSummary';

// Mock the useTextToSpeech hook
const mockPlay = vi.fn();
const mockStop = vi.fn();

vi.mock('@/features/voice', () => ({
  useTextToSpeech: vi.fn(() => ({
    isPlaying: false,
    play: mockPlay,
    stop: mockStop,
  })),
}));

// Import the mocked hook to change its implementation per test if needed
import { useTextToSpeech } from '@/features/voice';

describe('ExecutiveSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTextToSpeech as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isPlaying: false,
      play: mockPlay,
      stop: mockStop,
    });
  });

  it('renders the summary text provided', () => {
    render(<ExecutiveSummary summary="This is a test summary." />);
    expect(screen.getByText('This is a test summary.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /executive summary/i })).toBeInTheDocument();
  });

  it('renders fallback text when summary is empty', () => {
    render(<ExecutiveSummary summary="" />);
    expect(screen.getByText('No summary available.')).toBeInTheDocument();
  });

  it('renders fallback text when summary is whitespace', () => {
    render(<ExecutiveSummary summary="   " />);
    expect(screen.getByText('No summary available.')).toBeInTheDocument();
  });

  it('calls play when read aloud button is clicked and not playing', () => {
    render(<ExecutiveSummary summary="Read me." />);
    const button = screen.getByRole('button', { name: /read aloud/i });

    fireEvent.click(button);
    expect(mockPlay).toHaveBeenCalledWith('Read me.');
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('calls stop when button is clicked and is playing', () => {
    (useTextToSpeech as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isPlaying: true,
      play: mockPlay,
      stop: mockStop,
    });

    render(<ExecutiveSummary summary="Read me." />);
    const button = screen.getByRole('button', { name: /stop reading/i });

    fireEvent.click(button);
    expect(mockStop).toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('disables the button when no summary is available', () => {
    render(<ExecutiveSummary summary="" />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50 cursor-not-allowed');
  });

  it('shows correct aria-label and pressed state', () => {
    const { rerender } = render(<ExecutiveSummary summary="Content" />);
    let button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Read aloud');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // Re-render with playing state
    (useTextToSpeech as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isPlaying: true,
      play: mockPlay,
      stop: mockStop,
    });

    // Force re-render by unmounting/remounting or just rerendering
    // Note: in a real app, the hook update would trigger re-render. Here we simulate it.
    rerender(<ExecutiveSummary summary="Content" />);

    button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Stop reading');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
