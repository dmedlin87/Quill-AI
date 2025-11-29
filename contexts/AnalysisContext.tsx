import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnalysisResult, PlotSuggestion, CharacterProfile } from '../types';
import { 
  fetchPacingAnalysis, 
  fetchCharacterAnalysis, 
  fetchPlotAnalysis,
  fetchSettingAnalysis 
} from '../services/gemini/analysis';
import { ManuscriptIndex } from '../types/schema';

/**
 * Analysis Request Status
 */
export type AnalysisSection = 'pacing' | 'characters' | 'plot' | 'setting' | 'summary';

export interface AnalysisStatus {
  pacing: 'idle' | 'loading' | 'complete' | 'error';
  characters: 'idle' | 'loading' | 'complete' | 'error';
  plot: 'idle' | 'loading' | 'complete' | 'error';
  setting: 'idle' | 'loading' | 'complete' | 'error';
  summary: 'idle' | 'loading' | 'complete' | 'error';
}

/**
 * Incremental Analysis Result
 * Each section can be updated independently
 */
export interface IncrementalAnalysis {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  pacing?: AnalysisResult['pacing'];
  plotIssues?: AnalysisResult['plotIssues'];
  characters?: CharacterProfile[];
  settingAnalysis?: AnalysisResult['settingAnalysis'];
  generalSuggestions?: string[];
}

interface AnalysisContextValue {
  // Full analysis result (for backward compat)
  analysis: AnalysisResult | null;
  setAnalysis: (result: AnalysisResult | null) => void;
  
  // Incremental analysis state
  incrementalAnalysis: IncrementalAnalysis;
  analysisStatus: AnalysisStatus;
  
  // Plot suggestions
  plotSuggestions: PlotSuggestion[];
  setPlotSuggestions: (suggestions: PlotSuggestion[]) => void;
  
  // Loading state
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  
  // Incremental analysis methods (Request Queue)
  analyzePacing: (text: string, setting?: { timePeriod: string; location: string }) => Promise<void>;
  analyzeCharacters: (text: string, manuscriptIndex?: ManuscriptIndex) => Promise<void>;
  analyzePlot: (text: string) => Promise<void>;
  analyzeSetting: (text: string, setting: { timePeriod: string; location: string }) => Promise<void>;
  
  // Full analysis (parallel)
  runFullAnalysis: (
    text: string, 
    setting?: { timePeriod: string; location: string },
    manuscriptIndex?: ManuscriptIndex
  ) => Promise<AnalysisResult>;
  
  // Reset
  clearAnalysis: () => void;
  
  // Abort
  abortAnalysis: () => void;
}

