import { useState, useCallback, useRef, useEffect } from 'react';
import { generatePlotIdeas } from '../services/geminiService';
import { PlotSuggestion } from '../types';

export function usePlotSuggestions(currentText: string) {
  const [suggestions, setSuggestions] = useState<PlotSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const generate = useCallback(async (query: string, type: string) => {
    if (!currentText?.trim()) return;
    setIsLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      const ideas = await generatePlotIdeas(currentText, query, type);
      if (!abortRef.current) {
        setSuggestions(ideas);
      }
    } catch (e) {
      if (!abortRef.current) {
        console.error("Failed to generate plot ideas", e);
        setError("Failed to generate ideas. Please try again.");
      }
    } finally {
      if (!abortRef.current) setIsLoading(false);
    }
  }, [currentText]);

  return { suggestions, isLoading, error, generate };
}