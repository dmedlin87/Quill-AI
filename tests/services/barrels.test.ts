import { describe, it, expect } from 'vitest';

const barrels = [
  {
    name: 'commands',
    load: () => import('@/services/commands'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.CommandRegistry).toBeDefined();
      expect(mod.NavigateToTextCommand).toBeDefined();
      expect(mod.RewriteSelectionCommand).toBeDefined();
    },
  },
  {
    name: 'appBrain',
    load: () => import('@/services/appBrain'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.createEmptyAppBrainState).toBeDefined();
      expect(mod.buildAdaptiveContext).toBeDefined();
      expect(mod.buildAgentContextWithMemory).toBeDefined();
    },
  },
  {
    name: 'intelligence',
    load: () => import('@/services/intelligence'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.processManuscript).toBeDefined();
      expect(mod.processManuscriptCached).toBeDefined();
      expect(mod.generateAIContext).toBeDefined();
    },
  },
  {
    name: 'memory',
    load: () => import('@/services/memory'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.createMemory).toBeDefined();
      expect(mod.createHierarchicalGoal).toBeDefined();
      expect(mod.getMemories).toBeDefined();
    },
  },
];

describe('services barrel indexes', () => {
  for (const { name, load, assertions } of barrels) {
    it(`exposes expected exports for ${name}`, async () => {
      const mod = await load();
      assertions(mod);
    });
  }
});
