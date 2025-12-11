import { ai } from '@/services/gemini/client';
import { ReaderPersona } from '@/types/personas';
import { ModelBuilds } from '@/config/models';
import { InlineComment } from '@/types/schema';

export class ReaderService {
  /**
   * Generates reader reactions for a chunk of text.
   */
  async generateReactions(
    text: string,
    persona: ReaderPersona,
    context?: string
  ): Promise<InlineComment[]> {
    if (!text || text.length < 50) return [];

    const prompt = `
      ${persona.systemPrompt}

      TASK: Read the following manuscript excerpt and provide your inline reactions.
      - Focus on your specific areas of interest: ${persona.focus.join(', ')}.
      - Identify 1-3 specific moments that trigger a strong reaction.
      - Quote the exact text that triggered the reaction.
      - Provide a short, visceral reaction (not a long critique).

      CONTEXT: ${context || 'No specific context provided.'}

      EXCERPT:
      "${text}"

      OUTPUT FORMAT: JSON Array of objects with keys:
      - quote: string (exact text match)
      - reaction: string (your thought)
      - sentiment: "positive" | "negative" | "neutral" | "confused"
    `;

    try {
      const response = await ai.models.generateContent({
        model: ModelBuilds.free.analysis.id, // Use analysis model
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.response.text();
      // Simple cleaning of markdown code blocks if present
      const cleanJson = resultText.replace(/```json|```/g, '').trim();

      const reactions = JSON.parse(cleanJson);

      return reactions.map((r: any) => ({
        id: crypto.randomUUID(),
        quote: r.quote,
        issue: r.reaction, // Mapping reaction to 'issue' for display compatibility
        suggestion: '', // No suggestion needed for reactions
        severity: r.sentiment === 'negative' ? 0.8 : r.sentiment === 'positive' ? 0.1 : 0.4,
        type: 'reader_reaction',
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error('Error generating reader reactions:', error);
      return [];
    }
  }
}

export const readerService = new ReaderService();
