import React, { useEffect, useMemo, useState } from 'react';
import { useAgentOrchestrator } from '@/features/agent';
import { useAppBrainActions, useAppBrainState } from '@/features/core';
import { useSpeechIntent } from '../hooks/useSpeechIntent';

export const VoiceCommandButton: React.FC = () => {
  const { sendMessage, isProcessing, isReady, isVoiceMode } = useAgentOrchestrator({ mode: 'voice' });
  const { setMicrophoneState } = useAppBrainActions();
  const appState = useAppBrainState();
  const [pendingTranscript, setPendingTranscript] = useState('');

  const speech = useSpeechIntent({
    mode: 'voice',
    onTranscript: (text, isFinal) => {
      setPendingTranscript(text);
      setMicrophoneState({ lastTranscript: text, status: 'listening', mode: 'voice', error: null });
      if (isFinal && text.trim()) {
        void sendMessage(text.trim());
        setMicrophoneState({ lastTranscript: text.trim(), status: 'idle', mode: 'voice' });
      }
    },
  });

  useEffect(() => {
    setMicrophoneState({
      status: speech.isListening ? 'listening' : 'idle',
      mode: 'voice',
      lastTranscript: speech.transcript || pendingTranscript || appState.ui.microphone.lastTranscript,
      error: speech.error,
    });
  }, [speech.isListening, speech.transcript, speech.error, pendingTranscript, setMicrophoneState, appState.ui.microphone.lastTranscript]);

  const disabledReason = useMemo(() => {
    if (!speech.supported) return 'Speech recognition not supported in this browser';
    if (!isReady) return 'Agent initializing...';
    if (isProcessing) return 'Agent is busy';
    return null;
  }, [speech.supported, isReady, isProcessing]);

  const toggleListening = () => {
    if (speech.isListening) {
      speech.stop();
      setMicrophoneState({ status: 'idle', mode: 'voice' });
    } else {
      speech.start();
      setMicrophoneState({ status: 'listening', mode: 'voice', error: null });
    }
  };

  const label = speech.isListening ? 'Listening…' : 'Voice';
  const showError = speech.error || appState.ui.microphone.error;
  const pillColor = speech.isListening ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' : 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={Boolean(disabledReason)}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${pillColor} disabled:opacity-60 disabled:cursor-not-allowed`}
      title={disabledReason ?? 'Capture a quick voice intent and route it through the agent'}
    >
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current animate-pulse" aria-hidden />
      <span>{label}</span>
      {showError && <span className="text-red-500">•</span>}
      {speech.transcript && speech.isListening && (
        <span className="text-xs text-slate-400 truncate max-w-[140px]" aria-live="polite">
          “{speech.transcript}”
        </span>
      )}
      {isVoiceMode && <span className="text-[10px] uppercase tracking-wide text-indigo-400">Voice Model</span>}
    </button>
  );
};
