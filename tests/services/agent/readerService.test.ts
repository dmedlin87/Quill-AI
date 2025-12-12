import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

describe('ReaderService.generateReactions', () => {
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
    mockRandomUUID.mockReturnValue('00000000-0000-4000-8000-000000000001');
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
    mockRandomUUID.mockReturnValueOnce('00000000-0000-4000-8000-000000000002');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000002',
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
    mockRandomUUID.mockReturnValue('00000000-0000-4000-8000-000000000003');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000003',
        issue: 'Error parsing AI response. Please try again.',
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
    mockRandomUUID.mockReturnValue('00000000-0000-4000-8000-000000000004');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000004',
        issue: 'AI response format was invalid.',
      }),
    ]);
  });

  it('returns error InlineComment when generation fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('AI offline'));
    mockRandomUUID.mockReturnValue('00000000-0000-4000-8000-000000000005');

    const { ReaderService } = await import('@/services/agent/readerService');
    const service = new ReaderService();
    const result = await service.generateReactions('A'.repeat(60), {
      systemPrompt: 'prompt',
      focus: ['style'],
    } as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000005',
        issue: 'An error occurred while generating reader reactions. Please try again later.',
      }),
    ]);
  });
});
