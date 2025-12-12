type ManuscriptChapter = {
  title: string;
  content: string;
};

export interface StandardManuscriptDocxOptions {
  title: string;
  author: string;
  chapters: ManuscriptChapter[];
  filename?: string;
}

const sanitizeFileName = (value: string) => {
  if (!value) return 'quill-export';
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
};

const deriveHeaderTitle = (title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return 'Manuscript';
  if (trimmed.length <= 30) return trimmed;
  return `${trimmed.slice(0, 27).trim()}...`;
};

const deriveLastName = (author: string) => {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Author';
  return parts[parts.length - 1];
};

const splitIntoParagraphs = (text: string): string[] => {
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+\n/g, '\n').trim())
    .filter(Boolean);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export async function generateStandardManuscriptDocxBlob(options: StandardManuscriptDocxOptions): Promise<Blob> {
  const mod: any = await import('docx');
  const {
    AlignmentType,
    File,
    Header,
    LineRuleType,
    PageBreak,
    PageNumber,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
  } = mod;

  const headerTitle = deriveHeaderTitle(options.title);
  const lastName = deriveLastName(options.author);

  const runDefaults = {
    font: 'Courier New',
    size: 24,
  };

  const spacing = {
    before: 0,
    after: 0,
    line: 480,
    lineRule: LineRuleType.AUTO,
    beforeAutoSpacing: false,
    afterAutoSpacing: false,
  };

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ ...runDefaults, text: `${lastName} / ${headerTitle} / ` }), PageNumber.CURRENT],
      }),
    ],
  });

  const children: any[] = [];

  // Title page (kept minimal but compliant-ish: centered title + author)
  children.push(
    new Paragraph({
      children: [new TextRun({ ...runDefaults, text: '' })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing,
      children: [new TextRun({ ...runDefaults, text: options.title.trim() || 'Untitled' })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing,
      children: [new TextRun({ ...runDefaults, text: `by ${options.author.trim() || 'Author'}` })],
    }),
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Manuscript body
  options.chapters.forEach((chapter, chapterIndex) => {
    if (chapterIndex > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Chapter title centered
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing,
        children: [new TextRun({ ...runDefaults, text: chapter.title.trim() || `Chapter ${chapterIndex + 1}` })],
      }),
    );

    // Blank line after title
    children.push(new Paragraph({ spacing, children: [new TextRun({ ...runDefaults, text: '' })] }));

    const paragraphs = splitIntoParagraphs(chapter.content);
    paragraphs.forEach((p) => {
      children.push(
        new Paragraph({
          spacing,
          indent: { firstLine: convertInchesToTwip(0.5) },
          children: [new TextRun({ ...runDefaults, text: p.replace(/\n+/g, ' ') })],
        }),
      );
    });
  });

  const file = new File({
    creator: 'Quill AI',
    title: options.title,
    sections: [
      {
        headers: { default: header },
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              header: convertInchesToTwip(0.5),
              footer: convertInchesToTwip(0.5),
            },
            pageNumbers: { start: 1 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(file);
}

export async function exportStandardManuscriptDocx(options: StandardManuscriptDocxOptions): Promise<void> {
  const blob = await generateStandardManuscriptDocxBlob(options);
  const filename = options.filename ?? `${sanitizeFileName(options.title)}_manuscript.docx`;
  downloadBlob(blob, filename);
}
