/**
 * Tests for geminiClient.ts mock utilities
 * Covers lines 40, 49-59, 86-88 for improved branch coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockGenerateContent,
  createMockChat,
  mockAi,
  mockUsageMetadata,
  resetGeminiMocks,
  chaosResponses,
  createRateLimitError,
  createContextLengthError,
  mockLore,
  mockManuscriptIndex,
  createMockPersona,
  mockAnalysisResult,
} from './geminiClient';

describe('geminiClient mocks', () => {
  beforeEach(() => {
    resetGeminiMocks();
  });

  describe('createMockGenerateContent', () => {
    it('should create a mock that resolves with the given response', async () => {
      const response = { text: 'Hello!', usageMetadata: mockUsageMetadata };
      const mockGenerate = createMockGenerateContent(response);

      const result = await mockGenerate();
      expect(result).toEqual(response);
    });

    it('should be a vi.fn mock', () => {
      const mockGenerate = createMockGenerateContent({ text: 'test' });
      expect(vi.isMockFunction(mockGenerate)).toBe(true);
    });

    it('should track calls', async () => {
      const mockGenerate = createMockGenerateContent({ text: 'test' });
      await mockGenerate({ model: 'gemini-pro', contents: 'hello' });

      expect(mockGenerate).toHaveBeenCalledWith({
        model: 'gemini-pro',
        contents: 'hello',
      });
    });
  });

  describe('createMockChat', () => {
    it('should create chat with default response', async () => {
      const chat = createMockChat();
      const result = await chat.sendMessage({ message: 'Hello' });

      expect(result.text).toBe('Mock chat response');
      expect(result.usageMetadata).toEqual(mockUsageMetadata);
    });

    it('should create chat with custom response', async () => {
      const customResponse = { text: 'Custom response!', usageMetadata: mockUsageMetadata };
      const chat = createMockChat(customResponse);
      const result = await chat.sendMessage({ message: 'Test' });

      expect(result).toEqual(customResponse);
    });

    it('should accept string message', async () => {
      const chat = createMockChat();
      const result = await chat.sendMessage({ message: 'String message' });

      expect(result.text).toBe('Mock chat response');
    });

    it('should accept array message', async () => {
      const chat = createMockChat();
      const result = await chat.sendMessage({ message: ['part1', 'part2'] });

      expect(result.text).toBe('Mock chat response');
    });

    it('should throw error when called without payload', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)(undefined)
      ).rejects.toThrow('[MockChat] sendMessage called without a message payload');
    });

    it('should throw error when called with null payload', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)(null)
      ).rejects.toThrow('[MockChat] sendMessage called without a message payload');
    });

    it('should throw error when payload is not an object', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)('not an object')
      ).rejects.toThrow('[MockChat] sendMessage called without a message payload');
    });

    it('should throw error when payload has no message property', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)({ notMessage: 'test' })
      ).rejects.toThrow('[MockChat] sendMessage called without a message payload');
    });

    it('should throw error when message is not string or array', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)({ message: 12345 })
      ).rejects.toThrow('[MockChat] sendMessage.message must be a string or an array');
    });

    it('should throw error when message is an object', async () => {
      const chat = createMockChat();

      await expect(
        (chat.sendMessage as any)({ message: { nested: 'object' } })
      ).rejects.toThrow('[MockChat] sendMessage.message must be a string or an array');
    });
  });

  describe('mockAi', () => {
    it('should have models.generateContent mock', () => {
      expect(vi.isMockFunction(mockAi.models.generateContent)).toBe(true);
    });

    it('should have chats.create mock', () => {
      expect(vi.isMockFunction(mockAi.chats.create)).toBe(true);
    });

    it('should return a chat from chats.create', () => {
      const chat = mockAi.chats.create({ model: 'gemini-pro', config: {} });
      expect(chat).toBeDefined();
      expect(chat.sendMessage).toBeDefined();
    });
  });

  describe('resetGeminiMocks', () => {
    it('should clear mockAi.models.generateContent', () => {
      mockAi.models.generateContent({ model: 'test', contents: 'test' });
      expect(mockAi.models.generateContent).toHaveBeenCalled();

      resetGeminiMocks();
      expect(mockAi.models.generateContent).not.toHaveBeenCalled();
    });

    it('should clear mockAi.chats.create', () => {
      mockAi.chats.create({ model: 'test', config: {} });
      expect(mockAi.chats.create).toHaveBeenCalled();

      resetGeminiMocks();
      expect(mockAi.chats.create).not.toHaveBeenCalled();
    });
  });

  describe('chaosResponses', () => {
    it('should have emptyText response', () => {
      expect(chaosResponses.emptyText.text).toBe('');
      expect(chaosResponses.emptyText.usageMetadata).toEqual(mockUsageMetadata);
    });

    it('should have malformedJson response', () => {
      expect(chaosResponses.malformedJson.text).toBe('not json');
    });
  });

  describe('createRateLimitError', () => {
    it('should create error with default message', () => {
      const error = createRateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.status).toBe(429);
    });

    it('should create error with custom message', () => {
      const error = createRateLimitError('Custom rate limit');
      expect(error.message).toBe('Custom rate limit');
      expect(error.status).toBe(429);
    });
  });

  describe('createContextLengthError', () => {
    it('should create error with default message', () => {
      const error = createContextLengthError();
      expect(error.message).toBe('Context length exceeded');
      expect(error.status).toBe(413);
    });

    it('should create error with custom message', () => {
      const error = createContextLengthError('Custom context error');
      expect(error.message).toBe('Custom context error');
      expect(error.status).toBe(413);
    });
  });

  describe('mockLore', () => {
    it('should have characters array', () => {
      expect(Array.isArray(mockLore.characters)).toBe(true);
      expect(mockLore.characters.length).toBeGreaterThan(0);
    });

    it('should have worldRules array', () => {
      expect(Array.isArray(mockLore.worldRules)).toBe(true);
      expect(mockLore.worldRules.length).toBeGreaterThan(0);
    });

    it('should have properly structured character', () => {
      const character = mockLore.characters[0];
      expect(character.name).toBe('John Doe');
      expect(character.bio).toBeDefined();
    });
  });

  describe('mockManuscriptIndex', () => {
    it('should have characters object', () => {
      expect(mockManuscriptIndex.characters).toBeDefined();
      expect(mockManuscriptIndex.characters['John Doe']).toBeDefined();
    });

    it('should have lastUpdated timestamps', () => {
      expect(mockManuscriptIndex.lastUpdated).toBeDefined();
      expect(typeof mockManuscriptIndex.lastUpdated['1']).toBe('number');
    });

    it('should have properly structured character entry', () => {
      const johnDoe = mockManuscriptIndex.characters['John Doe'];
      expect(johnDoe.name).toBe('John Doe');
      expect(johnDoe.firstMention).toBeDefined();
      expect(johnDoe.mentions).toBeDefined();
      expect(johnDoe.attributes).toBeDefined();
    });
  });

  describe('createMockPersona', () => {
    it('should create persona with provided values', () => {
      const persona = createMockPersona('test-id', 'Test Persona', 'direct');

      expect(persona.id).toBe('test-id');
      expect(persona.name).toBe('Test Persona');
      expect(persona.style).toBe('direct');
    });

    it('should generate role based on name', () => {
      const persona = createMockPersona('id', 'MyPersona', 'creative');
      expect(persona.role).toBe('MyPersona role');
    });

    it('should generate systemPrompt including name and style', () => {
      const persona = createMockPersona('id', 'Assistant', 'socratic');
      expect(persona.systemPrompt).toContain('Assistant');
      expect(persona.systemPrompt).toContain('socratic');
    });

    it('should include default icon and color', () => {
      const persona = createMockPersona('id', 'Test', 'direct');
      expect(persona.icon).toBe('⭐');
      expect(persona.color).toBe('#6366f1');
    });
  });

  describe('mockAnalysisResult', () => {
    it('should have summary', () => {
      expect(mockAnalysisResult.summary).toBeDefined();
    });

    it('should have strengths and weaknesses', () => {
      expect(Array.isArray(mockAnalysisResult.strengths)).toBe(true);
      expect(Array.isArray(mockAnalysisResult.weaknesses)).toBe(true);
    });

    it('should have pacing analysis', () => {
      expect(mockAnalysisResult.pacing).toBeDefined();
      expect(mockAnalysisResult.pacing.score).toBeDefined();
    });

    it('should have characters array', () => {
      expect(Array.isArray(mockAnalysisResult.characters)).toBe(true);
      expect(mockAnalysisResult.characters.length).toBeGreaterThan(0);
    });

    it('should have properly structured character', () => {
      const character = mockAnalysisResult.characters[0];
      expect(character.name).toBeDefined();
      expect(character.bio).toBeDefined();
      expect(character.arc).toBeDefined();
      expect(character.arcStages).toBeDefined();
      expect(character.relationships).toBeDefined();
    });
  });
});
