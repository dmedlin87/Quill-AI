import { Chapter } from '@/types/schema';
import { ExportSection, type ExportConfig } from '@/types/export';
import { pdfExportService } from '@/services/pdfExport';
import { exportStandardManuscriptDocx } from '@/services/io/docxExporter';
import { createManuscriptExportData, toManuscriptExportChapters } from '@/services/io/manuscriptExport';

interface ExportOptions {
  includeTitle?: boolean;
  includeAuthor?: boolean;
  includeChapterTitles?: boolean;
  format: 'txt' | 'md' | 'docx' | 'pdf';
  filename?: string;
}

const downloadFile = (content: Blob | string, filename: string, mimeType: string) => {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateExport = async (
  project: { title: string; author: string },
  chapters: Chapter[],
  options: ExportOptions
): Promise<void> => {
  const { title, author } = project;
  const safeFilename = options.filename || title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  switch (options.format) {
    case 'txt':
    case 'md': {
      let content = '';
      if (options.includeTitle) content += `${title}\n`;
      if (options.includeAuthor) content += `by ${author}\n\n`;

      chapters.forEach(chapter => {
        if (options.includeChapterTitles) {
          content += options.format === 'md' ? `## ${chapter.title}\n\n` : `${chapter.title}\n\n`;
        }

        // Convert HTML to text with structure preservation
        let textContent = chapter.content
          // Replace block endings with double newlines
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          // Replace breaks with single newline
          .replace(/<br\s*\/?>/gi, '\n')
          // Strip all other tags
          .replace(/<[^>]*>/g, '')
          // Decode common entities (basic handling)
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');

        // Trim extra whitespace but keep structure
        textContent = textContent.trim();

        content += `${textContent}\n\n`;
      });

      const extension = options.format;
      const mimeType = options.format === 'md' ? 'text/markdown' : 'text/plain';
      downloadFile(content, `${safeFilename}.${extension}`, mimeType);
      break;
    }

    case 'docx': {
      await exportStandardManuscriptDocx({
        title,
        author,
        chapters: toManuscriptExportChapters(chapters),
        filename: `${safeFilename}.docx`
      });
      break;
    }

    case 'pdf': {
      const data = createManuscriptExportData({
        title,
        author,
        chapters,
        includeTitles: options.includeChapterTitles,
        pageBreakBetweenChapters: true,
      });

      const config: ExportConfig = {
        sections: [ExportSection.Manuscript],
        manuscriptOptions: {
            includeChapterTitles: options.includeChapterTitles ?? true,
            fontScale: 1,
            lineHeight: 2, // Standard manuscript double spacing
            preset: 'standard_manuscript',
        },
        analysisOptions: { includeCharts: false, detailedBreakdown: false },
        filename: `${safeFilename}.pdf`
      };

      await pdfExportService.generatePdf(data, config);
      break;
    }

    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
};
