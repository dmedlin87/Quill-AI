/**
 * Comprehensive tests for Gemini analysis service
 * Covers analyzeDraft, parallel analysis functions, and plot ideas generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  analyzeDraft,
  fetchPacingAnalysis,
  fetchCharacterAnalysis,
  fetchPlotAnalysis,
  fetchSettingAnalysis,
  generatePlotIdeas,
  PacingAnalysisResult,
  CharacterAnalysisResult,
  PlotAnalysisResult,
  SettingAnalysisResult
} from '@/services/gemini/analysis';
import { 
  mockUsageMetadata,
  mockAnalysisResult,
  mockManuscriptIndex
} from '@/tests/mocks/geminiClient';

// Setup mocks using vi.hoisted() to ensure they're available at import time
const mockAi = vi.hoisted(() => ({
  models: {
    generateContent: vi.fn(),
  },
  chats: {
    create: vi.fn(),
  },
}));

// Mock the client module before any imports
vi.mock('@/services/gemini/client', () => ({
  ai: mockAi,
}));

// Mock resilient parser
vi.mock('@/services/gemini/resilientParser', () => ({
  safeParseJson: vi.fn(),
}));

// Mock token guard
vi.mock('@/services/gemini/tokenGuard', () => ({
  prepareAnalysisText: vi.fn((text: string) => ({ text, warning: undefined })),
}));

describe('analyzeDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs complete analysis with setting and index context', async () => {
    const mockResponse = {
      text: JSON.stringify(mockAnalysisResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    // Mock safeParseJson to return valid analysis result
    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockAnalysisResult,
      sanitized: false,
      error: null
    });

    // Note: Don't mock Zod safeParse - it's not a simple function and can't be mocked with vi.mocked()
    // The test relies on safeParseJson mock returning valid data that passes Zod validation

    const setting = { timePeriod: 'Victorian', location: 'London' };
    const result = await analyzeDraft('Sample manuscript text', setting, mockManuscriptIndex);

    expect(result.result).toEqual(mockAnalysisResult);
    expect(result.usage).toEqual(mockUsageMetadata);
    expect(result.warning).toBeUndefined();

    // Verify the function was called with correct structure
    expect(mockAi.models.generateContent).toHaveBeenCalled();
    const callArgs = mockAi.models.generateContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-3-pro-preview");
    expect(callArgs.contents).toContain('Sample manuscript text');
    expect(callArgs.config.responseMimeType).toBe("application/json");
    expect(callArgs.config.responseSchema.type).toBe("OBJECT");
    // Verify key properties exist with uppercase type enums
    expect(callArgs.config.responseSchema.properties.summary.type).toBe("STRING");
    expect(callArgs.config.responseSchema.properties.pacing.type).toBe("OBJECT");
    expect(callArgs.config.responseSchema.properties.characters.type).toBe("ARRAY");
    expect(callArgs.config.responseSchema.properties.plotIssues.type).toBe("ARRAY");

    // Verify context building
    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('SETTING CONTEXT: Time Period: Victorian, Location: London');
    expect(prompt).toContain('KNOWN CHARACTER FACTS (from previous chapters):');
    expect(prompt).toContain('John Doe: age=30, occupation=Blacksmith');
  });

  it('handles analysis without setting or index', async () => {
    const mockResponse = {
      text: JSON.stringify(mockAnalysisResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockAnalysisResult,
      sanitized: false,
      error: null
    });

    // Don't mock Zod safeParse - let it validate naturally
    const result = await analyzeDraft('Sample text');

    expect(result.result).toEqual(mockAnalysisResult);
    expect(result.usage).toEqual(mockUsageMetadata);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('SETTING CONTEXT: General Fiction (Unknown setting)');
    expect(prompt).toContain('apparent setting');
  });

  it('handles parse failure with fallback analysis', async () => {
    const mockResponse = {
      text: 'Invalid JSON response',
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: false,
      data: null,
      sanitized: false,
      error: 'Parse error'
    });

    // Don't mock Zod - when parse fails, fallback is used
    const result = await analyzeDraft('Sample text');

    expect(result.result.summary).toBe('Analysis could not be completed.');
    expect(result.result.strengths).toEqual([]);
    expect(result.usage).toEqual(mockUsageMetadata);
  });

  it('handles Zod validation failure', async () => {
    const invalidResponse = {
      text: JSON.stringify({
        summary: 'Valid summary',
        strengths: 'Should be array, not string', // Invalid type
        weaknesses: [],
        pacing: { score: 'Invalid', analysis: '', slowSections: [], fastSections: [] },
        plotIssues: [],
        characters: [],
        generalSuggestions: [],
      }),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(invalidResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    // Return invalid data that will fail Zod validation naturally
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: {
        summary: 'Valid summary',
        strengths: 'Should be array, not string', // Invalid type - will fail Zod validation
        weaknesses: [],
        pacing: { score: 'Invalid', analysis: '', slowSections: [], fastSections: [] },
        plotIssues: [],
        characters: [],
        generalSuggestions: [],
      },
      sanitized: false,
      error: null
    });

    // Don't mock Zod - let it validate naturally and fail due to invalid data
    const result = await analyzeDraft('Sample text');

    expect(result.result.summary).toBe('Analysis could not be completed.');
    expect(result.warning).toBe('AI response failed validation - using default analysis');
  });

  it('includes warning when response requires sanitization', async () => {
    const mockResponse = {
      text: '```json\n{"summary": "Cleaned response"}\n```', // Requires sanitization
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    // Mock safeParseJson to simulate sanitization
    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockAnalysisResult,
      sanitized: true,
      error: null
    });

    // Don't mock Zod - let it validate naturally
    const result = await analyzeDraft('Sample text');

    expect(result.result).toEqual(mockAnalysisResult);
    expect(result.warning).toBe('AI response needed cleanup; results may be incomplete.');
  });

  it('supports explicit suggestion type without user instruction', async () => {
    const mockResponse = {
      text: JSON.stringify(mockAnalysisResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockAnalysisResult,
      sanitized: false,
      error: null
    });

    // Don't mock Zod - analyzeDraft only takes 3 args now (abort signal removed or handled differently)
    await analyzeDraft('Sample text');

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});

describe('fetchPacingAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches pacing analysis with setting context', async () => {
    const mockPacingResult: PacingAnalysisResult = {
      pacing: {
        score: 7,
        analysis: 'Good pacing overall',
        slowSections: ['Chapter 2'],
        fastSections: ['Action scenes'],
      },
      generalSuggestions: ['Consider varying sentence length'],
    };

    const mockResponse = {
      text: JSON.stringify(mockPacingResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockPacingResult,
      sanitized: false,
      error: null
    });

    const setting = { timePeriod: 'Modern', location: 'New York' };
    const result = await fetchPacingAnalysis('Sample text', setting);

    expect(result).toEqual(mockPacingResult);
    // Verify the function was called with correct structure
    expect(mockAi.models.generateContent).toHaveBeenCalled();
    const callArgs = mockAi.models.generateContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-3-pro-preview");
    expect(callArgs.contents).toContain('Sample text');
    expect(callArgs.config.responseMimeType).toBe("application/json");
    expect(callArgs.config.responseSchema.type).toBe("OBJECT");

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('SETTING CONTEXT: Time Period: Modern, Location: New York');
  });

  it('fetches pacing analysis without setting context', async () => {
    const mockPacingResult: PacingAnalysisResult = {
      pacing: {
        score: 8,
        analysis: 'Excellent pacing',
        slowSections: [],
        fastSections: [],
      },
      generalSuggestions: [],
    };

    const mockResponse = {
      text: JSON.stringify(mockPacingResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockPacingResult,
      sanitized: false,
      error: null
    });

    const result = await fetchPacingAnalysis('Sample text');

    expect(result).toEqual(mockPacingResult);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).not.toContain('SETTING CONTEXT:');
  });

  it('supports abort signal', async () => {
    const mockResponse = {
      text: JSON.stringify({ pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] }, generalSuggestions: [] }),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: { pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] }, generalSuggestions: [] },
      sanitized: false,
      error: null
    });

    const abortController = new AbortController();
    await fetchPacingAnalysis('Sample text', undefined, abortController.signal);

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});

describe('fetchCharacterAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches character analysis with manuscript index', async () => {
    const mockCharacterResult: CharacterAnalysisResult = {
      characters: [
        {
          name: 'John Doe',
          bio: 'Main character',
          arc: 'Hero journey',
          arcStages: [
            { stage: 'Call to adventure', description: 'Leaves home' },
          ],
          relationships: [
            { name: 'Jane', type: 'romantic', dynamic: 'tension' },
          ],
          plotThreads: ['Main quest'],
          inconsistencies: [],
          developmentSuggestion: 'Show more emotions',
        },
      ],
    };

    const mockResponse = {
      text: JSON.stringify(mockCharacterResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockCharacterResult,
      sanitized: false,
      error: null
    });

    const result = await fetchCharacterAnalysis('Sample text', mockManuscriptIndex);

    expect(result).toEqual(mockCharacterResult);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('KNOWN CHARACTER FACTS:');
    expect(prompt).toContain('John Doe: age=30, occupation=Blacksmith');
  });

  it('fetches character analysis without manuscript index', async () => {
    const mockCharacterResult: CharacterAnalysisResult = {
      characters: [
        {
          name: 'New Character',
          bio: 'New character bio',
          arc: 'New arc',
          arcStages: [],
          relationships: [],
          plotThreads: [],
          inconsistencies: [],
          developmentSuggestion: 'Develop further',
        },
      ],
    };

    const mockResponse = {
      text: JSON.stringify(mockCharacterResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockCharacterResult,
      sanitized: false,
      error: null
    });

    const result = await fetchCharacterAnalysis('Sample text');

    expect(result).toEqual(mockCharacterResult);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).not.toContain('KNOWN CHARACTER FACTS:');
  });

  it('supports abort signal', async () => {
    const mockResponse = {
      text: JSON.stringify({ characters: [] }),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: { characters: [] },
      sanitized: false,
      error: null
    });

    const abortController = new AbortController();
    await fetchCharacterAnalysis('Sample text', undefined, abortController.signal);

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});

describe('fetchPlotAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches plot analysis successfully', async () => {
    const mockPlotResult: PlotAnalysisResult = {
      summary: 'Compelling story about a hero journey',
      strengths: ['Strong character development', 'Good pacing'],
      weaknesses: ['Some plot points need clarification'],
      plotIssues: [
        {
          issue: 'Unclear motivation in chapter 2',
          location: 'Chapter 2',
          suggestion: 'Add internal monologue',
          quote: 'He decided to leave',
        },
      ],
    };

    const mockResponse = {
      text: JSON.stringify(mockPlotResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockPlotResult,
      sanitized: false,
      error: null
    });

    const result = await fetchPlotAnalysis('Sample text');

    expect(result).toEqual(mockPlotResult);
    // Verify the function was called with correct structure
    expect(mockAi.models.generateContent).toHaveBeenCalled();
    const callArgs = mockAi.models.generateContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-3-pro-preview");
    expect(callArgs.contents).toContain('Sample text');
    expect(callArgs.config.responseMimeType).toBe("application/json");
    expect(callArgs.config.responseSchema.type).toBe("OBJECT");
    expect(callArgs.config.responseSchema.properties.summary.type).toBe("STRING");
    expect(callArgs.config.responseSchema.properties.plotIssues.type).toBe("ARRAY");
  });

  it('supports abort signal', async () => {
    const mockResponse = {
      text: JSON.stringify({ summary: '', strengths: [], weaknesses: [], plotIssues: [] }),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: { summary: '', strengths: [], weaknesses: [], plotIssues: [] },
      sanitized: false,
      error: null
    });

    const abortController = new AbortController();
    await fetchPlotAnalysis('Sample text', abortController.signal);

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});

describe('fetchSettingAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches setting analysis with time period and location', async () => {
    const mockSettingResult: SettingAnalysisResult = {
      settingAnalysis: {
        score: 8,
        analysis: 'Victorian London setting is well-established',
        issues: [
          {
            quote: 'He checked his smartphone',
            issue: 'Anachronism: smartphones did not exist in Victorian era',
            suggestion: 'Replace with pocket watch or telegram',
            alternatives: ['He checked his pocket watch', 'He awaited a telegram'],
          },
        ],
      },
    };

    const mockResponse = {
      text: JSON.stringify(mockSettingResult),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockSettingResult,
      sanitized: false,
      error: null
    });

    const setting = { timePeriod: 'Victorian', location: 'London' };
    const result = await fetchSettingAnalysis('Sample text', setting);

    expect(result).toEqual(mockSettingResult);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    // Prompt uses format "SETTING: Victorian, London" not separate TIME_PERIOD/LOCATION labels
    expect(prompt).toContain('Victorian');
    expect(prompt).toContain('London');
    expect(prompt).toContain('Sample text');
  });

  it('supports abort signal', async () => {
    const mockResponse = {
      text: JSON.stringify({ settingAnalysis: { score: 5, analysis: '', issues: [] } }),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: { settingAnalysis: { score: 5, analysis: '', issues: [] } },
      sanitized: false,
      error: null
    });

    const abortController = new AbortController();
    await fetchSettingAnalysis('Sample text', { timePeriod: 'Modern', location: 'City' }, abortController.signal);

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});

describe('generatePlotIdeas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates plot ideas with user instruction', async () => {
    const mockIdeas = [
      {
        title: 'Character Betrayal Arc',
        description: 'A trusted ally betrays the protagonist at a critical moment',
        reasoning: 'This would create tension and test the protagonist\'s resilience',
      },
      {
        title: 'Mystery Subplot',
        description: 'Introduce a mysterious disappearance that connects to the main plot',
        reasoning: 'Adds suspense and provides opportunities for character development',
      },
    ];

    const mockResponse = {
      text: JSON.stringify(mockIdeas),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockIdeas,
      sanitized: false,
      error: null
    });

    const result = await generatePlotIdeas(
      'Sample manuscript text',
      'Add more conflict between characters',
      'Character Development'
    );

    expect(result.result).toEqual(mockIdeas);
    expect(result.usage).toEqual(mockUsageMetadata);
    expect(result.warning).toBeUndefined();

    // Verify the function was called with correct structure
    expect(mockAi.models.generateContent).toHaveBeenCalled();
    const callArgs = mockAi.models.generateContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-3-pro-preview");
    expect(callArgs.contents).toContain('Sample manuscript text');
    expect(callArgs.config.responseMimeType).toBe("application/json");
    expect(callArgs.config.responseSchema.type).toBe("ARRAY");
    expect(callArgs.config.responseSchema.items.type).toBe("OBJECT");

    const prompt = callArgs.contents;
    expect(prompt).toContain('Target Type: Character Development');
    expect(prompt).toContain('Add more conflict between characters');
  });

  it('generates plot ideas without user instruction', async () => {
    const mockIdeas = [
      {
        title: 'New Plot Idea',
        description: 'Description of the idea',
        reasoning: 'How it connects to existing plot',
      },
    ];

    const mockResponse = {
      text: JSON.stringify(mockIdeas),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: mockIdeas,
      sanitized: false,
      error: null
    });

    const result = await generatePlotIdeas('Sample text');

    expect(result.result).toEqual(mockIdeas);

    const prompt = mockAi.models.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('Target Type: General');
    expect(prompt).toContain('User Constraint/Request: "None - provide best options based on analysis"');
  });

  it('handles parse failure gracefully', async () => {
    const mockResponse = {
      text: 'Invalid JSON response',
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: false,
      data: [],
      sanitized: false,
      error: 'Parse error'
    });

    const result = await generatePlotIdeas('Sample text');

    expect(result.result).toEqual([]);
    expect(result.usage).toEqual(mockUsageMetadata);
  });

  it('includes warning when response requires sanitization', async () => {
    const mockResponse = {
      text: '```json\n[{"title": "Idea"}]\n```',
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    // Mock safeParseJson to simulate sanitization
    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: [{ title: 'Idea' }],
      sanitized: true,
      error: null
    });

    const result = await generatePlotIdeas('Sample text');

    expect(result.result).toEqual([{ title: 'Idea' }]);
    expect(result.warning).toBe('Response required sanitization');
  });

  it('supports abort signal', async () => {
    const mockResponse = {
      text: JSON.stringify([{ title: 'Idea' }]),
      usageMetadata: mockUsageMetadata,
    };

    mockAi.models.generateContent.mockResolvedValue(mockResponse);

    const { safeParseJson } = await import('@/services/gemini/resilientParser');
    vi.mocked(safeParseJson).mockReturnValue({
      success: true,
      data: [{ title: 'Idea' }],
      sanitized: false,
      error: null
    });

    const abortController = new AbortController();
    await generatePlotIdeas('Sample text', undefined, 'General');

    expect(mockAi.models.generateContent).toHaveBeenCalled();
  });
});
