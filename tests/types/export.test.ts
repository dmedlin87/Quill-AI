import { describe, it, expect } from 'vitest';
import {
  ExportSection,
  type ManuscriptExportOptions,
  type AnalysisExportOptions,
  type ExportConfig,
  type ExportData,
} from '@/types/export';

describe('export types', () => {
  describe('ExportSection enum', () => {
    it('has Manuscript section', () => {
      expect(ExportSection.Manuscript).toBe('manuscript');
    });

    it('has Characters section', () => {
      expect(ExportSection.Characters).toBe('characters');
    });

    it('has WorldRules section', () => {
      expect(ExportSection.WorldRules).toBe('world-rules');
    });

    it('has AnalysisReport section', () => {
      expect(ExportSection.AnalysisReport).toBe('analysis-report');
    });
  });

  describe('ManuscriptExportOptions interface', () => {
    it('accepts valid options', () => {
      const options: ManuscriptExportOptions = {
        includeChapterTitles: true,
        fontScale: 1.0,
        lineHeight: 1.5,
      };

      expect(options.includeChapterTitles).toBe(true);
      expect(options.fontScale).toBe(1.0);
      expect(options.lineHeight).toBe(1.5);
    });
  });

  describe('AnalysisExportOptions interface', () => {
    it('accepts valid options', () => {
      const options: AnalysisExportOptions = {
        includeCharts: true,
        detailedBreakdown: false,
      };

      expect(options.includeCharts).toBe(true);
      expect(options.detailedBreakdown).toBe(false);
    });
  });

  describe('ExportConfig interface', () => {
    it('accepts valid config', () => {
      const config: ExportConfig = {
        sections: [ExportSection.Manuscript, ExportSection.Characters],
        manuscriptOptions: {
          includeChapterTitles: true,
          fontScale: 1.2,
          lineHeight: 1.6,
        },
        analysisOptions: {
          includeCharts: false,
          detailedBreakdown: true,
        },
        filename: 'my-export',
      };

      expect(config.sections).toHaveLength(2);
      expect(config.filename).toBe('my-export');
    });

    it('filename is optional', () => {
      const config: ExportConfig = {
        sections: [],
        manuscriptOptions: {
          includeChapterTitles: false,
          fontScale: 1,
          lineHeight: 1,
        },
        analysisOptions: {
          includeCharts: false,
          detailedBreakdown: false,
        },
      };

      expect(config.filename).toBeUndefined();
    });
  });

  describe('ExportData interface', () => {
    it('accepts valid export data', () => {
      const data: ExportData = {
        title: 'My Novel',
        author: 'Author Name',
        content: 'Chapter content here...',
        lore: {
          characters: [],
          worldRules: [],
        },
        analysis: null,
      };

      expect(data.title).toBe('My Novel');
      expect(data.author).toBe('Author Name');
      expect(data.lore.characters).toEqual([]);
    });
  });
});
