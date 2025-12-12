import * as VoiceFeature from '@/features/voice';

describe('features/voice index', () => {
  it('exports voice components, hooks, and services', () => {
    expect(VoiceFeature.VoiceMode).toBeDefined();
    expect(VoiceFeature.VoiceCommandButton).toBeDefined();
    expect(VoiceFeature.useVoiceSession).toBeDefined();
    expect(VoiceFeature.useAudioController).toBeDefined();
    expect(VoiceFeature.useTextToSpeech).toBeDefined();
    expect(VoiceFeature.useSpeechIntent).toBeDefined();
    expect(VoiceFeature.base64ToUint8Array).toBeDefined();
    expect(VoiceFeature.arrayBufferToBase64).toBeDefined();
    expect(VoiceFeature.decodeAudioData).toBeDefined();
    expect(VoiceFeature.createBlob).toBeDefined();
  });
});
