/**
 * Grammar suggestion normalization utilities.
 * Transforms raw grammar suggestions into document-relative positions
 * and generates corresponding highlight items.
 */

import { GrammarSuggestion } from '@/types';
import { HighlightItem } from '@/features/editor/hooks/useTiptapSync';

export interface GrammarNormalizationResult {
  suggestions: GrammarSuggestion[];
  highlights: HighlightItem[];
}

/**
 * Normalizes grammar suggestions from selection-relative offsets to
 * document-relative offsets, and generates corresponding highlight items.
 *
 * @param suggestions - Raw grammar suggestions with selection-relative positions
 * @param selectionStart - The start position of the selection in the document
 * @param selectionText - The original selected text for extracting originalText
 * @returns Normalized suggestions and highlight items
 *
 * @example
 * ```ts
 * const { suggestions, highlights } = normalizeGrammarSuggestions(
 *   rawSuggestions,
 *   selectionRange.start,
 *   selectionRange.text
 * );
 * setGrammarSuggestions(suggestions);
 * setGrammarHighlights(highlights);
 * ```
 */
export function normalizeGrammarSuggestions(
  suggestions: GrammarSuggestion[],
  selectionStart: number,
  selectionText: string
): GrammarNormalizationResult {
  const normalized = suggestions.map(s => ({
    ...s,
    start: s.start + selectionStart,
    end: s.end + selectionStart,
    originalText: s.originalText ?? selectionText.slice(s.start, s.end),
  }));

  const highlights: HighlightItem[] = normalized.map(s => ({
    start: s.start,
    end: s.end,
    color: 'var(--error-500)',
    title: s.message,
    severity: s.severity === 'style' ? 'warning' as const : 'error' as const,
  }));

  return { suggestions: normalized, highlights };
}

/**
 * Maps a grammar suggestion severity to a highlight severity.
 *
 * @param severity - The grammar suggestion severity ('grammar' | 'style')
 * @returns The corresponding highlight severity
 */
export function mapGrammarSeverityToHighlight(
  severity?: 'grammar' | 'style'
): 'error' | 'warning' {
  return severity === 'style' ? 'warning' : 'error';
}
