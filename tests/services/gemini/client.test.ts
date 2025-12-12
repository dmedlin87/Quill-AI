/**
 * Tests for Gemini API client initialization
 * Covers client creation, API configuration checks, and validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// -----------------------------------------------------------------------------
// MOCK SETUP
// -----------------------------------------------------------------------------

const mockGetApiKey = vi.hoisted(() => vi.fn(() => 'test-api-key-12345'));
const mockValidateApiKey = vi.hoisted(() => vi.fn(() => null));
const mockGetActiveApiKey = vi.hoisted(() => vi.fn(() => 'test-api-key-12345'));
const mockMarkFreeQuotaExhausted = vi.hoisted(() => vi.fn());
const mockIsUsingPaidKey = vi.hoisted(() => vi.fn(() => false));

const mockGetActiveModelBuild = vi.hoisted(() => vi.fn(() => 'normal'));

const mockEventBusEmit = vi.hoisted(() => vi.fn());

// Mock GoogleGenAI instance methods
const mockGenerateContent = vi.fn();
const mockGoogleGenAIInstance = {
  models: {
    generateContent: mockGenerateContent,
  },
  chats: { create: vi.fn() },
};

const mockGoogleGenAI = vi.hoisted(() => vi.fn().mockImplementation(() => mockGoogleGenAIInstance));

// Mock dependencies
vi.mock('@/config/api', () => ({
  getApiKey: mockGetApiKey,
  getActiveApiKey: mockGetActiveApiKey,
  validateApiKey: mockValidateApiKey,
  markFreeQuotaExhausted: mockMarkFreeQuotaExhausted,
  isUsingPaidKey: mockIsUsingPaidKey,
}));

vi.mock('@/config/models', () => ({
  getActiveModelBuild: mockGetActiveModelBuild,
  ModelBuilds: {
    free: { analysis: { id: 'gemini-pro' } },
    cheap: { analysis: { id: 'gemini-flash' } },
  },
  ModelBuildKey: 'normal',
}));

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    emit: mockEventBusEmit,
  },
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

describe('Gemini Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKey.mockReturnValue('test-api-key-12345');
    mockGetActiveApiKey.mockReturnValue('test-api-key-12345');
    mockValidateApiKey.mockReturnValue(null);
    mockIsUsingPaidKey.mockReturnValue(false);
    mockGetActiveModelBuild.mockReturnValue('normal');
    
    // Default successful response
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'Success' } });
  });

  describe('Configuration & Initialization', () => {
    it('isApiConfigured returns true when API key is valid', async () => {
      vi.resetModules();
      const { isApiConfigured } = await import('@/services/gemini/client');
      expect(isApiConfigured()).toBe(true);
    });

    it('getApiStatus returns configured status when valid', async () => {
      vi.resetModules();
      const { getApiStatus } = await import('@/services/gemini/client');
      const status = getApiStatus();
      expect(status.configured).toBe(true);
      expect(status.error).toBeUndefined();
    });

    it('exports ai client instance', async () => {
      vi.resetModules();
      const { ai } = await import('@/services/gemini/client');
      expect(ai).toBeDefined();
    });

    it('recreates client when API key changes', async () => {
      vi.resetModules();
      const clientModule = await import('@/services/gemini/client');
      
      // First call
      clientModule.getAiClient();
      expect(mockGoogleGenAI).toHaveBeenCalledTimes(2); // Initial load (failed new + call)

      // Change key
      mockGetActiveApiKey.mockReturnValue('new-api-key');
      
      // Second call should trigger rebuild
      clientModule.getAiClient();
      expect(mockGoogleGenAI).toHaveBeenCalledTimes(4);
      expect(mockGoogleGenAI).toHaveBeenLastCalledWith({ apiKey: 'new-api-key' });
    });
  });

  describe('Invalid Configuration', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('reports invalid configuration via status API when API key is missing', async () => {
      mockGetActiveApiKey.mockReturnValue('');
      mockValidateApiKey.mockReturnValue('API key is required');

      const { isApiConfigured, getApiStatus } = await import('@/services/gemini/client');

      expect(isApiConfigured()).toBe(false);
      const status = getApiStatus();
      expect(status.configured).toBe(false);
      expect(status.error).toContain('API key is required');
    });

    it('logs warning to console when validation fails on init', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockGetApiKey.mockReturnValue('bad-key');
      mockValidateApiKey.mockReturnValue('Invalid format');

      await import('@/services/gemini/client');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain('[Quill AI API]');
      consoleSpy.mockRestore();
    });
    
    it('creates a proxy that throws on access if key is invalid', async () => {
      mockGetActiveApiKey.mockReturnValue('bad-key');
      mockValidateApiKey.mockReturnValue('Invalid format');
      
      const { getAiClient } = await import('@/services/gemini/client');
      
      // Force a key check
      mockGetActiveApiKey.mockReturnValue('bad-key-2'); 
      const client = getAiClient();
      
      // Accessing any property should throw
      expect(() => client.models).toThrow('[Quill AI API]');
    });
  });

  describe('Smart Generate Content (The "ai" Proxy)', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('proxies normal requests successfully', async () => {
      const { ai } = await import('@/services/gemini/client');
      const result = await ai.models.generateContent({ contents: [] });
      
      expect(mockGenerateContent).toHaveBeenCalled();
      expect((result as any).response.text()).toBe('Success');
    });

    it('handles string requests by wrapping them', async () => {
      const { ai } = await import('@/services/gemini/client');
      await ai.models.generateContent('Hello world');
      
      expect(mockGenerateContent).toHaveBeenCalledWith('Hello world');
    });

    it('passes through other properties (e.g., chats)', async () => {
      const { ai } = await import('@/services/gemini/client');
      expect(ai.chats).toBeDefined();
      expect(ai.chats.create).toBeDefined();
    });

    describe('Quota Exhaustion Handling', () => {
      it('rethrows non-quota errors', async () => {
        const { ai } = await import('@/services/gemini/client');
        mockGenerateContent.mockRejectedValue(new Error('Random Error'));
        
        await expect(ai.models.generateContent('test')).rejects.toThrow('Random Error');
      });

      describe('Normal/Cheap Mode (Paid Key Switch)', () => {
        beforeEach(() => {
          mockGetActiveModelBuild.mockReturnValue('normal');
        });

        it('switches to paid key on 429 error if not already using paid key', async () => {
          const { ai } = await import('@/services/gemini/client');
          
          // First call fails with 429
          mockGenerateContent.mockRejectedValueOnce({ status: 429 });
          // Second call (retry) succeeds
          mockGenerateContent.mockResolvedValueOnce({ response: { text: () => 'Recovered' } });

          const result = await ai.models.generateContent('test');

          expect(mockMarkFreeQuotaExhausted).toHaveBeenCalled();
          // Should have called generateContent twice
          expect(mockGenerateContent).toHaveBeenCalledTimes(2);
          expect((result as any).response.text()).toBe('Recovered');
        });

        it('rethrows 429 if already using paid key', async () => {
          mockIsUsingPaidKey.mockReturnValue(true);
          const { ai } = await import('@/services/gemini/client');
          
          mockGenerateContent.mockRejectedValue({ status: 429 });

          await expect(ai.models.generateContent('test')).rejects.toEqual({ status: 429 });
          expect(mockMarkFreeQuotaExhausted).not.toHaveBeenCalled();
        });

        it('rethrows if retry also fails', async () => {
            const { ai } = await import('@/services/gemini/client');
            
            mockGenerateContent.mockRejectedValue({ status: 429 });
            
            await expect(ai.models.generateContent('test')).rejects.toEqual({ status: 429 });
        });
      });

      // NOTE: "Free Mode (Model Fallback)" tests were removed because the feature
      // (automatic Pro → Flash model switching on quota exhaustion) was never 
      // implemented in client.ts. The current implementation only supports 
      // key switching (free key → paid key), not model switching.
    });
  });
});
