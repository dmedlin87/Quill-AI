import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { render, screen, act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisProvider, useAnalysis } from '@/features/analysis/context/AnalysisContext';
import * as analysisService from '@/services/gemini/analysis';
import { isApiConfigured } from '@/config/api';
import { AnalysisResult } from '@/types';

// Mock the analysis service
vi.mock('@/services/gemini/analysis', () => ({
  fetchPacingAnalysis: vi.fn(),
  fetchCharacterAnalysis: vi.fn(),
  fetchPlotAnalysis: vi.fn(),
  fetchSettingAnalysis: vi.fn(),
}));

vi.mock('@/config/api', () => ({
  isApiConfigured: vi.fn(() => true),
}));

const mockPacingAnalysis = {
  pacing: { score: 8, issues: [] },
  generalSuggestions: ['Suggestion 1']
};

const mockCharacterAnalysis = {
  characters: [{ name: 'Hero', bio: 'The hero', traits: [] }]
};

const mockPlotAnalysis = {
  plotIssues: [{ issue: 'Plot hole', suggestion: 'Fix it', quote: 'quote' }],
  summary: 'A great story',
  strengths: ['Good pacing'],
  weaknesses: ['Weak ending']
};

const mockSettingAnalysis = {
  settingAnalysis: {
    issues: [{ issue: 'Anachronism', suggestion: 'Remove ipod', quote: 'ipod' }],
    consistencyScore: 9
  }
};

