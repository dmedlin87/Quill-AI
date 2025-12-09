import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createMockChat,
  createMockGenerateContent,
  mockAi,
  resetGeminiMocks,
  chaosResponses,
  createRateLimitError,
  createContextLengthError,
  setupGeminiClientMock,
  mockAnalysisResult,
  mockLore,
  mockManuscriptIndex,
  createMockPersona,
} from '@/tests/mocks/geminiClient';

describe('geminiClient mocks', () => {
  afterEach(() => {
    resetGeminiMocks();
    vi.restoreAllMocks();
  });

  it('validates chat message payloads', async () => {
    const chat = createMockChat(chaosResponses.emptyText);
    await expect(chat.sendMessage({ message: 'hello' })).resolves.toEqual(chaosResponses.emptyText);
    await expect(chat.sendMessage({ message: ['hi'] })).resolves.toEqual(chaosResponses.emptyText);
    // @ts-expect-error invalid payload to exercise error branch
    await expect(chat.sendMessage({ notMessage: true })).rejects.toThrow('[MockChat] sendMessage called without a message payload');
  });

  it('rejects non-string/non-array message types', async () => {
    const chat = createMockChat(chaosResponses.emptyText);
    // @ts-expect-error invalid message type to exercise error branch
    await expect(chat.sendMessage({ message: 123 })).rejects.toThrow('must be a string or an array');
  });

  it('creates generateContent mocks with expected response', async () => {
    const fn = createMockGenerateContent(chaosResponses.malformedJson);
    expect(await fn({ model: 'x', contents: 'y' } as any)).toEqual(chaosResponses.malformedJson);
  });

  it('exposes reusable errors and clears spies', () => {
    const rateError = createRateLimitError();
    const contextError = createContextLengthError();

    expect(rateError.status).toBe(429);
    expect(contextError.status).toBe(413);

    // Explicitly call to verify reset works
    mockAi.models.generateContent({ model: 'x', contents: 'y' } as any);
    mockAi.chats.create({ model: 'a', config: {} } as any);

    expect(mockAi.models.generateContent).toHaveBeenCalled();
    expect(mockAi.chats.create).toHaveBeenCalled();

    resetGeminiMocks();

    // resetGeminiMocks calls vi.clearAllMocks() which clears call history
    expect(mockAi.models.generateContent).not.toHaveBeenCalled();
    expect(mockAi.chats.create).not.toHaveBeenCalled();
  });

  it('mocks the gemini client module', async () => {
    // Calling setupGeminiClientMock sets up the mock
    setupGeminiClientMock();

    // To trigger the mock factory, we need to import the module
    // We use dynamic import to ensure it happens after the mock is set up
    const { ai } = await import('@/services/gemini/client');

    expect(ai).toBe(mockAi);
  });

  it('exports data fixtures', () => {
      expect(mockAnalysisResult).toBeDefined();
      expect(mockLore).toBeDefined();
      expect(mockManuscriptIndex).toBeDefined();

      const persona = createMockPersona('1', 'Test', 'technical');
      expect(persona.id).toBe('1');
      expect(persona.name).toBe('Test');
      expect(persona.style).toBe('technical');
  });

  it('createMockChat uses default response if not provided', async () => {
      const chat = createMockChat();
      const res = await chat.sendMessage({ message: 'test' });
      expect(res.text).toBe('Mock chat response');
  });
});
