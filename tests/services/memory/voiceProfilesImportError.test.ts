import { describe, it, expect } from 'vitest';

// Regression test for missing `getMemories` export in memoryService used by voiceProfiles
// This should fail when the module import is broken and pass once the import is fixed.
describe('voiceProfiles module import', () => {
  it('loads without missing getMemories export errors', async () => {
    const mod = await import('../../../services/memory/voiceProfiles');
    expect(mod).toBeDefined();
  });
});
