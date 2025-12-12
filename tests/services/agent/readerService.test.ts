import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ReaderService.generateReactions', () => {
  const mockGenerateContent = vi.fn();
  const mockRandomUUID = vi.spyOn(crypto, 'randomUUID');

  vi.mock('@/services/gemini/client', () => ({
    ai: {
      models: {
        generateContent: mockGenerateContent,
      },
    },
  }));

  vi.mock('@/config/models', () => ({
    getActiveModels: () => ({ analysis: { id: 'analysis-model' } }),
  }));

  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockRandomUUID.mockReset();
    mockRandomUUID.mockReturnValue('uuid-1');
  });

  it('returns empty array for short text', async () => {
    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('too short', { systemPrompt: '', focus: [] } as any);
    expect(result).toEqual([]);
  });

  it('maps successful AI response to inline comments', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '[{"quote":"Hello","reaction":"Nice","sentiment":"positive"}]',
      },
    });
    mockRandomUUID.mockReturnValueOnce('uuid-success');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'uuid-success',
        quote: 'Hello',
        issue: 'Nice',
        severity: 'info',
      }),
    ]);
  });

  it('returns error InlineComment when JSON is malformed', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'not json',
      },
    });
    mockRandomUUID.mockReturnValue('uuid-json-error');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'uuid-json-error',
        severity: 'error',
      }),
    ]);
  });

  it('returns error InlineComment when JSON is not an array', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '{"quote":"one"}',
      },
    });
    mockRandomUUID.mockReturnValue('uuid-not-array');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'uuid-not-array',
        issue: 'AI response format was invalid.',
      }),
    ]);
  });

  it('returns error InlineComment when generation fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('AI offline'));
    mockRandomUUID.mockReturnValue('uuid-ai-error');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'uuid-ai-error',
        issue: 'An error occurred while generating reader reactions. Please try again later.',
      }),
    ]);
  });
});
