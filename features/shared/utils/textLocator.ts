import { diff_match_patch } from 'diff-match-patch';
import { AnalysisResult } from '@/types';

export interface TextRange {
  start: number;
  end: number;
}

const whitespaceRegex = /\s/;

// Global matcher instance to avoid re-instantiation overhead
const sharedMatcher = new diff_match_patch();

const buildNormalizedMap = (text: string) => {
  const len = text.length;
  // Use a string concatenation for normalized text and array for mapping.
  // This avoids creating thousands of small objects.
  let normalizedStr = "";
  // mapping[i] stores the original start index for the character at normalizedStr[i]
  const mapping: number[] = [];

  let cursor = 0;
  while (cursor < len) {
    const char = text[cursor];

    if (whitespaceRegex.test(char)) {
      const blockStart = cursor;
      while (cursor < len && whitespaceRegex.test(text[cursor])) {
        cursor++;
      }
      normalizedStr += " ";
      mapping.push(blockStart);
    } else {
      normalizedStr += char;
      mapping.push(cursor);
      cursor++;
    }
  }

  return { normalizedStr, mapping, originalLength: len };
};

const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ');

const clampRange = (start: number, length: number, maxLength: number): TextRange | null => {
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(maxLength, clampedStart + length);

  if (clampedStart >= clampedEnd) {
    return null;
  }

  return { start: clampedStart, end: clampedEnd };
};

const mapNormalizedRangeToOriginal = (
  mapping: number[],
  originalLength: number,
  normalizedStart: number,
  normalizedLength: number,
): TextRange | null => {
  if (normalizedLength === 0) {
    return null;
  }

  // Last index in the normalized match
  const normalizedEndIndex = normalizedStart + normalizedLength - 1;

  if (normalizedStart < 0 || normalizedEndIndex >= mapping.length) {
    return null;
  }

  const start = mapping[normalizedStart];

  // Calculate end position
  // If we are not at the very end of the normalized string, we can look at the next mapping item
  // or calculate based on the current mapping item.
  // However, normalized characters usually map 1:1 except for whitespace blocks.
  // If normalized[normalizedEndIndex] is a character, it ends at mapping[normalizedEndIndex] + 1.
  // If it is a space, it ends after the whitespace block.
  // The easiest way is to find the start of the *next* character in normalized string,
  // or if it's the last one, use originalLength.

  let end: number;
  if (normalizedEndIndex + 1 < mapping.length) {
    end = mapping[normalizedEndIndex + 1];
  } else {
    end = originalLength;
  }

  return { start, end };
};

/**
 * Attempts to find the best match for a quote within the text.
 * It handles slight whitespace variations or LLM hallucinations (prefix matching).
 */
export const findQuoteRange = (fullText: string, quote: string): TextRange | null => {
  if (!fullText || !quote) return null;

  const trimmedQuote = quote.trim();
  if (!trimmedQuote) return null;

  // 1. Exact match
  const exactIndex = fullText.indexOf(quote);
  if (exactIndex !== -1) {
    return clampRange(exactIndex, quote.length, fullText.length);
  }

  // 2. Trimmed match
  const trimmedIndex = fullText.indexOf(trimmedQuote);
  if (trimmedIndex !== -1) {
    return clampRange(trimmedIndex, trimmedQuote.length, fullText.length);
  }

  // 3. Partial match (first 20 chars)
  if (trimmedQuote.length > 20) {
    const partial = trimmedQuote.substring(0, 20);
    const partialIndex = fullText.indexOf(partial);
    if (partialIndex !== -1) {
      return clampRange(partialIndex, trimmedQuote.length, fullText.length);
    }
  }

  // 4. Normalized search (collapsed whitespace)
  // This is expensive, so we only do it if simpler checks fail
  const normalizedQuote = collapseWhitespace(trimmedQuote);

  if (normalizedQuote) {
    const { normalizedStr, mapping, originalLength } = buildNormalizedMap(fullText);

    if (normalizedStr) {
      try {
        const normalizedIndex = sharedMatcher.match_main(normalizedStr, normalizedQuote, 0);
        if (normalizedIndex !== -1) {
          const normalizedRange = mapNormalizedRangeToOriginal(
            mapping,
            originalLength,
            normalizedIndex,
            normalizedQuote.length,
          );
          if (normalizedRange) {
            return normalizedRange;
          }
        }
      } catch (e) {
        // Ignore normalized fuzzy match errors
      }
    }
  }

  // 5. Direct fuzzy search (better for typos)
  // Fallback if normalized search didn't work (or if logic flow reaches here)
  try {
    const fuzzyIndex = sharedMatcher.match_main(fullText, trimmedQuote, 0);
    if (fuzzyIndex !== -1) {
      return clampRange(fuzzyIndex, trimmedQuote.length, fullText.length);
    }
  } catch (e) {
    // Ignore fuzzy match errors (e.g. pattern too long)
  }

  return null;
};

