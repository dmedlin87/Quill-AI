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

  const mockCreateObjectURL = vi.fn(() => 'blob:url');
  const mockRevokeObjectURL = vi.fn();
  const mockLinkClick = vi.fn();
  const mockAppendChild = vi.fn();
  const mockRemoveChild = vi.fn();

  // Capture blob content
  let capturedBlobContent: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedBlobContent = [];

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock Blob constructor correctly
    // We need to use 'function' not arrow function to support 'new'
    vi.spyOn(global, 'Blob').mockImplementation(function(content) {
      capturedBlobContent = content as string[];
      return { size: 0, type: '' } as Blob;
    } as any);

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          click: mockLinkClick,
          href: '',
          download: '',
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates TXT export with correct paragraph spacing', async () => {
    await generateExport(mockProject, mockChapters as any[], {
      format: 'txt',
      includeTitle: false,
      includeAuthor: false,
      includeChapterTitles: false,
    });

    const content = capturedBlobContent.join('');
    // This is expected to fail with the current implementation
    expect(content).toMatch(/Paragraph 1\.\s+Paragraph 2\./);
  });
});
