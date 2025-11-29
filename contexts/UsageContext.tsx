import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UsageMetadata } from "@google/genai";

interface UsageContextValue {
  promptTokens: number;
  responseTokens: number;
  totalRequestCount: number;
  trackUsage: (usage?: UsageMetadata) => void;
  resetUsage: () => void;
}

const UsageContext = createContext<UsageContextValue | undefined>(undefined);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promptTokens, setPromptTokens] = useState(0);
  const [responseTokens, setResponseTokens] = useState(0);
  const [totalRequestCount, setTotalRequestCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('draftsmith_usage');
    if (stored) {
      try {
        const { prompt, response, requests } = JSON.parse(stored);
        setPromptTokens(prompt || 0);
        setResponseTokens(response || 0);
        setTotalRequestCount(requests || 0);
      } catch (e) {
        console.error("Failed to parse usage stats", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('draftsmith_usage', JSON.stringify({
      prompt: promptTokens,
      response: responseTokens,
      requests: totalRequestCount
    }));
  }, [promptTokens, responseTokens, totalRequestCount]);

  const trackUsage = useCallback((usage?: UsageMetadata) => {
    if (!usage) return;
    setPromptTokens(prev => prev + (usage.promptTokenCount || 0));
    // Use type assertion to access candidatesTokenCount if missing from type definition
    // Fallback to calculation from totalTokenCount if needed
    const candidates = (usage as any).candidatesTokenCount ?? 
                       ((usage.totalTokenCount || 0) - (usage.promptTokenCount || 0));
    setResponseTokens(prev => prev + (candidates || 0));
    setTotalRequestCount(prev => prev + 1);
  }, []);

  const resetUsage = useCallback(() => {
    setPromptTokens(0);
    setResponseTokens(0);
    setTotalRequestCount(0);
  }, []);

  return (
    <UsageContext.Provider value={{ promptTokens, responseTokens, totalRequestCount, trackUsage, resetUsage }}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (!context) throw new Error('useUsage must be used within UsageProvider');
  return context;
};