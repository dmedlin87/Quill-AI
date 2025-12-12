import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('extractRawTextFromDocxArrayBuffer', () => {
  const extractRawText = vi.fn();

  vi.mock('mammoth', () => ({
    default: { extractRawText },
  }));

  beforeEach(() => {
    extractRawText.mockReset();
  });

  it('normalizes newlines from mammoth output', async () => {
    extractRawText.mockResolvedValue({ value: 'line1\r\nline2\rline3' });
    const { extractRawTextFromDocxArrayBuffer } = await import('@/services/io/docxImporter');
    const result = await extractRawTextFromDocxArrayBuffer(new ArrayBuffer(0));
    expect(result).toBe('line1\nline2\nline3');
  });

  it('throws a normalized error when extraction fails', async () => {
    extractRawText.mockRejectedValue(new Error('boom'));
    const { extractRawTextFromDocxArrayBuffer } = await import('@/services/io/docxImporter');
    await expect(extractRawTextFromDocxArrayBuffer(new ArrayBuffer(0))).rejects.toThrow('Failed to extract text from .docx');
  });
});
