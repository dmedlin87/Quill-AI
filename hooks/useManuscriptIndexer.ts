import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { extractEntities, mergeIntoIndex, createEmptyIndex } from '../services/manuscriptIndexer';
import { Contradiction } from '../types/schema';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export function useManuscriptIndexer(
  currentText: string,
  chapterId: string | null,
  onContradiction: (c: Contradiction[]) => void
) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const lastIndexedHashRef = useRef<string>('');
  
  const { currentProject, updateManuscriptIndex } = useProjectStore();
  
  const runIndexing = useCallback(async () => {
    if (!chapterId || !currentProject) return;
    
    // Simple content hash to avoid redundant work
    const hash = simpleHash(currentText);
    if (hash === lastIndexedHashRef.current) return;
    
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    
    try {
      const extraction = await extractEntities(
        currentText, 
        chapterId, 
        abortRef.current.signal
      );
      
      const existingIndex = currentProject.manuscriptIndex || createEmptyIndex();
      const { updatedIndex, contradictions } = mergeIntoIndex(
        existingIndex, 
        extraction, 
        chapterId
      );
      
      // Persist
      await updateManuscriptIndex(currentProject.id, updatedIndex);
      lastIndexedHashRef.current = hash;
      
      // Surface contradictions
      if (contradictions.length > 0) {
        onContradiction(contradictions);
      }
      
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Indexing failed:', e);
      }
    }
  }, [currentText, chapterId, currentProject, updateManuscriptIndex, onContradiction]);
  
  // Trigger on idle (5s after last keystroke)
  useEffect(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(runIndexing, 5000);
    
    return () => clearTimeout(idleTimerRef.current);
  }, [currentText, runIndexing]);
  
  // Also trigger on chapter switch
  useEffect(() => {
    runIndexing();
  }, [chapterId]);
}