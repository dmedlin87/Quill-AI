import { useState, useRef, useCallback } from 'react';
import { analyzeDraft, rewriteText, getContextualHelp } from '../services/geminiService';
import { AnalysisResult } from '../types';
import { Lore, ManuscriptIndex } from '../types/schema';

// Define proper types
interface ProjectContext {
  id: string;
  setting?: {
    timePeriod: string;
    location: string;
  };
  manuscriptIndex?: ManuscriptIndex;
}

interface SelectionRange {
  start: number;
  end: number;
  text: string;
}

type AgentAction = 
  | { action: 'update_manuscript'; params: { search_text: string; replacement_text: string; description?: string } }
  | { action: 'append_to_manuscript'; params: { text_to_add: string; description?: string } }
  | { action: 'undo_last_change'; params?: undefined };

interface UseDraftSmithEngineProps {
  // Use refs for values that need to be current in async operations
  getCurrentText: () => string;
  currentProject: ProjectContext | null;
  activeChapterId: string | null;
  updateChapterAnalysis: (id: string, result: AnalysisResult) => Promise<void>;
  updateProjectLore: (projectId: string, lore: Lore) => Promise<void>;
  commit: (text: string, desc: string, author: 'User' | 'Agent') => void;
  selectionRange: SelectionRange | null;
  clearSelection: () => void;
}

export interface PendingDiff {
  original: string;
  modified: string;
  description: string;
  author: 'User' | 'Agent';
}

const calculateTextReplacement = (
  originalText: string, 
  searchText: string, 
  replacementText: string
): string => {
  const occurrences = originalText.split(searchText).length - 1;
  if (occurrences === 0) {
    throw new Error("Could not find the exact text to replace. Please be more specific.");
  }
  if (occurrences > 1) {
    throw new Error(`Found ${occurrences} matches for that text. Please provide more context.`);
  }
  return originalText.replace(searchText, replacementText);
};