/**
 * Enriches an AnalysisResult with position indices for all quotes.
 * This enables deep-linking from analysis cards to text positions.
 */
export const enrichAnalysisWithPositions = (
  analysis: AnalysisResult,
  fullText: string
): AnalysisResult => {
  // Deep clone to avoid mutation
  const enriched = JSON.parse(JSON.stringify(analysis)) as AnalysisResult;

  // Enrich plot issues
  enriched.plotIssues = enriched.plotIssues.map(issue => {
    if (issue.quote) {
      const range = findQuoteRange(fullText, issue.quote);
      if (range) {
        return { ...issue, startIndex: range.start, endIndex: range.end };
      }
    }
    return issue;
  });

  // Enrich setting issues
  if (enriched.settingAnalysis?.issues) {
    enriched.settingAnalysis.issues = enriched.settingAnalysis.issues.map(issue => {
      const range = findQuoteRange(fullText, issue.quote);
      if (range) {
        return { ...issue, startIndex: range.start, endIndex: range.end };
      }
      return issue;
    });
  }

  // Enrich character inconsistencies
  enriched.characters = enriched.characters.map(character => ({
    ...character,
    inconsistencies: character.inconsistencies.map(inc => {
      if (inc.quote) {
        const range = findQuoteRange(fullText, inc.quote);
        if (range) {
          return { ...inc, startIndex: range.start, endIndex: range.end };
        }
      }
      return inc;
    })
  }));

  return enriched;
};

/**
 * Get a clickable issue with resolved position
 */
export interface ClickableIssue {
  type: 'plot' | 'setting' | 'character';
  issue: string;
  suggestion?: string;
  quote?: string;
  range: TextRange | null;
}

/**
 * Extract all clickable issues from an analysis result
 */
export const extractClickableIssues = (
  analysis: AnalysisResult,
  fullText: string
): ClickableIssue[] => {
  const issues: ClickableIssue[] = [];

  // Plot issues
  analysis.plotIssues.forEach(issue => {
    issues.push({
      type: 'plot',
      issue: issue.issue,
      suggestion: issue.suggestion,
      quote: issue.quote,
      range: issue.quote ? findQuoteRange(fullText, issue.quote) : null
    });
  });

  // Setting issues
  analysis.settingAnalysis?.issues.forEach(issue => {
    issues.push({
      type: 'setting',
      issue: issue.issue,
      suggestion: issue.suggestion,
      quote: issue.quote,
      range: findQuoteRange(fullText, issue.quote)
    });
  });

  // Character inconsistencies
  analysis.characters.forEach(char => {
    char.inconsistencies.forEach(inc => {
      issues.push({
        type: 'character',
        issue: `${char.name}: ${inc.issue}`,
        quote: inc.quote,
        range: inc.quote ? findQuoteRange(fullText, inc.quote) : null
      });
    });
  });

  return issues;
};
