import { UsageMetadata, Type } from '@google/genai';
import { GrammarSuggestion } from '@/types';
import { ModelConfig } from '@/config/models';
import { ai } from './client';
import { safeParseJson } from './resilientParser';

interface GrammarResponse {
  suggestions: GrammarSuggestion[];
  usage?: UsageMetadata;
}

export type LLMGrammarEdit = {
  originalText: string;
  replacement: string;
  reason: string;
  severity: 'grammar' | 'style' | 'spelling';
};

type LLMGrammarResponse = {
  edits: LLMGrammarEdit[];
};

const GRAMMAR_SYSTEM_INSTRUCTION = `You are a copy editor. Find grammatical issues. Return ONLY a JSON object with a list of edits. Do not rewrite the user's voice or tone. Only fix objective errors.`;

const generateId = (() => {
  let counter = 0;
  return () => `grammar-${Date.now()}-${counter++}`;
})();

export const mapEditsToSuggestions = (
  text: string,
  edits: LLMGrammarEdit[]
): GrammarSuggestion[] => {
  const suggestions: GrammarSuggestion[] = [];
  // Track used ranges to avoid mapping multiple edits to the same occurrence
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const edit of edits) {
    if (!edit.originalText || !edit.replacement) {
      continue;
    }

    // Find the next occurrence that doesn't overlap with already-used ranges
    let searchFrom = 0;
    let start = -1;
    while (searchFrom < text.length) {
      const idx = text.indexOf(edit.originalText, searchFrom);
      if (idx === -1) break;

      const candidateEnd = idx + edit.originalText.length;
      const overlaps = usedRanges.some(
        (r) => idx < r.end && candidateEnd > r.start
      );
      if (!overlaps) {
        start = idx;
        break;
      }
      searchFrom = idx + 1;
    }

    if (start === -1) {
      continue;
    }

    const end = start + edit.originalText.length;
    usedRanges.push({ start, end });
    // Collapse unsupported severities (e.g., spelling) into grammar to satisfy UI schema
    const severity: GrammarSuggestion['severity'] =
      edit.severity === 'style' ? 'style' : 'grammar';

    suggestions.push({
      id: generateId(),
      start,
      end,
      replacement: edit.replacement,
      message: edit.reason || 'Suggested correction',
      severity,
      originalText: text.substring(start, end),
    });
  }

  return suggestions;
};

export const fetchGrammarSuggestions = async (
  text: string,
  signal?: AbortSignal
): Promise<GrammarResponse> => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const model = ModelConfig.tools;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction: GRAMMAR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            edits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalText: { type: Type.STRING },
                  replacement: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                    description: 'One of "grammar", "style", or "spelling".',
                  },
                },
                required: ['originalText', 'replacement', 'reason', 'severity'],
              },
            },
          },
          required: ['edits'],
        },
      },
    });

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const parsed = safeParseJson<LLMGrammarResponse>(response.text, {
      edits: [],
    });

    const edits = parsed.data?.edits ?? [];
    const suggestions = mapEditsToSuggestions(text, edits);

    return {
      suggestions,
      usage: response.usageMetadata,
    };
  } catch (error) {
    console.error('[fetchGrammarSuggestions] Failed to generate grammar suggestions', error);
    return { suggestions: [] };
  }
};
