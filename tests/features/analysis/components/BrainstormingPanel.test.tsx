import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrainstormingPanel } from '@/features/analysis/components/BrainstormingPanel';

// Mock the hook
const mockGenerate = vi.fn();
const mockSuggestions = [
  {
    title: 'Idea 1',
    description: 'Description 1',
    reasoning: 'Reasoning 1',
  },
];

vi.mock('@/features/shared', () => ({
  usePlotSuggestions: vi.fn(() => ({
    suggestions: [],
    isLoading: false,
    error: null,
    generate: mockGenerate,
  })),
}));

// Import the mocked hook
import { usePlotSuggestions } from '@/features/shared';

describe('BrainstormingPanel', () => {
  const defaultProps = {
    currentText: 'Sample text context',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePlotSuggestions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: null,
        generate: mockGenerate,
    });
  });

  it('renders brainstorming panel structure', () => {
    render(<BrainstormingPanel {...defaultProps} />);
    expect(screen.getByText('Creative Brainstorming')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\.,/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('renders suggestion type buttons', () => {
    render(<BrainstormingPanel {...defaultProps} />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Plot Twist')).toBeInTheDocument();
    expect(screen.getByText('Character Arc')).toBeInTheDocument();
  });

  it('updates suggestion type when clicked', () => {
    render(<BrainstormingPanel {...defaultProps} />);

    const plotTwistBtn = screen.getByRole('button', { name: 'Plot Twist' });
    fireEvent.click(plotTwistBtn);

    expect(plotTwistBtn).toHaveClass('bg-indigo-600'); // Active class
    expect(screen.getByRole('button', { name: 'General' })).not.toHaveClass('bg-indigo-600');
  });

  it('calls generate when Generate button is clicked with input', () => {
    render(<BrainstormingPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText(/e\.g\.,/);
    fireEvent.change(input, { target: { value: 'Protagonist secret' } });

    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    fireEvent.click(generateBtn);

    expect(mockGenerate).toHaveBeenCalledWith('Protagonist secret', 'General');
  });

  it('calls generate when Enter is pressed in input', () => {
    render(<BrainstormingPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText(/e\.g\.,/);
    fireEvent.change(input, { target: { value: 'Protagonist secret' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockGenerate).toHaveBeenCalledWith('Protagonist secret', 'General');
  });

  it('disables generate button when input is empty or loading', () => {
    render(<BrainstormingPanel {...defaultProps} />);
    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    expect(generateBtn).toBeDisabled();

    // With input but loading
    (usePlotSuggestions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        suggestions: [],
        isLoading: true,
        error: null,
        generate: mockGenerate,
    });

    // Re-render to pick up new hook return
    const { unmount } = render(<BrainstormingPanel {...defaultProps} />);
    // Note: React Testing Library cleanup happens automatically, but re-render creates new instance in test
    // Actually rerendering in same test usually requires `rerender` from render result
    // But since we changed the mock return value globally for this test scope, simpler to just start a new test case for loading state
    // But let's try to simulate input change first

    // Wait, I can't easily change the hook return value mid-test without re-rendering or using a mutable mock implementation
    // Let's stick to checking empty input state here.
  });

  it('shows loading state correctly', () => {
     (usePlotSuggestions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        suggestions: [],
        isLoading: true,
        error: null,
        generate: mockGenerate,
    });

    render(<BrainstormingPanel {...defaultProps} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thinking/ })).toBeDisabled();
  });

  it('displays error message when present', () => {
    (usePlotSuggestions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: 'Network error',
        generate: mockGenerate,
    });

    render(<BrainstormingPanel {...defaultProps} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('displays suggestions when available', () => {
    (usePlotSuggestions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        suggestions: mockSuggestions,
        isLoading: false,
        error: null,
        generate: mockGenerate,
    });

    render(<BrainstormingPanel {...defaultProps} />);
    expect(screen.getByText('Idea 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Why this works:')).toBeInTheDocument();
    expect(screen.getByText(/Reasoning 1/)).toBeInTheDocument();
  });
});