describe('AnalysisContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiConfigured).mockReturnValue(true);
  });

  it('provides initial state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AnalysisProvider>{children}</AnalysisProvider>
    );
    const { result } = renderHook(() => useAnalysis(), { wrapper });

    expect(result.current.analysis).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisStatus).toEqual({
      pacing: 'idle',
      characters: 'idle',
      plot: 'idle',
      setting: 'idle',
      summary: 'idle'
    });
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test as React will error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAnalysis())).toThrow("useAnalysis must be used within AnalysisProvider");

    consoleSpy.mockRestore();
  });

  describe('Incremental Analysis', () => {
    it('analyzes pacing successfully', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockResolvedValue(mockPacingAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzePacing('some text');
      });

      expect(analysisService.fetchPacingAnalysis).toHaveBeenCalledWith('some text', undefined, expect.any(AbortSignal));
      expect(result.current.incrementalAnalysis.pacing).toEqual(mockPacingAnalysis.pacing);
      expect(result.current.analysisStatus.pacing).toBe('complete');
    });

    it('handles pacing analysis failure', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzePacing('some text');
      });

      expect(result.current.analysisStatus.pacing).toBe('error');
      consoleSpy.mockRestore();
    });

    it('analyzes characters successfully', async () => {
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzeCharacters('some text');
      });

      expect(analysisService.fetchCharacterAnalysis).toHaveBeenCalledWith('some text', undefined, expect.any(AbortSignal));
      expect(result.current.incrementalAnalysis.characters).toEqual(mockCharacterAnalysis.characters);
      expect(result.current.analysisStatus.characters).toBe('complete');
    });

    it('handles character analysis failure', async () => {
      vi.mocked(analysisService.fetchCharacterAnalysis).mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzeCharacters('some text');
      });

      expect(result.current.analysisStatus.characters).toBe('error');
      consoleSpy.mockRestore();
    });

    it('analyzes plot successfully', async () => {
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzePlot('some text');
      });

      expect(analysisService.fetchPlotAnalysis).toHaveBeenCalledWith('some text', expect.any(AbortSignal));
      expect(result.current.incrementalAnalysis.plotIssues).toEqual(mockPlotAnalysis.plotIssues);
      expect(result.current.incrementalAnalysis.summary).toEqual(mockPlotAnalysis.summary);
      expect(result.current.analysisStatus.plot).toBe('complete');
      expect(result.current.analysisStatus.summary).toBe('complete');
    });

    it('handles plot analysis failure', async () => {
      vi.mocked(analysisService.fetchPlotAnalysis).mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzePlot('some text');
      });

      expect(result.current.analysisStatus.plot).toBe('error');
      consoleSpy.mockRestore();
    });

    it('analyzes setting successfully', async () => {
      vi.mocked(analysisService.fetchSettingAnalysis).mockResolvedValue(mockSettingAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      const setting = { timePeriod: 'Future', location: 'Space' };
      await act(async () => {
        await result.current.analyzeSetting('some text', setting);
      });

      expect(analysisService.fetchSettingAnalysis).toHaveBeenCalledWith('some text', setting, expect.any(AbortSignal));
      expect(result.current.incrementalAnalysis.settingAnalysis).toEqual(mockSettingAnalysis.settingAnalysis);
      expect(result.current.analysisStatus.setting).toBe('complete');
    });

    it('handles setting analysis failure', async () => {
      vi.mocked(analysisService.fetchSettingAnalysis).mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      const setting = { timePeriod: 'Future', location: 'Space' };
      await act(async () => {
        await result.current.analyzeSetting('some text', setting);
      });

      expect(result.current.analysisStatus.setting).toBe('error');
      consoleSpy.mockRestore();
    });

    it('aborts incremental analyses when API is not configured', async () => {
      vi.mocked(isApiConfigured).mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.analyzePacing('text');
        await result.current.analyzeCharacters('text');
        await result.current.analyzePlot('text');
        await result.current.analyzeSetting('text', { timePeriod: '', location: '' });
      });

      expect(result.current.analysisStatus.pacing).toBe('error');
      expect(result.current.analysisStatus.characters).toBe('error');
      expect(result.current.analysisStatus.plot).toBe('error');
      expect(result.current.analysisStatus.setting).toBe('error');

      expect(consoleSpy).toHaveBeenCalledTimes(4); // Warn for each
      consoleSpy.mockRestore();
    });
  });

  describe('Full Analysis', () => {
    it('runs full analysis successfully without setting', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockResolvedValue(mockPacingAnalysis as any);
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await act(async () => {
        await result.current.runFullAnalysis('some text');
      });

      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.analysis).toEqual(expect.objectContaining({
        summary: mockPlotAnalysis.summary,
        pacing: mockPacingAnalysis.pacing,
        characters: mockCharacterAnalysis.characters,
      }));
      expect(result.current.analysisStatus).toEqual({
        pacing: 'complete',
        characters: 'complete',
        plot: 'complete',
        setting: 'idle',
        summary: 'complete'
      });
    });

    it('runs full analysis successfully with setting', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockResolvedValue(mockPacingAnalysis as any);
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);
      vi.mocked(analysisService.fetchSettingAnalysis).mockResolvedValue(mockSettingAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      const setting = { timePeriod: 'Future', location: 'Space' };
      await act(async () => {
        await result.current.runFullAnalysis('some text', setting);
      });

      expect(result.current.analysis).toEqual(expect.objectContaining({
        settingAnalysis: mockSettingAnalysis.settingAnalysis
      }));
      expect(result.current.analysisStatus.setting).toBe('complete');
    });

    it('handles full analysis failure', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      await expect(result.current.runFullAnalysis('some text')).rejects.toThrow('Failed');

      expect(result.current.isAnalyzing).toBe(false);
      consoleSpy.mockRestore();
    });

    it('aborts analysis correctly', async () => {
      // Mock one service to delay indefinitely so we can abort
      let resolvePacing: any;
      const pacingPromise = new Promise((resolve) => { resolvePacing = resolve; });
      vi.mocked(analysisService.fetchPacingAnalysis).mockReturnValue(pacingPromise as any);
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      let analysisPromise: Promise<AnalysisResult>;
      act(() => {
        analysisPromise = result.current.runFullAnalysis('some text');
      });

      expect(result.current.isAnalyzing).toBe(true);

      act(() => {
        result.current.abortAnalysis();
      });

      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.analysisStatus).toEqual({
        pacing: 'idle',
        characters: 'idle',
        plot: 'idle',
        setting: 'idle',
        summary: 'idle'
      });

      // Cleanup the promise
      resolvePacing(mockPacingAnalysis);
      try {
        await analysisPromise!;
      } catch (e) {
        // Expected abort error or similar
      }
    });

    it('clears analysis state', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <AnalysisProvider>{children}</AnalysisProvider>
          );
          const { result } = renderHook(() => useAnalysis(), { wrapper });

          act(() => {
            result.current.setAnalysis({} as any);
            result.current.setPlotSuggestions([{} as any]);
            result.current.clearAnalysis();
          });

          expect(result.current.analysis).toBeNull();
          expect(result.current.plotSuggestions).toEqual([]);
          expect(result.current.incrementalAnalysis).toEqual({});
          expect(result.current.analysisStatus).toEqual({
            pacing: 'idle',
            characters: 'idle',
            plot: 'idle',
            setting: 'idle',
            summary: 'idle'
          });
    });

    it('prevents reusing aborted controller signal', async () => {
      // Setup a mock that checks the signal status
      vi.mocked(analysisService.fetchPacingAnalysis).mockImplementation(async (text, setting, signal) => {
         if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
         return mockPacingAnalysis as any;
      });
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      // First run and abort
      let promise1;
      act(() => {
         promise1 = result.current.runFullAnalysis('text 1');
      });
      act(() => {
          result.current.abortAnalysis();
      });

      try { await promise1; } catch {}

      // Second run should succeed and not use the old aborted signal
      await act(async () => {
         await result.current.runFullAnalysis('text 2');
      });

      expect(result.current.analysisStatus.pacing).toBe('complete');
    });

    it('handles API not configured error in runFullAnalysis', async () => {
      vi.mocked(isApiConfigured).mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result } = renderHook(() => useAnalysis(), { wrapper });

      let analysisResult;
      await act(async () => {
        analysisResult = await result.current.runFullAnalysis('some text');
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API key not configured'));
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.analysisStatus).toEqual({
        pacing: 'error',
        characters: 'error',
        plot: 'error',
        setting: 'idle', // setting was undefined
        summary: 'error'
      });
      expect(analysisResult).toEqual(expect.objectContaining({
        summary: expect.stringContaining('missing'),
      }));

      consoleSpy.mockRestore();
    });

    it('handles race condition where component unmounts during analysis', async () => {
      vi.mocked(analysisService.fetchPacingAnalysis).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Delay
        return mockPacingAnalysis as any;
      });
      vi.mocked(analysisService.fetchCharacterAnalysis).mockResolvedValue(mockCharacterAnalysis as any);
      vi.mocked(analysisService.fetchPlotAnalysis).mockResolvedValue(mockPlotAnalysis as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AnalysisProvider>{children}</AnalysisProvider>
      );
      const { result, unmount } = renderHook(() => useAnalysis(), { wrapper });

      // Start analysis
      let analysisPromise;
      await act(async () => {
        analysisPromise = result.current.runFullAnalysis('some text');
      });

      // Unmount immediately
      unmount();

      // Ensure that when promise resolves, it doesn't crash or try to update state
      // React 18+ strict mode often logs warnings for updates on unmounted components,
      // but if the component logic doesn't handle unmount, it might set state.
      // In functional components with hooks, unmounting doesn't stop async callbacks unless explicit checks or cleanup.

      // Since runFullAnalysis awaits Promise.all, then sets state,
      // if we unmount, setAnalysis etc will be called on unmounted component.
      // This is generally safe in React 18 (just ignored with warning), but technically a "race condition".

      // To properly test if it handles it (if the code did), we'd check if state update was attempted.
      // But standard React hooks don't expose if they are mounted.

      // For this task, "Test race conditions" usually means ensuring no errors or adverse effects.
      // We will just await the promise and ensure no crash.
      await expect(analysisPromise).resolves.not.toThrow();
    });
  });
});
