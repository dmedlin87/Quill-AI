import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('extractRawTextFromDocxArrayBuffer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unmock('mammoth');
  });

  it('normalizes newlines and supports default export shape', async () => {
    const extractRawText = vi.fn(async () => ({ value: 'a\r\nb\rc\n\n' }));

    vi.doMock('mammoth', () => ({
      default: {
        extractRawText,
      },
    }));

    const { extractRawTextFromDocxArrayBuffer } = await import('@/services/io/docxImporter');

    const result = await extractRawTextFromDocxArrayBuffer(new ArrayBuffer(1));

    expect(extractRawText).toHaveBeenCalledTimes(1);
    expect(result).toBe('a\nb\nc\n\n');
  });

  it('handles non-default export shape and missing result value', async () => {
    const extractRawText = vi.fn(async () => ({}));

    vi.doMock('mammoth', () => ({
      extractRawText,
    }));

    const { extractRawTextFromDocxArrayBuffer } = await import('@/services/io/docxImporter');

    const result = await extractRawTextFromDocxArrayBuffer(new ArrayBuffer(1));

    expect(extractRawText).toHaveBeenCalledTimes(1);
    expect(result).toBe('');
  });

  it('logs and throws a stable error on failure', async () => {
    const failure = new Error('boom');
    const extractRawText = vi.fn(async () => {
      throw failure;
    });

    vi.doMock('mammoth', () => ({
      default: {
        extractRawText,
      },
    }));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { extractRawTextFromDocxArrayBuffer } = await import('@/services/io/docxImporter');

    await expect(extractRawTextFromDocxArrayBuffer(new ArrayBuffer(1))).rejects.toThrow('Failed to extract text from .docx');

    expect(consoleError).toHaveBeenCalledWith('[docxImporter] Failed to extract text from .docx', failure);
  });
});
