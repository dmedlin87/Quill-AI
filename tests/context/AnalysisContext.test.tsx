/**
 * Tests for AnalysisContext
 * Covers analysis state, incremental loading, and parallel analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AnalysisProvider, useAnalysis } from '@/features/analysis/context/AnalysisContext';

// Mock analysis service
const mockFetchPacingAnalysis = vi.fn();
const mockFetchCharacterAnalysis = vi.fn();
const mockFetchPlotAnalysis = vi.fn();
const mockFetchSettingAnalysis = vi.fn();

vi.mock('@/services/gemini/analysis', () => ({
  fetchPacingAnalysis: (...args: unknown[]) => mockFetchPacingAnalysis(...args),
  fetchCharacterAnalysis: (...args: unknown[]) => mockFetchCharacterAnalysis(...args),
  fetchPlotAnalysis: (...args: unknown[]) => mockFetchPlotAnalysis(...args),
  fetchSettingAnalysis: (...args: unknown[]) => mockFetchSettingAnalysis(...args),
}));

// Wrapper component for hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AnalysisProvider>{children}</AnalysisProvider>
);

// Mock data
const mockPacingResult = {
  pacing: { score: 7, analysis: 'Good pacing', slowSections: [], fastSections: [] },
  generalSuggestions: ['Vary sentence length'],
};

const mockCharacterResult = {
  characters: [
    { name: 'John', bio: 'Hero', arc: 'Growth', arcStages: [], relationships: [], plotThreads: [], inconsistencies: [], developmentSuggestion: 'Show more emotion' },
  ],
};

const mockPlotResult = {
  summary: 'A compelling story',
  strengths: ['Strong character development'],
  weaknesses: ['Slow middle'],
  plotIssues: [{ issue: 'Plot hole', location: 'Ch3', suggestion: 'Fix it', quote: 'text' }],
};

const mockSettingResult = {
  settingAnalysis: { score: 8, analysis: 'Well-established setting', issues: [] },
};

describe('AnalysisContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPacingAnalysis.mockResolvedValue(mockPacingResult);
    mockFetchCharacterAnalysis.mockResolvedValue(mockCharacterResult);
    mockFetchPlotAnalysis.mockResolvedValue(mockPlotResult);
    mockFetchSettingAnalysis.mockResolvedValue(mockSettingResult);
  });

  describe('useAnalysis hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAnalysis());
      }).toThrow('useAnalysis must be used within AnalysisProvider');
      
      consoleSpy.mockRestore();
    });

    it('provides analysis context when used within provider', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(result.current.analysis).toBeNull();
      expect(result.current.isAnalyzing).toBe(false);
    });
  });

  describe('Initial State', () => {
    it('starts with null analysis', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      expect(result.current.analysis).toBeNull();
    });

    it('starts with idle status for all sections', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      expect(result.current.analysisStatus.pacing).toBe('idle');
      expect(result.current.analysisStatus.characters).toBe('idle');
      expect(result.current.analysisStatus.plot).toBe('idle');
      expect(result.current.analysisStatus.setting).toBe('idle');
      expect(result.current.analysisStatus.summary).toBe('idle');
    });

    it('starts with empty plot suggestions', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      expect(result.current.plotSuggestions).toEqual([]);
    });
  });

  describe('setAnalysis', () => {
    it('sets full analysis result', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      const mockAnalysis = {
        summary: 'Test summary',
        strengths: ['Strong point'],
        weaknesses: ['Weak point'],
        pacing: { score: 8, analysis: 'Good', slowSections: [], fastSections: [] },
        plotIssues: [],
        characters: [],
        generalSuggestions: [],
      };
      
      act(() => {
        result.current.setAnalysis(mockAnalysis);
      });
      
      expect(result.current.analysis).toEqual(mockAnalysis);
    });

    it('clears analysis when set to null', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      // Set first
      act(() => {
        result.current.setAnalysis({ summary: 'Test', strengths: [], weaknesses: [], pacing: { score: 5, analysis: '', slowSections: [], fastSections: [] }, plotIssues: [], characters: [], generalSuggestions: [] });
      });
      
      // Clear
      act(() => {
        result.current.setAnalysis(null);
      });
      
      expect(result.current.analysis).toBeNull();
    });
  });

  describe('setPlotSuggestions', () => {
    it('sets plot suggestions', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      const suggestions = [
        { title: 'Add conflict', description: 'More tension', reasoning: 'Engages reader' },
      ];
      
      act(() => {
        result.current.setPlotSuggestions(suggestions);
      });
      
      expect(result.current.plotSuggestions).toEqual(suggestions);
    });
  });

  describe('Individual Analysis Methods', () => {
    it('analyzePacing updates status and result', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.analyzePacing('Sample text');
      });
      
      expect(mockFetchPacingAnalysis).toHaveBeenCalledWith('Sample text', undefined, undefined);
      expect(result.current.analysisStatus.pacing).toBe('complete');
      expect(result.current.incrementalAnalysis.pacing).toEqual(mockPacingResult.pacing);
    });

    it('analyzeCharacters updates status and result', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.analyzeCharacters('Sample text');
      });
      
      expect(mockFetchCharacterAnalysis).toHaveBeenCalled();
      expect(result.current.analysisStatus.characters).toBe('complete');
      expect(result.current.incrementalAnalysis.characters).toEqual(mockCharacterResult.characters);
    });

    it('analyzePlot updates status and multiple fields', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.analyzePlot('Sample text');
      });
      
      expect(mockFetchPlotAnalysis).toHaveBeenCalled();
      expect(result.current.analysisStatus.plot).toBe('complete');
      expect(result.current.analysisStatus.summary).toBe('complete');
      expect(result.current.incrementalAnalysis.summary).toBe(mockPlotResult.summary);
      expect(result.current.incrementalAnalysis.plotIssues).toEqual(mockPlotResult.plotIssues);
    });

    it('analyzeSetting updates status and result', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      const setting = { timePeriod: 'Victorian', location: 'London' };
      
      await act(async () => {
        await result.current.analyzeSetting('Sample text', setting);
      });
      
      expect(mockFetchSettingAnalysis).toHaveBeenCalledWith('Sample text', setting, undefined);
      expect(result.current.analysisStatus.setting).toBe('complete');
      expect(result.current.incrementalAnalysis.settingAnalysis).toEqual(mockSettingResult.settingAnalysis);
    });

    it('handles analysis error gracefully', async () => {
      mockFetchPacingAnalysis.mockRejectedValue(new Error('API Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.analyzePacing('Sample text');
      });
      
      expect(result.current.analysisStatus.pacing).toBe('error');
      
      consoleSpy.mockRestore();
    });
  });

  describe('runFullAnalysis', () => {
    it('runs all analyses in parallel', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      const setting = { timePeriod: 'Modern', location: 'NYC' };
      
      await act(async () => {
        await result.current.runFullAnalysis('Full text', setting);
      });
      
      expect(mockFetchPacingAnalysis).toHaveBeenCalled();
      expect(mockFetchCharacterAnalysis).toHaveBeenCalled();
      expect(mockFetchPlotAnalysis).toHaveBeenCalled();
      expect(mockFetchSettingAnalysis).toHaveBeenCalled();
    });

    it('sets isAnalyzing during analysis', async () => {
      // Use a delayed mock to capture intermediate state
      let resolvePromise: () => void;
      mockFetchPacingAnalysis.mockImplementation(() => new Promise(r => { resolvePromise = () => r(mockPacingResult); }));
      
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      let analysisPromise: Promise<unknown>;
      act(() => {
        analysisPromise = result.current.runFullAnalysis('Text');
      });
      
      // During analysis
      expect(result.current.isAnalyzing).toBe(true);
      
      // Resolve
      await act(async () => {
        resolvePromise!();
        await analysisPromise;
      });
      
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('returns merged analysis result', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      let fullResult;
      await act(async () => {
        fullResult = await result.current.runFullAnalysis('Text');
      });
      
      expect(fullResult).toHaveProperty('summary', mockPlotResult.summary);
      expect(fullResult).toHaveProperty('pacing', mockPacingResult.pacing);
      expect(fullResult).toHaveProperty('characters', mockCharacterResult.characters);
    });

    it('updates all status fields to complete', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.runFullAnalysis('Text');
      });
      
      expect(result.current.analysisStatus.pacing).toBe('complete');
      expect(result.current.analysisStatus.characters).toBe('complete');
      expect(result.current.analysisStatus.plot).toBe('complete');
      expect(result.current.analysisStatus.summary).toBe('complete');
    });

    it('skips setting analysis when no setting provided', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      await act(async () => {
        await result.current.runFullAnalysis('Text'); // No setting
      });
      
      expect(mockFetchSettingAnalysis).not.toHaveBeenCalled();
      expect(result.current.analysisStatus.setting).toBe('idle');
    });

    it('logs and rethrows when full analysis fails', async () => {
      const error = new Error('Full analysis failed');
      mockFetchPacingAnalysis.mockRejectedValueOnce(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAnalysis(), { wrapper });

      let analysisPromise: Promise<unknown>;
      act(() => {
        analysisPromise = result.current.runFullAnalysis('Text');
      });

      await expect(analysisPromise!).rejects.toThrow('Full analysis failed');

      expect(consoleSpy).toHaveBeenCalled();
      const [firstMessage] = consoleSpy.mock.calls[0];
      expect(String(firstMessage)).toContain('[AnalysisContext] Full analysis failed:');

      expect(result.current.isAnalyzing).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('clearAnalysis', () => {
    it('resets all analysis state', async () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      // Run analysis first
      await act(async () => {
        await result.current.runFullAnalysis('Text');
      });
      
      // Clear
      act(() => {
        result.current.clearAnalysis();
      });
      
      expect(result.current.analysis).toBeNull();
      expect(result.current.incrementalAnalysis).toEqual({});
      expect(result.current.analysisStatus.pacing).toBe('idle');
      expect(result.current.plotSuggestions).toEqual([]);
    });
  });

  describe('abortAnalysis', () => {
    it('sets isAnalyzing to false', () => {
      const { result } = renderHook(() => useAnalysis(), { wrapper });
      
      act(() => {
        result.current.setIsAnalyzing(true);
      });
      
      expect(result.current.isAnalyzing).toBe(true);
      
      act(() => {
        result.current.abortAnalysis();
      });
      
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('aborts the underlying AbortController signal for in-flight full analysis', async () => {
      let capturedSignal: AbortSignal | undefined;

      mockFetchPacingAnalysis.mockImplementation((_text: string, _setting: any, signal?: AbortSignal) => {
        capturedSignal = signal;
        return new Promise(resolve => {
          // Never resolve; we only care about the signal state
        });
      });

      const { result } = renderHook(() => useAnalysis(), { wrapper });

      let analysisPromise: Promise<unknown>;
      act(() => {
        analysisPromise = result.current.runFullAnalysis('Text');
      });

      await waitFor(() => {
        expect(capturedSignal).toBeDefined();
      });

      act(() => {
        result.current.abortAnalysis();
      });

      expect(capturedSignal!.aborted).toBe(true);
      expect(result.current.isAnalyzing).toBe(false);

      // Prevent unhandled promise rejection warnings
      await expect(analysisPromise!).rejects.toBeDefined();
    });
  });
});
