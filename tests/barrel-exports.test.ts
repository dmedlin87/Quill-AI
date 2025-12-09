import { describe, it, expect } from 'vitest';

describe('Barrel Exports Smoke Tests', () => {
  it('features/shared exports', async () => {
    const exports = await import('@/features/shared');
    expect(exports).toBeDefined();
  });

  it('features/editor exports', async () => {
    const exports = await import('@/features/editor');
    expect(exports).toBeDefined();
  });

  it('features/analysis exports', async () => {
    const exports = await import('@/features/analysis');
    expect(exports).toBeDefined();
  });

  it('features/settings exports', async () => {
    const exports = await import('@/features/settings');
    expect(exports).toBeDefined();
  });

  it('features/core exports', async () => {
    const exports = await import('@/features/core');
    expect(exports).toBeDefined();
  });

  it('config/index exports', async () => {
      const exports = await import('@/config');
      expect(exports).toBeDefined();
  });
});
