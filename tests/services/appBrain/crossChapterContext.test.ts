import { describe, it, expect } from 'vitest';
import { buildCrossChapterContext } from '@/services/appBrain/crossChapterContext';

const baseChapters = [
  { id: 'c1', title: 'One', content: 'First', order: 0, updatedAt: 0 },
  { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
  { id: 'c3', title: 'Three', content: 'Third', order: 2, updatedAt: 0 },
];

describe('buildCrossChapterContext', () => {
  it('includes active chapter with neighbors', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'c2', 'Current text');

    expect(context.previousChapter?.title).toBe('One');
    expect(context.nextChapter?.title).toBe('Three');
  });

  it('falls back when no chapter is active', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'missing', '');

    expect(context.previousChapter).toBeNull();
    expect(context.nextChapter).toBeNull();
  });
});
