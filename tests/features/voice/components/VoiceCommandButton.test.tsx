import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock hooks
const mockSendMessage = vi.fn();
const mockSetMicrophoneState = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();

vi.mock('@/features/agent', () => ({
  useAgentOrchestrator: () => ({
    sendMessage: mockSendMessage,
    isProcessing: false,
    isReady: true,
    isVoiceMode: false,
  }),
}));

vi.mock('@/features/core', () => ({
  useAppBrainActions: () => ({ setMicrophoneState: mockSetMicrophoneState }),
  useAppBrainState: () => ({
    ui: { microphone: { lastTranscript: '', status: 'idle', error: null } },
  }),
}));

let mockSpeechState = {
  isListening: false,
  supported: true,
  error: null as string | null,
  transcript: '',
};

vi.mock('@/features/voice/hooks/useSpeechIntent', () => ({
  useSpeechIntent: () => ({
    start: mockStart,
    stop: mockStop,
    ...mockSpeechState,
  }),
}));

import { VoiceCommandButton } from '@/features/voice/components/VoiceCommandButton';

describe('VoiceCommandButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechState = {
      isListening: false,
      supported: true,
      error: null,
      transcript: '',
    };
  });

  it('renders Voice label when not listening', () => {
    render(<VoiceCommandButton />);
    
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });

  it('renders Listening label when active', () => {
    mockSpeechState.isListening = true;
    render(<VoiceCommandButton />);
    
    expect(screen.getByText('Listening…')).toBeInTheDocument();
  });

  it('calls start when clicked while not listening', () => {
    render(<VoiceCommandButton />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(mockStart).toHaveBeenCalled();
    expect(mockSetMicrophoneState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'listening', mode: 'voice' }),
    );
  });

  it('calls stop when clicked while listening', () => {
    mockSpeechState.isListening = true;
    render(<VoiceCommandButton />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(mockStop).toHaveBeenCalled();
    expect(mockSetMicrophoneState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'idle', mode: 'voice' }),
    );
  });

  it('is disabled when speech not supported', () => {
    mockSpeechState.supported = false;
    render(<VoiceCommandButton />);
    
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Speech recognition not supported in this browser',
    );
  });

  it('shows error indicator when error present', () => {
    mockSpeechState.error = 'Mic error';
    render(<VoiceCommandButton />);
    
    expect(screen.getByText('•')).toBeInTheDocument();
  });

  it('shows transcript preview while listening', () => {
    mockSpeechState.isListening = true;
    mockSpeechState.transcript = 'Hello world';
    render(<VoiceCommandButton />);
    
    // Text is split across elements, so use a function matcher
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
  });
});
