import * as LoreFeature from '@/features/lore';

describe('features/lore index', () => {
  it('exports lore components', () => {
    expect(LoreFeature.LoreManager).toBeDefined();
    expect(LoreFeature.KnowledgeGraph).toBeDefined();
  });
});
