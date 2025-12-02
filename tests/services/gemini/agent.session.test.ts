import { describe, it, expect, vi } from 'vitest';
import { createAgentSession } from '@/services/gemini/agent';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@/services/gemini/client', () => ({
  ai: {
    chats: { create: mockCreate },
  },
}));

vi.mock('@/config/models', () => ({ ModelConfig: { agent: 'gemini-1' } }));

vi.mock('@/services/gemini/prompts', () => ({
  REWRITE_SYSTEM_INSTRUCTION: '',
  CONTEXTUAL_HELP_SYSTEM_INSTRUCTION: '',
  AGENT_SYSTEM_INSTRUCTION: 'base',
}));

vi.mock('@/services/gemini/critiquePrompts', () => ({ getIntensityModifier: () => 'intensity' }));
vi.mock('@/services/gemini/experiencePrompts', () => ({
  getExperienceModifier: () => 'exp',
  getAutonomyModifier: () => 'auto',
}));

vi.mock('@/services/gemini/resilientParser', () => ({ safeParseJsonWithValidation: vi.fn(), validators: {} }));

vi.mock('@/types/personas', () => ({ buildPersonaInstruction: (inst: string) => `${inst}\n[persona]`, Persona: {} }));
vi.mock('@/types/critiqueSettings', () => ({ DEFAULT_CRITIQUE_INTENSITY: 'standard' }));
vi.mock('@/types/experienceSettings', () => ({ DEFAULT_EXPERIENCE: 'novice', DEFAULT_AUTONOMY: 'copilot', AutonomyMode: {}, ExperienceLevel: {} }));

vi.mock('@google/genai', () => ({ Type: { STRING: 'string' }, FunctionDeclaration: class {} }));

const mockPersona = { id: 'p1', name: 'Guide', role: 'helper' } as any;

describe('createAgentSession', () => {
  it('builds system prompt with provided context', () => {
    createAgentSession({
      persona: mockPersona,
      fullManuscriptContext: 'context',
      memoryContext: 'memory',
      autonomy: 'copilot' as any,
      experience: 'novice' as any,
      intensity: 'standard' as any,
    });

    expect(mockCreate).toHaveBeenCalled();
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('gemini-1');
    expect(call.config.systemInstruction).toContain('[persona]');
  });
});
