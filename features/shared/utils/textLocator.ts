import { diff_match_patch } from 'diff-match-patch';
import { AnalysisResult } from '@/types';

export interface TextRange {
  start: number;
  end: number;
}

const whitespaceRegex = /\s/;

interface NormalizedSegment {
  char: string;
  start: number;
  end: number;
}

const buildNormalizedMap = (text: string): NormalizedSegment[] => {
  const segments: NormalizedSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const char = text[cursor];

    if (whitespaceRegex.test(char)) {
      const blockStart = cursor;
      while (cursor < text.length && whitespaceRegex.test(text[cursor])) {
        cursor++;
      }
      segments.push({ char: ' ', start: blockStart, end: cursor });
    } else {
      segments.push({ char, start: cursor, end: cursor + 1 });
      cursor++;
    }
  }

  return segments;
};

const buildNormalizedString = (segments: NormalizedSegment[]): string =>
  segments.map(segment => segment.char).join('');

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
  map: NormalizedSegment[],
  normalizedStart: number,
  normalizedLength: number,
  maxLength: number
): TextRange | null => {
  if (!map.length || normalizedLength === 0) {
    return null;
  }

  const endIndex = normalizedStart + normalizedLength - 1;
  if (endIndex >= map.length) {
    return null;
  }

  const startSegment = map[normalizedStart];
  const endSegment = map[endIndex];

  if (!startSegment || !endSegment) {
    return null;
  }

  const start = Math.max(0, startSegment.start);
  const end = Math.min(maxLength, endSegment.end);

  if (start >= end) {
    return null;
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

  const exactIndex = fullText.indexOf(quote);
  if (exactIndex !== -1) {
    return clampRange(exactIndex, quote.length, fullText.length);
  }

  const trimmedIndex = fullText.indexOf(trimmedQuote);
  if (trimmedIndex !== -1) {
    return clampRange(trimmedIndex, trimmedQuote.length, fullText.length);
  }

  if (trimmedQuote.length > 20) {
    const partial = trimmedQuote.substring(0, 20);
    const partialIndex = fullText.indexOf(partial);
    if (partialIndex !== -1) {
      return clampRange(partialIndex, trimmedQuote.length, fullText.length);
    }
  }

  // Try normalized search first (better for whitespace differences)
  const matcher = new diff_match_patch();
  const normalizedQuote = collapseWhitespace(trimmedQuote);

  if (normalizedQuote) {
    const normalizedMap = buildNormalizedMap(fullText);
    if (normalizedMap.length) {
      const normalizedFull = buildNormalizedString(normalizedMap);
      if (normalizedFull) {
        try {
          const normalizedIndex = matcher.match_main(normalizedFull, normalizedQuote, 0);
          if (normalizedIndex !== -1) {
            const normalizedRange = mapNormalizedRangeToOriginal(
              normalizedMap,
              normalizedIndex,
              normalizedQuote.length,
              fullText.length
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
  }

  // Fallback to direct fuzzy search (better for typos)
  try {
    const fuzzyIndex = matcher.match_main(fullText, trimmedQuote, 0);
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
