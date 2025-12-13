import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateExport } from '@/features/export/utils/exportFormats';
import { pdfExportService } from '@/services/pdfExport';
import { exportStandardManuscriptDocx } from '@/services/io/docxExporter';
import { createManuscriptExportData, toManuscriptExportChapters } from '@/services/io/manuscriptExport';

// Mock services
vi.mock('@/services/pdfExport', () => ({
  pdfExportService: {
    generatePdf: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/io/docxExporter', () => ({
  exportStandardManuscriptDocx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/io/manuscriptExport', () => ({
  createManuscriptExportData: vi.fn((data) => ({ ...data, mocked: true })),
  toManuscriptExportChapters: vi.fn((chapters) => chapters.map((c: any) => ({ ...c, mocked: true }))),
}));

describe('generateExport', () => {
  const mockProject = {
    title: 'Test Novel',
    author: 'Test Author',
  };

  const mockChapters = [
    { id: '1', title: 'Chapter 1', content: '<p>Paragraph 1.</p><p>Paragraph 2.</p>' },
  ];

  let lastBlob: Blob | null = null;
  let lastAnchor: { href: string; download: string; click: () => void } | null = null;
  const mockLinkClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastBlob = null;
    lastAnchor = null;

    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: any) => {
      lastBlob = blob as Blob;
      return 'blob:url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      if (tagName === 'a') {
        lastAnchor = { href: '', download: '', click: mockLinkClick };
        return lastAnchor as any as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const readBlobText = async (blob: Blob): Promise<string> => {
    const maybeText = (blob as any).text;
    if (typeof maybeText === 'function') {
      return maybeText.call(blob);
    }

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(blob);
    });
  };

  it('generates TXT export with title/author and HTML normalization', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'txt',
      includeTitle: true,
      includeAuthor: true,
      includeChapterTitles: false,
    });

    expect(mockLinkClick).toHaveBeenCalledTimes(1);
    expect(lastAnchor?.download).toBe('test_novel.txt');
    expect(lastBlob).toBeInstanceOf(Blob);

    const content = await readBlobText(lastBlob!);
    expect(content).toContain('Test Novel');
    expect(content).toContain('by Test Author');
    expect(content).toMatch(/Paragraph 1\.\s+Paragraph 2\./);
  });

  it('generates Markdown export with chapter headings', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'md',
      includeTitle: false,
      includeAuthor: false,
      includeChapterTitles: true,
    });

    expect(lastAnchor?.download).toBe('test_novel.md');
    const content = await readBlobText(lastBlob!);
    expect(content).toContain('## Chapter 1');
  });

  it('uses provided filename verbatim when supplied', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'txt',
      filename: 'My Export Name',
      includeTitle: false,
      includeAuthor: false,
      includeChapterTitles: false,
    });

    expect(lastAnchor?.download).toBe('My Export Name.txt');
  });

  it('routes DOCX exports through exportStandardManuscriptDocx', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'docx',
      includeTitle: true,
      includeAuthor: true,
      includeChapterTitles: true,
    });

    expect(toManuscriptExportChapters).toHaveBeenCalledWith(mockChapters);
    expect(exportStandardManuscriptDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Novel',
        author: 'Test Author',
        filename: 'test_novel.docx',
      }),
    );
  });

  it('routes PDF exports through pdfExportService with expected config', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'pdf',
      includeTitle: true,
      includeAuthor: true,
      includeChapterTitles: false,
    });

    expect(createManuscriptExportData).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Novel',
        author: 'Test Author',
        includeTitles: false,
        pageBreakBetweenChapters: true,
      }),
    );

    expect(pdfExportService.generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ mocked: true }),
      expect.objectContaining({
        filename: 'test_novel.pdf',
        manuscriptOptions: expect.objectContaining({ includeChapterTitles: false }),
      }),
    );
  });

  it('throws for unsupported formats', async () => {
    await expect(
      generateExport(mockProject, mockChapters as any[], {
        format: 'rtf' as any,
        includeTitle: false,
        includeAuthor: false,
        includeChapterTitles: false,
      }),
    ).rejects.toThrow('Unsupported format');
  });
});