const INITIAL_STATUS: AnalysisStatus = {
  pacing: 'idle',
  characters: 'idle',
  plot: 'idle',
  setting: 'idle',
  summary: 'idle'
};

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [incrementalAnalysis, setIncrementalAnalysis] = useState<IncrementalAnalysis>({});
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(INITIAL_STATUS);
  const [plotSuggestions, setPlotSuggestions] = useState<PlotSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update a single status field
  const updateStatus = useCallback((section: AnalysisSection, status: 'idle' | 'loading' | 'complete' | 'error') => {
    setAnalysisStatus(prev => ({ ...prev, [section]: status }));
  }, []);

  // Merge incremental results
  const mergeAnalysis = useCallback((partial: Partial<IncrementalAnalysis>) => {
    setIncrementalAnalysis(prev => ({ ...prev, ...partial }));
  }, []);

  // Individual analysis methods for incremental loading
  const analyzePacing = useCallback(async (text: string, setting?: { timePeriod: string; location: string }) => {
    updateStatus('pacing', 'loading');
    try {
      const result = await fetchPacingAnalysis(text, setting, abortControllerRef.current?.signal);
      mergeAnalysis({ pacing: result.pacing, generalSuggestions: result.generalSuggestions });
      updateStatus('pacing', 'complete');
    } catch (e) {
      console.error('[AnalysisContext] Pacing analysis failed:', e);
      updateStatus('pacing', 'error');
    }
  }, [updateStatus, mergeAnalysis]);

  const analyzeCharacters = useCallback(async (text: string, manuscriptIndex?: ManuscriptIndex) => {
    updateStatus('characters', 'loading');
    try {
      const result = await fetchCharacterAnalysis(text, manuscriptIndex, abortControllerRef.current?.signal);
      mergeAnalysis({ characters: result.characters });
      updateStatus('characters', 'complete');
    } catch (e) {
      console.error('[AnalysisContext] Character analysis failed:', e);
      updateStatus('characters', 'error');
    }
  }, [updateStatus, mergeAnalysis]);

  const analyzePlot = useCallback(async (text: string) => {
    updateStatus('plot', 'loading');
    try {
      const result = await fetchPlotAnalysis(text, abortControllerRef.current?.signal);
      mergeAnalysis({ 
        plotIssues: result.plotIssues, 
        summary: result.summary,
        strengths: result.strengths,
        weaknesses: result.weaknesses
      });
      updateStatus('plot', 'complete');
      updateStatus('summary', 'complete');
    } catch (e) {
      console.error('[AnalysisContext] Plot analysis failed:', e);
      updateStatus('plot', 'error');
    }
  }, [updateStatus, mergeAnalysis]);

  const analyzeSetting = useCallback(async (text: string, setting: { timePeriod: string; location: string }) => {
    updateStatus('setting', 'loading');
    try {
      const result = await fetchSettingAnalysis(text, setting, abortControllerRef.current?.signal);
      mergeAnalysis({ settingAnalysis: result.settingAnalysis });
      updateStatus('setting', 'complete');
    } catch (e) {
      console.error('[AnalysisContext] Setting analysis failed:', e);
      updateStatus('setting', 'error');
    }
  }, [updateStatus, mergeAnalysis]);

  // Run all analyses in parallel
  const runFullAnalysis = useCallback(async (
    text: string,
    setting?: { timePeriod: string; location: string },
    manuscriptIndex?: ManuscriptIndex
  ): Promise<AnalysisResult> => {
    // Cancel any pending requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsAnalyzing(true);
    setAnalysisStatus({
      pacing: 'loading',
      characters: 'loading',
      plot: 'loading',
      setting: setting ? 'loading' : 'idle',
      summary: 'loading'
    });

    try {
      // Run analyses in parallel
      const promises = [
        fetchPacingAnalysis(text, setting, abortControllerRef.current.signal),
        fetchCharacterAnalysis(text, manuscriptIndex, abortControllerRef.current.signal),
        fetchPlotAnalysis(text, abortControllerRef.current.signal),
        setting ? fetchSettingAnalysis(text, setting, abortControllerRef.current.signal) : Promise.resolve(null)
      ];

      const [pacingResult, characterResult, plotResult, settingResult] = await Promise.all(promises);

      // Merge into full result
      const fullResult: AnalysisResult = {
        summary: plotResult.summary,
        strengths: plotResult.strengths,
        weaknesses: plotResult.weaknesses,
        pacing: pacingResult.pacing,
        plotIssues: plotResult.plotIssues,
        characters: characterResult.characters,
        settingAnalysis: settingResult?.settingAnalysis,
        generalSuggestions: pacingResult.generalSuggestions
      };

      // Update all states
      setAnalysis(fullResult);
      setIncrementalAnalysis(fullResult);
      setAnalysisStatus({
        pacing: 'complete',
        characters: 'complete',
        plot: 'complete',
        setting: setting ? 'complete' : 'idle',
        summary: 'complete'
      });

      return fullResult;
    } catch (e) {
      console.error('[AnalysisContext] Full analysis failed:', e);
      throw e;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setIncrementalAnalysis({});
    setAnalysisStatus(INITIAL_STATUS);
    setPlotSuggestions([]);
  }, []);

  const abortAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsAnalyzing(false);
  }, []);

  const value: AnalysisContextValue = {
    analysis,
    setAnalysis,
    incrementalAnalysis,
    analysisStatus,
    plotSuggestions,
    setPlotSuggestions,
    isAnalyzing,
    setIsAnalyzing,
    analyzePacing,
    analyzeCharacters,
    analyzePlot,
    analyzeSetting,
    runFullAnalysis,
    clearAnalysis,
    abortAnalysis
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("useAnalysis must be used within AnalysisProvider");
  return context;
};
