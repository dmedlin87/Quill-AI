import { generateMemoryEmbedding } from './semanticDedup';
import type { MemoryEmbedding } from './types';

export type BedsideEmbeddingGenerator = (text: string) => Promise<MemoryEmbedding> | MemoryEmbedding;

const defaultEmbeddingGenerator: BedsideEmbeddingGenerator = (text: string) =>
  generateMemoryEmbedding(text) as MemoryEmbedding;

let embeddingGenerator: BedsideEmbeddingGenerator = defaultEmbeddingGenerator;

export function setBedsideEmbeddingGenerator(generator: BedsideEmbeddingGenerator | null): void {
  embeddingGenerator = generator ?? defaultEmbeddingGenerator;
}

export async function embedBedsideNoteText(text: string): Promise<MemoryEmbedding> {
  return Promise.resolve(embeddingGenerator(text));
}
