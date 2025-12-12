import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('services/io/docxExporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unmock('docx');
  });

  it('generates a docx blob and exercises title/author/chapter fallbacks', async () => {
    const TextRun = vi.fn(function (this: any, opts: any) {
      this.kind = 'TextRun';
      this.opts = opts;
    });
    const Paragraph = vi.fn(function (this: any, opts: any) {
      this.kind = 'Paragraph';
      this.opts = opts;
    });
    const Header = vi.fn(function (this: any, opts: any) {
      this.kind = 'Header';
      this.opts = opts;
    });
    const File = vi.fn(function (this: any, opts: any) {
      this.kind = 'File';
      this.opts = opts;
    });

    const Packer = {
      toBlob: vi.fn(async () => new Blob(['docx'])),
    };

    const mod = {
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File,
      Header,
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak: vi.fn(function (this: any) {
        this.kind = 'PageBreak';
      }),
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer,
      Paragraph,
      TextRun,
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    };

    vi.doMock('docx', () => mod);

    const { generateStandardManuscriptDocxBlob } = await import('@/services/io/docxExporter');

    const blob = await generateStandardManuscriptDocxBlob({
      title: '   ',
      author: '   ',
      chapters: [
        {
          title: '   ',
          content: 'First line\r\n\r\nSecond para\nwith\nextra\nlines',
        },
      ],
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(Packer.toBlob).toHaveBeenCalledTimes(1);

    // Title page fallbacks
    expect(TextRun).toHaveBeenCalledWith(expect.objectContaining({ text: 'Untitled' }));
    expect(TextRun).toHaveBeenCalledWith(expect.objectContaining({ text: 'by Author' }));

    // Chapter title fallback
    expect(TextRun).toHaveBeenCalledWith(expect.objectContaining({ text: 'Chapter 1' }));

    // Paragraph text should not include newlines after normalization
    const paragraphRuns = TextRun.mock.calls
      .map((call) => call[0])
      .filter((arg) => typeof arg?.text === 'string' && arg.text.includes('First line'));

    expect(paragraphRuns.length).toBeGreaterThan(0);
    expect(paragraphRuns[0].text).not.toContain('\n');
  });

  it('exports and uses default sanitized filename when none provided', async () => {
    const TextRun = vi.fn(function (this: any, opts: any) {
      this.kind = 'TextRun';
      this.opts = opts;
    });
    const Paragraph = vi.fn(function (this: any, opts: any) {
      this.kind = 'Paragraph';
      this.opts = opts;
    });
    const Header = vi.fn(function (this: any, opts: any) {
      this.kind = 'Header';
      this.opts = opts;
    });
    const File = vi.fn(function (this: any, opts: any) {
      this.kind = 'File';
      this.opts = opts;
    });

    const Packer = {
      toBlob: vi.fn(async () => new Blob(['docx'])),
    };

    vi.doMock('docx', () => ({
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File,
      Header,
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak: vi.fn(function (this: any) {
        this.kind = 'PageBreak';
      }),
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer,
      Paragraph,
      TextRun,
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    }));

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const realCreateElement = document.createElement.bind(document);
    const anchor = realCreateElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(anchor, 'remove').mockImplementation(() => {});

    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      if (tagName === 'a') return anchor;
      return realCreateElement(tagName);
    });

    const appendChild = vi.spyOn(document.body, 'appendChild');

    const { exportStandardManuscriptDocx } = await import('@/services/io/docxExporter');

    await exportStandardManuscriptDocx({
      title: '',
      author: 'Someone',
      chapters: [{ title: 'Ch', content: 'Hello' }],
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('quill-export_manuscript.docx');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    createElement.mockRestore();
  });

  it('exports and uses provided filename when supplied', async () => {
    vi.doMock('docx', () => ({
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File: vi.fn(function (this: any, opts: any) {
        this.kind = 'File';
        this.opts = opts;
      }),
      Header: vi.fn(function (this: any, opts: any) {
        this.kind = 'Header';
        this.opts = opts;
      }),
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak: vi.fn(function (this: any) {
        this.kind = 'PageBreak';
      }),
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer: { toBlob: vi.fn(async () => new Blob(['docx'])) },
      Paragraph: vi.fn(function (this: any, opts: any) {
        this.kind = 'Paragraph';
        this.opts = opts;
      }),
      TextRun: vi.fn(function (this: any, opts: any) {
        this.kind = 'TextRun';
        this.opts = opts;
      }),
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    }));

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const realCreateElement = document.createElement.bind(document);
    const anchor = realCreateElement('a');
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(anchor, 'remove').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      if (tagName === 'a') return anchor;
      return realCreateElement(tagName);
    });

    const { exportStandardManuscriptDocx } = await import('@/services/io/docxExporter');

    await exportStandardManuscriptDocx({
      title: 'My Book',
      author: 'Someone',
      chapters: [{ title: 'Ch', content: 'Hello' }],
      filename: 'custom.docx',
    });

    expect(anchor.download).toBe('custom.docx');
  });

  it('derives header title for short and long titles', async () => {
    const TextRun = vi.fn(function (this: any, opts: any) {
      this.kind = 'TextRun';
      this.opts = opts;
    });
    const Paragraph = vi.fn(function (this: any, opts: any) {
      this.kind = 'Paragraph';
      this.opts = opts;
    });
    const Header = vi.fn(function (this: any, opts: any) {
      this.kind = 'Header';
      this.opts = opts;
    });
    const File = vi.fn(function (this: any, opts: any) {
      this.kind = 'File';
      this.opts = opts;
    });

    vi.doMock('docx', () => ({
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File,
      Header,
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak: vi.fn(function (this: any) {
        this.kind = 'PageBreak';
      }),
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer: { toBlob: vi.fn(async () => new Blob(['docx'])) },
      Paragraph,
      TextRun,
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    }));

    const { generateStandardManuscriptDocxBlob } = await import('@/services/io/docxExporter');

    await generateStandardManuscriptDocxBlob({
      title: 'Short Title',
      author: 'First Last',
      chapters: [{ title: 'Ch', content: 'Hello' }],
    });

    expect(TextRun).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Last / Short Title / ',
      }),
    );

    TextRun.mockClear();

    const longTitle = 'A'.repeat(40);
    await generateStandardManuscriptDocxBlob({
      title: longTitle,
      author: 'First Last',
      chapters: [{ title: 'Ch', content: 'Hello' }],
    });

    expect(TextRun).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `Last / ${'A'.repeat(27)}... / `,
      }),
    );
  });

  it('sanitizes derived filename from title when filename is not provided', async () => {
    vi.doMock('docx', () => ({
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File: vi.fn(function (this: any, opts: any) {
        this.kind = 'File';
        this.opts = opts;
      }),
      Header: vi.fn(function (this: any, opts: any) {
        this.kind = 'Header';
        this.opts = opts;
      }),
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak: vi.fn(function (this: any) {
        this.kind = 'PageBreak';
      }),
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer: { toBlob: vi.fn(async () => new Blob(['docx'])) },
      Paragraph: vi.fn(function (this: any, opts: any) {
        this.kind = 'Paragraph';
        this.opts = opts;
      }),
      TextRun: vi.fn(function (this: any, opts: any) {
        this.kind = 'TextRun';
        this.opts = opts;
      }),
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    }));

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const realCreateElement = document.createElement.bind(document);
    const anchor = realCreateElement('a');
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(anchor, 'remove').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      if (tagName === 'a') return anchor;
      return realCreateElement(tagName);
    });

    const { exportStandardManuscriptDocx } = await import('@/services/io/docxExporter');

    await exportStandardManuscriptDocx({
      title: 'My Book!?',
      author: 'Someone',
      chapters: [{ title: 'Ch', content: 'Hello' }],
    });

    expect(anchor.download).toBe('my_book___manuscript.docx');
  });

  it('inserts a page break between chapters', async () => {
    const PageBreak = vi.fn(function (this: any) {
      this.kind = 'PageBreak';
    });

    vi.doMock('docx', () => ({
      AlignmentType: { RIGHT: 'RIGHT', CENTER: 'CENTER' },
      File: vi.fn(function (this: any, opts: any) {
        this.kind = 'File';
        this.opts = opts;
      }),
      Header: vi.fn(function (this: any, opts: any) {
        this.kind = 'Header';
        this.opts = opts;
      }),
      LineRuleType: { AUTO: 'AUTO' },
      PageBreak,
      PageNumber: { CURRENT: { kind: 'PageNumber.CURRENT' } },
      Packer: { toBlob: vi.fn(async () => new Blob(['docx'])) },
      Paragraph: vi.fn(function (this: any, opts: any) {
        this.kind = 'Paragraph';
        this.opts = opts;
      }),
      TextRun: vi.fn(function (this: any, opts: any) {
        this.kind = 'TextRun';
        this.opts = opts;
      }),
      convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
    }));

    const { generateStandardManuscriptDocxBlob } = await import('@/services/io/docxExporter');

    await generateStandardManuscriptDocxBlob({
      title: 'Book',
      author: 'First Last',
      chapters: [
        { title: 'Chapter One', content: 'Hello' },
        { title: 'Chapter Two', content: 'World' },
      ],
    });

    // One page break after title page, plus one between the two chapters
    expect(PageBreak).toHaveBeenCalledTimes(2);
  });
});
