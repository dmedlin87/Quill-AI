import { Lore } from './schema';
import { AnalysisResult } from '@/types';

export enum ExportSection {
  Manuscript = 'manuscript',
  Characters = 'characters',
  WorldRules = 'world-rules',
  AnalysisReport = 'analysis-report',
  // StoryBible = 'story-bible',
  // QueryLetter = 'query-letter',
}

 export type ManuscriptPreset = 'standard_manuscript';

export interface ManuscriptExportOptions {
  includeChapterTitles: boolean;
  fontScale: number; // 1.0 = 12pt roughly
  lineHeight: number; // e.g. 1.5
  preset?: ManuscriptPreset;
}

export interface AnalysisExportOptions {
  includeCharts: boolean;
  detailedBreakdown: boolean;
}

export interface ExportConfig {
  sections: ExportSection[];
  manuscriptOptions: ManuscriptExportOptions;
  analysisOptions: AnalysisExportOptions;
  filename?: string;
}

export interface ExportData {
  title: string;
  author: string;
  content: string;
  lore: Lore;
  analysis?: AnalysisResult | null;
}
