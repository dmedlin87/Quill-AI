import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceMode } from '@/features/voice/components/VoiceMode';

// Mock hook
const mockStartSession = vi.fn();
const mockStopSession = vi.fn();
const mockInputAnalyser = { current: { getByteFrequencyData: vi.fn(), frequencyBinCount: 128 } };
const mockOutputAnalyser = { current: { getByteFrequencyData: vi.fn(), frequencyBinCount: 128 } };

vi.mock('@/features/voice/hooks/useVoiceSession', () => ({
  useVoiceSession: () => ({
    isConnected: mockState.isConnected,
    isAiSpeaking: mockState.isAiSpeaking,
    error: mockState.error,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    inputAnalyserRef: mockInputAnalyser,
    outputAnalyserRef: mockOutputAnalyser,
  }),
}));

let mockState = {
  isConnected: false,
  isAiSpeaking: false,
  error: null as string | null,
};

describe('VoiceMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      isConnected: false,
      isAiSpeaking: false,
      error: null,
    };

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(0), 16) as any;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });

    // Mock HTMLCanvasElement
    const mockContext = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext as any);
  });

  it('renders start state correctly', () => {
    render(<VoiceMode />);

    expect(screen.getByText('Start Voice Session')).toBeInTheDocument();
    expect(screen.getByText('Start Conversation')).toBeInTheDocument();
  });

  it('calls startSession when clicked', () => {
    render(<VoiceMode />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockStartSession).toHaveBeenCalled();
  });

  it('renders connected state correctly', () => {
    mockState.isConnected = true;
    render(<VoiceMode />);

    expect(screen.getByText('Listening...')).toBeInTheDocument();
    expect(screen.getByText('End Session')).toBeInTheDocument();
  });

  it('calls stopSession when clicked while connected', () => {
    mockState.isConnected = true;
    render(<VoiceMode />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockStopSession).toHaveBeenCalled();
  });

  it('displays error message', () => {
    mockState.error = 'Something went wrong';
    render(<VoiceMode />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('indicates when AI is speaking', () => {
    mockState.isConnected = true;
    mockState.isAiSpeaking = true;
    render(<VoiceMode />);

    expect(screen.getByText('Gemini is speaking...')).toBeInTheDocument();
    expect(screen.getByText('Listen to the critique...')).toBeInTheDocument();
  });

  it('renders visualizer when connected', () => {
    mockState.isConnected = true;
    render(<VoiceMode />);

    // Check if canvas is present (by querying for the fallback icon being absent or canvas present)
    // The component renders a canvas when isConnected is true.
    // We can just verify that requestAnimationFrame was called which implies visualizer loop started
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });
});
