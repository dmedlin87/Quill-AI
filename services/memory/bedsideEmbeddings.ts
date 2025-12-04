import { generateMemoryEmbedding } from './semanticDedup';

export type BedsideEmbeddingGenerator = (text: string) => Promise<number[]> | number[];

let embeddingGenerator: BedsideEmbeddingGenerator = (text: string) => generateMemoryEmbedding(text);

export function setBedsideEmbeddingGenerator(generator: BedsideEmbeddingGenerator | null): void {
  embeddingGenerator = generator ?? ((text: string) => generateMemoryEmbedding(text));
}

export async function embedBedsideNoteText(text: string): Promise<number[]> {
  const result = embeddingGenerator(text);
  return Array.isArray(result) ? result : await result;
}
