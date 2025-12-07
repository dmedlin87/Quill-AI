import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setBedsideEmbeddingGenerator,
  embedBedsideNoteText,
} from '@/services/memory/bedsideEmbeddings';

// Mock the semanticDedup module
vi.mock('@/services/memory/semanticDedup', () => ({
  generateMemoryEmbedding: vi.fn(() => [0.1, 0.2, 0.3]),
}));

describe('bedsideEmbeddings', () => {
  afterEach(() => {
    // Reset to default generator
    setBedsideEmbeddingGenerator(null);
  });

  it('uses default generator when none set', async () => {
    const result = await embedBedsideNoteText('test text');
    
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('uses custom generator when set', async () => {
    const customGenerator = vi.fn(() => [0.5, 0.6, 0.7]);
    setBedsideEmbeddingGenerator(customGenerator);
    
    const result = await embedBedsideNoteText('custom text');
    
    expect(customGenerator).toHaveBeenCalledWith('custom text');
    expect(result).toEqual([0.5, 0.6, 0.7]);
  });

  it('resets to default when null passed', async () => {
    const customGenerator = vi.fn(() => [1, 2, 3]);
    setBedsideEmbeddingGenerator(customGenerator);
    setBedsideEmbeddingGenerator(null);
    
    const result = await embedBedsideNoteText('reset text');
    
    expect(customGenerator).not.toHaveBeenCalled();
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('handles async custom generator', async () => {
    const asyncGenerator = vi.fn(async () => [0.9, 0.8, 0.7]);
    setBedsideEmbeddingGenerator(asyncGenerator);
    
    const result = await embedBedsideNoteText('async text');
    
    expect(result).toEqual([0.9, 0.8, 0.7]);
  });
});