export function useDraftSmithEngine({
  getCurrentText,
  currentProject,
  activeChapterId,
  updateChapterAnalysis,
  updateProjectLore,
  commit,
  selectionRange,
  clearSelection
}: UseDraftSmithEngineProps) {
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  // Magic Editor State
  const [magicVariations, setMagicVariations] = useState<string[]>([]);
  const [magicHelpResult, setMagicHelpResult] = useState<string | null>(null);
  const [magicHelpType, setMagicHelpType] = useState<'Explain' | 'Thesaurus' | null>(null);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const magicAbortRef = useRef<AbortController | null>(null);

  // Review Mode State
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);

  // Capture selection at operation start to detect staleness
  const operationSelectionRef = useRef<SelectionRange | null>(null);

  // Stable ref for project setting
  const projectSetting = currentProject?.setting;
  const projectId = currentProject?.id;
  const manuscriptIndex = currentProject?.manuscriptIndex;

  // --- 1. Analysis Logic ---
  const runAnalysis = useCallback(async () => {
    const text = getCurrentText();
    const chapterId = activeChapterId;
    
    if (!text.trim() || !chapterId) return;
    
    // Cancel any in-flight analysis
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = new AbortController();
    const signal = analysisAbortRef.current.signal;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await analyzeDraft(text, projectSetting, manuscriptIndex, signal);
      
      if (signal.aborted) return;
      
      // Verify chapter hasn't changed during async operation
      if (chapterId !== activeChapterId) {
        console.warn('Chapter changed during analysis, discarding result');
        return;
      }
      
      await updateChapterAnalysis(chapterId, result);

      // --- LORE BIBLE UPDATE (Legacy) ---
      // We still update Lore for backward compatibility with the Chat Agent
      if (projectId) {
          const worldRules = result.settingAnalysis?.issues.map(i => `Avoid ${i.issue}: ${i.suggestion}`) || [];
          const lore: Lore = {
              characters: result.characters,
              worldRules: worldRules
          };
          await updateProjectLore(projectId, lore);
      }

    } catch (e) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Analysis failed';
      setAnalysisError(message);
      console.error("Analysis failed", e);
    } finally {
      if (!signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  }, [getCurrentText, activeChapterId, projectSetting, manuscriptIndex, projectId, updateChapterAnalysis, updateProjectLore]);

  const cancelAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
    setIsAnalyzing(false);
  }, []);

  // --- 2. Magic Editor Logic ---
  const abortMagicOperation = useCallback(() => {
    magicAbortRef.current?.abort();
    magicAbortRef.current = null;
  }, []);

  const resetMagicState = useCallback(() => {
    setMagicVariations([]);
    setMagicHelpResult(null);
    setMagicHelpType(null);
    setMagicError(null);
    operationSelectionRef.current = null;
  }, []);

  const handleRewrite = useCallback(async (mode: string, tone?: string) => {
    if (!selectionRange) return;
    
    // Abort previous operation
    abortMagicOperation();
    magicAbortRef.current = new AbortController();
    const signal = magicAbortRef.current.signal;
    
    // Capture selection state at start
    operationSelectionRef.current = { ...selectionRange };
    
    resetMagicState();
    setIsMagicLoading(true);

    try {
      const variations = await rewriteText(
        selectionRange.text, 
        mode, 
        tone, 
        projectSetting,
        signal // pass signal to service
      );
      
      if (signal.aborted) return;
      
      setMagicVariations(variations);
    } catch (e) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Rewrite failed';
      setMagicError(message);
      console.error(e);
    } finally {
      if (!signal.aborted) {
        setIsMagicLoading(false);
      }
    }
  }, [selectionRange, projectSetting, abortMagicOperation, resetMagicState]);

  const handleHelp = useCallback(async (type: 'Explain' | 'Thesaurus') => {
    if (!selectionRange) return;
    
    abortMagicOperation();
    magicAbortRef.current = new AbortController();
    const signal = magicAbortRef.current.signal;
    
    operationSelectionRef.current = { ...selectionRange };
    
    resetMagicState();
    setMagicHelpType(type);
    setIsMagicLoading(true);

    try {
      const result = await getContextualHelp(selectionRange.text, type, signal);
      
      if (signal.aborted) return;
      
      setMagicHelpResult(result);
    } catch (e) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Help request failed';
      setMagicError(message);
      console.error(e);
    } finally {
      if (!signal.aborted) {
        setIsMagicLoading(false);
      }
    }
  }, [selectionRange, abortMagicOperation, resetMagicState]);

  const closeMagicBar = useCallback(() => {
    abortMagicOperation();
    resetMagicState();
    // Note: caller should decide whether to clear selection
  }, [abortMagicOperation, resetMagicState]);

  const applyVariation = useCallback((newText: string) => {
    const currentText = getCurrentText();
    const capturedSelection = operationSelectionRef.current;
    
    if (!capturedSelection) {
      setMagicError('No selection to apply to');
      return;
    }
    
    // Validate selection is still valid
    const expectedText = currentText.substring(
      capturedSelection.start, 
      capturedSelection.end
    );
    
    if (expectedText !== capturedSelection.text) {
      setMagicError('Text has changed since selection. Please re-select and try again.');
      closeMagicBar();
      clearSelection();
      return;
    }
    
    const before = currentText.substring(0, capturedSelection.start);
    const after = currentText.substring(capturedSelection.end);
    const updated = before + newText + after;

    const description = magicVariations.length > 0 
      ? 'Magic Edit: Variation Applied' 
      : 'Magic Edit: Context Replacement';
    
    commit(updated, description, 'User');
    closeMagicBar();
    clearSelection();
  }, [getCurrentText, commit, magicVariations.length, closeMagicBar, clearSelection]);


  // --- 3. Agent Logic ---
  
  const acceptDiff = useCallback(() => {
    if (pendingDiff) {
        commit(pendingDiff.modified, pendingDiff.description, pendingDiff.author);
        setPendingDiff(null);
    }
  }, [pendingDiff, commit]);

  const rejectDiff = useCallback(() => {
    setPendingDiff(null);
  }, []);

  const handleAgentAction = useCallback(async (
    action: AgentAction['action'], 
    params: AgentAction['params']
  ): Promise<string> => {
    // Get fresh text for agent operations
    const currentText = getCurrentText();
    
    if (action === 'update_manuscript') {
      const { search_text, replacement_text, description } = params as Extract<AgentAction, { action: 'update_manuscript' }>['params'];
      try {
        const newText = calculateTextReplacement(currentText, search_text, replacement_text);
        
        // Instead of committing, set pending state for review
        setPendingDiff({
          original: currentText,
          modified: newText,
          description: description || "Agent Edit",
          author: 'Agent'
        });
        
        return "Edit proposed. Waiting for user review.";
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(message);
      }
    }

    if (action === 'append_to_manuscript') {
      const { text_to_add, description } = params as Extract<AgentAction, { action: 'append_to_manuscript' }>['params'];
      
      // Smart newline handling
      const separator = currentText.length === 0 
        ? '' 
        : currentText.endsWith('\n') 
          ? '' 
          : '\n';
      
      const newText = currentText + separator + text_to_add;
      
      // Instead of committing, set pending state for review
      setPendingDiff({
          original: currentText,
          modified: newText,
          description: description || "Agent Append",
          author: 'Agent'
      });
      
      return "Edit proposed. Waiting for user review.";
    }

    if (action === 'undo_last_change') {
      return "Use the interface undo button for now.";
    }

    return "Unknown action.";
  }, [getCurrentText]);

  return {
    state: {
      isAnalyzing,
      analysisError,
      magicVariations,
      magicHelpResult,
      magicHelpType,
      isMagicLoading,
      magicError,
      pendingDiff,
    },
    actions: {
      runAnalysis,
      cancelAnalysis,
      handleRewrite,
      handleHelp,
      applyVariation,
      closeMagicBar,
      handleAgentAction,
      acceptDiff,
      rejectDiff
    }
  };
}