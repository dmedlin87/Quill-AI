/**
 * Voice Feature
 * 
 * Voice interaction and audio processing
 */

// Components
export { VoiceMode } from './components/VoiceMode';
export { VoiceCommandButton } from './components/VoiceCommandButton';

// Hooks
export { useVoiceSession, type VolumeData, type UseVoiceSessionResult } from './hooks/useVoiceSession';
export { useAudioController } from './hooks/useAudioController';
export { useTextToSpeech } from './hooks/useTextToSpeech';
export { useSpeechIntent } from './hooks/useSpeechIntent';

// Services
export { 
  base64ToUint8Array, 
  arrayBufferToBase64, 
  decodeAudioData, 
  createBlob 
} from './services/audioUtils';
