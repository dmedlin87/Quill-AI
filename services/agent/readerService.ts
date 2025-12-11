import { ai } from '@/services/gemini/client';
import { ReaderPersona } from '@/types/personas';
import { getActiveModels } from '@/config/models';
import { InlineComment } from '@/types/schema';

const MIN_TEXT_LENGTH = 50;

export class ReaderService {
  /**
   * Generates reader reactions for a chunk of text.
   */
  async generateReactions(
    text: string,
    persona: ReaderPersona,
    context?: string
  ): Promise<InlineComment[]> {
    if (!text || text.length < MIN_TEXT_LENGTH) return [];

    // Safely formatted prompt
    const prompt = `
      ${persona.systemPrompt}

      TASK: Read the following manuscript excerpt and provide your inline reactions.
      - Focus on your specific areas of interest: ${persona.focus.join(', ')}.
      - Identify 1-3 specific moments that trigger a strong reaction.
      - Quote the exact text that triggered the reaction.
      - Provide a short, visceral reaction (not a long critique).

      CONTEXT: ${context || 'No specific context provided.'}

      EXCERPT:
      \`\`\`
      ${text}
      \`\`\`

      OUTPUT FORMAT: JSON Array of objects with keys:
      - quote: string (exact text match)
      - reaction: string (your thought)
      - sentiment: "positive" | "negative" | "neutral" | "confused"
    `;

    try {
      const activeModels = getActiveModels();
      const response = await ai.models.generateContent({
        model: activeModels.analysis.id,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.response.text();
      // Simple cleaning of markdown code blocks if present
      const cleanJson = resultText.replace(/```json|```/g, '').trim();

      let reactions;
      try {
        reactions = JSON.parse(cleanJson);
      } catch (jsonError) {
        console.error('Failed to parse AI-generated JSON:', jsonError, '\nAI output:', cleanJson);
        return [{
            id: crypto.randomUUID(),
            type: 'prose',
            issue: 'Error parsing AI response. Please try again.',
            suggestion: '',
            severity: 'error',
            quote: '',
            startIndex: 0,
            endIndex: 0,
            dismissed: false,
            createdAt: Date.now()
        }];
      }

      if (!Array.isArray(reactions)) {
        return [{
            id: crypto.randomUUID(),
            type: 'prose',
            issue: 'AI response format was invalid.',
            suggestion: '',
            severity: 'error',
            quote: '',
            startIndex: 0,
            endIndex: 0,
            dismissed: false,
            createdAt: Date.now()
        }];
      }

      return reactions.map((r: any) => ({
        id: crypto.randomUUID(),
        quote: r.quote || '',
        issue: r.reaction || 'No reaction text',
        suggestion: '',
        severity: r.sentiment === 'negative' ? 'error' : r.sentiment === 'positive' ? 'info' : 'warning',
        type: 'prose',
        startIndex: 0,
        endIndex: 0,
        dismissed: false,
        createdAt: Date.now()
      }));

    } catch (error) {
      console.error('Error generating reader reactions:', error);
      return [{
        id: crypto.randomUUID(),
        type: 'prose',
        issue: 'An error occurred while generating reader reactions. Please try again later.',
        suggestion: '',
        severity: 'error',
        quote: '',
        startIndex: 0,
        endIndex: 0,
        dismissed: false,
        createdAt: Date.now()
      }];
    }
  }
}

export const readerService = new ReaderService();
