import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePDF } from '@/services/pdfExport';
import type { AnalysisResult } from '@/types';

// Mock jspdf so no real files are created
const saveMock = vi.fn();
const textMock = vi.fn();
const addPageMock = vi.fn();
const lineMock = vi.fn();
const rectMock = vi.fn();
const splitTextToSizeMock = vi.fn((text: string | string[], width: number) => {
  if (Array.isArray(text)) return text;
  // naive split to avoid depending on real layout
  return [String(text)];
});

vi.mock('jspdf', () => {
  return {
    jsPDF: vi.fn().mockImplementation(() => ({
      internal: {
        pageSize: {
          getWidth: vi.fn(() => 210),
          getHeight: vi.fn(() => 297),
        },
      },
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      setLineWidth: vi.fn(),
      text: textMock,
      addPage: addPageMock,
      line: lineMock,
      rect: rectMock,
      splitTextToSize: splitTextToSizeMock,
      save: saveMock,
    })),
  };
});

const createBaseAnalysis = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  summary: 'Overall this is a strong draft with vivid imagery.',
  strengths: ['Strong character voice', 'Vivid worldbuilding'],
  weaknesses: ['Pacing drags in the middle chapters'],
  pacing: {
    score: 7,
    analysis: 'Generally solid pacing with a few slow sections.',
    slowSections: ['Chapter 3 - exposition heavy'],
    fastSections: ['Final battle feels rushed'],
  },
  plotIssues: [
    {
      issue: 'Motivation unclear for antagonist in Act II',
      location: 'Chapter 8, scene 2',
      suggestion: 'Clarify the antagonist\'s long-term goal.',
    },
  ],
  characters: [
    {
      name: 'Ava Thorne',
      bio: 'Reluctant hero with a mysterious past.',
      arc: 'Learns to accept responsibility for her powers.',
      arcStages: [],
      relationships: [],
      plotThreads: [],
      inconsistencies: [],
      developmentSuggestion: 'Show more of her internal conflict early on.',
    },
  ],
  generalSuggestions: ['Tighten middle act pacing.'],
  ...overrides,
});

describe('generatePDF', () => {
  beforeEach(() => {
    saveMock.mockClear();
    textMock.mockClear();
    addPageMock.mockClear();
    lineMock.mockClear();
    rectMock.mockClear();
    splitTextToSizeMock.mockClear();
  });

  it('creates a PDF with expected sections and saves with derived filename', () => {
    const analysis = createBaseAnalysis();
    const fileName = 'manuscript.docx';

    generatePDF(analysis, fileName);

    // Cover page and subsequent section pages
    expect(addPageMock).toHaveBeenCalled();

    const allTextCalls = textMock.mock.calls.map(args => args[0]);

    // Check for key section headers
    expect(allTextCalls).toContain('Quill AI Literary Report');
    expect(allTextCalls).toContain('Executive Summary');
    expect(allTextCalls).toContain('Key Strengths');
    expect(allTextCalls).toContain('Areas for Improvement');
    expect(allTextCalls).toContain('Pacing & Narrative Flow');
    expect(allTextCalls).toContain('Character Development');
    expect(allTextCalls).toContain('Plot Analysis');

    // Pacing score header
    expect(
      allTextCalls.some((text) =>
        typeof text === 'string' && text.includes('Pacing Score: 7/10'),
      ),
    ).toBe(true);

    // Character name present
    expect(allTextCalls).toContain('Ava Thorne');

    // Plot issue title
    expect(allTextCalls).toContain('Motivation unclear for antagonist in Act II');

    // Save called with formatted filename
    expect(saveMock).toHaveBeenCalledTimes(1);
    const saveArg = saveMock.mock.calls[0][0];
    expect(saveArg).toBe('QuillAI_Report_manuscript.pdf');
  });

  it('handles empty / minimal analysis data without throwing', () => {
    const emptyAnalysis: AnalysisResult = {
      summary: '',
      strengths: [],
      weaknesses: [],
      pacing: {
        score: 0,
        analysis: '',
        slowSections: [],
        fastSections: [],
      },
      settingAnalysis: undefined,
      plotIssues: [],
      characters: [],
      generalSuggestions: [],
    };

    const fileName = 'empty.txt';

    expect(() => generatePDF(emptyAnalysis, fileName)).not.toThrow();

    // Should still attempt to save a file
    expect(saveMock).toHaveBeenCalledTimes(1);

    // Should still include structural section titles even if content arrays are empty
    const allTextCalls = textMock.mock.calls.map(args => args[0]);
    expect(allTextCalls).toContain('Executive Summary');
    expect(allTextCalls).toContain('Pacing & Narrative Flow');
    expect(allTextCalls).toContain('Character Development');
    // Plot Analysis page is only added if there are plot issues, so
    // we do NOT expect that header here.
  });
});
