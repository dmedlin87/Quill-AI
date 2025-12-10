import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock hooks
const mockSendMessage = vi.fn();
const mockSetMicrophoneState = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();

let mockOrchestratorState = {
  isProcessing: false,
  isReady: true,
  isVoiceMode: false,
};

vi.mock('@/features/agent', () => ({
  useAgentOrchestrator: () => ({
    sendMessage: mockSendMessage,
    ...mockOrchestratorState,
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

let onTranscriptCallback: (text: string, isFinal: boolean) => void;

vi.mock('@/features/voice/hooks/useSpeechIntent', () => ({
  useSpeechIntent: ({ onTranscript }: any) => {
    onTranscriptCallback = onTranscript;
    return {
      start: mockStart,
      stop: mockStop,
      ...mockSpeechState,
    };
  },
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
    mockOrchestratorState = {
      isProcessing: false,
      isReady: true,
      isVoiceMode: false,
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

  it('is disabled when agent not ready', () => {
    mockOrchestratorState.isReady = false;
    render(<VoiceCommandButton />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Agent initializing...',
    );
  });

  it('is disabled when agent is processing', () => {
    mockOrchestratorState.isProcessing = true;
    render(<VoiceCommandButton />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Agent is busy',
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
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
  });

  it('displays Voice Model badge when in voice mode', () => {
    mockOrchestratorState.isVoiceMode = true;
    render(<VoiceCommandButton />);
    expect(screen.getByText('Voice Model')).toBeInTheDocument();
  });

  it('updates microphone state on transcript updates', () => {
    render(<VoiceCommandButton />);

    act(() => {
      onTranscriptCallback('hello', false);
    });

    expect(mockSetMicrophoneState).toHaveBeenCalledWith(
      expect.objectContaining({ lastTranscript: 'hello', status: 'listening' })
    );
  });

  it('sends message on final transcript', () => {
    render(<VoiceCommandButton />);

    act(() => {
      onTranscriptCallback('hello world', true);
    });

    expect(mockSendMessage).toHaveBeenCalledWith('hello world');
    expect(mockSetMicrophoneState).toHaveBeenCalledWith(
      expect.objectContaining({ lastTranscript: 'hello world', status: 'idle' })
    );
  });
});
