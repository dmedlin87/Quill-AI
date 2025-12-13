import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UsageMetadata } from "@google/genai";
import { getModelPricing } from '@/config/models';

interface UsageContextValue {
  promptTokens: number;
  responseTokens: number;
  totalRequestCount: number;
  totalCost: number;
  sessionCost: number;
  trackUsage: (usage: UsageMetadata, modelId: string) => void;
  resetUsage: () => void;
}

interface StoredUsageStats {
  prompt?: number;
  response?: number;
  requests?: number;
  cost?: number;
}

// Helper to check if an object is a valid StoredUsageStats
function isStoredUsageStats(obj: unknown): obj is StoredUsageStats {
  return typeof obj === 'object' && obj !== null;
}

const UsageContext = createContext<UsageContextValue | undefined>(undefined);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promptTokens, setPromptTokens] = useState(0);
  const [responseTokens, setResponseTokens] = useState(0);
  const [totalRequestCount, setTotalRequestCount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [sessionBaselineCost, setSessionBaselineCost] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('quillai_usage');
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);

      if (!isStoredUsageStats(parsed)) {
        console.warn('Invalid usage stats shape in localStorage, resetting.');
        return;
      }

      const prompt = typeof parsed.prompt === 'number' && Number.isFinite(parsed.prompt)
        ? parsed.prompt
        : 0;
      const response = typeof parsed.response === 'number' && Number.isFinite(parsed.response)
        ? parsed.response
        : 0;
      const requests = typeof parsed.requests === 'number' && Number.isFinite(parsed.requests)
        ? parsed.requests
        : 0;
      const cost = typeof parsed.cost === 'number' && Number.isFinite(parsed.cost)
        ? parsed.cost
        : 0;

      setPromptTokens(prompt);
      setResponseTokens(response);
      setTotalRequestCount(requests);
      setTotalCost(cost);
      setSessionBaselineCost(cost);
    } catch (e) {
      console.error('Failed to parse usage stats', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quillai_usage', JSON.stringify({
      prompt: promptTokens,
      response: responseTokens,
      requests: totalRequestCount,
      cost: totalCost
    }));
  }, [promptTokens, responseTokens, totalRequestCount, totalCost]);

  const trackUsage = useCallback((usage: UsageMetadata, modelId: string) => {
    if (!usage) return;

    const promptDelta = usage.promptTokenCount || 0;

    // Check if candidatesTokenCount exists (some versions of the SDK might have it)
    // or calculate from total - prompt
    let candidates = 0;
    if ('candidatesTokenCount' in usage && typeof (usage as any).candidatesTokenCount === 'number') {
        candidates = (usage as any).candidatesTokenCount;
    } else {
        candidates = (usage.totalTokenCount || 0) - (usage.promptTokenCount || 0);
    }

    const responseDelta = candidates || 0;

    // Always track raw token usage and request count
    setPromptTokens(prev => prev + promptDelta);
    setResponseTokens(prev => prev + responseDelta);
    setTotalRequestCount(prev => prev + 1);

    if (!modelId) {
      console.warn('[UsageContext] trackUsage called without a modelId. Token usage will be tracked, but cost will not be computed.');
      return;
    }

    const pricing = getModelPricing(modelId);
    if (!pricing) {
      console.warn(`[UsageContext] No pricing configured for modelId="${modelId}". Token usage will be tracked, but cost will not be computed for this model.`);
      return;
    }

    const costIncrement =
      (promptDelta / 1_000_000) * pricing.inputPrice +
      (responseDelta / 1_000_000) * pricing.outputPrice;

    // Round to 4 decimal places to limit floating-point drift over many updates
    setTotalCost(prev => Math.round((prev + costIncrement) * 10_000) / 10_000);
  }, []);

  const sessionCost = Math.max(0, totalCost - sessionBaselineCost);

  const resetUsage = useCallback(() => {
    setPromptTokens(0);
    setResponseTokens(0);
    setTotalRequestCount(0);
    setTotalCost(0);
    setSessionBaselineCost(0);
  }, []);

  return (
    <UsageContext.Provider value={{ promptTokens, responseTokens, totalRequestCount, totalCost, sessionCost, trackUsage, resetUsage }}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (!context) throw new Error('useUsage must be used within UsageProvider');
  return context;
};
