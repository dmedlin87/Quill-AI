import { describe, it, expect } from 'vitest';
import {
  toManuscriptExportChapters,
  toManuscriptPlainText,
  createManuscriptExportData,
} from '@/services/io/manuscriptExport';

const chapters = [
  { id: '2', title: 'Chapter 2', content: 'Second\r\nLine', order: 2 } as any,
  { id: '1', title: 'Chapter 1', content: 'First\rLine', order: 1 } as any,
];

describe('manuscript export helpers', () => {
  it('sorts and normalizes chapters', () => {
    const result = toManuscriptExportChapters(chapters);
    expect(result[0].title).toBe('Chapter 1');
    expect(result[0].content).toBe('First\nLine');
  });

  it('creates plain text with and without titles', () => {
    const withTitles = toManuscriptPlainText(chapters, { includeTitles: true });
    expect(withTitles).toContain('Chapter 1');

    const withoutTitles = toManuscriptPlainText(chapters, { includeTitles: false });
    expect(withoutTitles).not.toContain('Chapter 1');
  });

  it('inserts page breaks when requested', () => {
    const withPageBreaks = toManuscriptPlainText(chapters, { pageBreakBetweenChapters: true });
    expect(withPageBreaks).toContain('\n\n\f\n\n');
  });

  it('creates export data payload', () => {
    const data = createManuscriptExportData({
      title: 'My Book',
      author: 'Author',
      chapters,
      includeTitles: true,
      pageBreakBetweenChapters: false,
    });

    expect(data.title).toBe('My Book');
    expect(data.content).toContain('Chapter 1');
  });
});
