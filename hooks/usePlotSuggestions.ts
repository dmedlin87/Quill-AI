import { useState, useCallback, useRef } from 'react';
import { generatePlotIdeas } from '../services/gemini/analysis';
import { PlotSuggestion } from '../types';
import { useUsage } from '../contexts/UsageContext';

export function usePlotSuggestions(currentText: string) {
  const [suggestions, setSuggestions] = useState<PlotSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackUsage } = useUsage();
  
  // Track the latest request ID to handle race conditions
  const requestIdRef = useRef(0);

  const generate = useCallback(async (query: string, type: string) => {
    if (!currentText?.trim()) return;
    
    // Increment request ID for this new call
    const requestId = ++requestIdRef.current;
    
    setIsLoading(true);
    setError(null);

    try {
      const { result: ideas, usage } = await generatePlotIdeas(currentText, query, type);
      trackUsage(usage);
      
      // Only update state if this is still the most recent request
      if (requestId === requestIdRef.current) {
        setSuggestions(ideas);
      }
    } catch (e) {
      if (requestId === requestIdRef.current) {
        console.error("Failed to generate plot ideas", e);
        setError("Failed to generate ideas. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentText, trackUsage]);

  return { suggestions, isLoading, error, generate };
}
