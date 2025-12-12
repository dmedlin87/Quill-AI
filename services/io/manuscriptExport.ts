import type { Chapter } from '@/types/schema';
import type { ExportData } from '@/types/export';

export type ManuscriptExportChapter = {
  title: string;
  content: string;
};

const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, '\n');

export function toManuscriptExportChapters(chapters: Chapter[]): ManuscriptExportChapter[] {
  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => ({
      title: chapter.title,
      content: normalizeNewlines(chapter.content),
    }));
}

export function toManuscriptPlainText(
  chapters: Chapter[],
  options?: {
    includeTitles?: boolean;
    pageBreakBetweenChapters?: boolean;
  },
): string {
  const includeTitles = options?.includeTitles ?? true;
  const pageBreakBetweenChapters = options?.pageBreakBetweenChapters ?? false;

  const normalizedChapters = toManuscriptExportChapters(chapters);

  return normalizedChapters
    .map((chapter) => {
      if (!includeTitles) return chapter.content;
      return `${chapter.title}\n\n${chapter.content}`;
    })
    .join(pageBreakBetweenChapters ? '\n\n\f\n\n' : '\n\n');
}

export function createManuscriptExportData(params: {
  title: string;
  author: string;
  chapters: Chapter[];
  includeTitles?: boolean;
  pageBreakBetweenChapters?: boolean;
}): ExportData {
  return {
    title: params.title,
    author: params.author,
    content: toManuscriptPlainText(params.chapters, {
      includeTitles: params.includeTitles,
      pageBreakBetweenChapters: params.pageBreakBetweenChapters,
    }),
    lore: { characters: [], worldRules: [] },
    analysis: null,
  };
}
