import * as MemoryFeature from '@/features/memory';

describe('features/memory index', () => {
  it('exports MemoryManager', () => {
    expect(MemoryFeature.MemoryManager).toBeDefined();
  });
});
