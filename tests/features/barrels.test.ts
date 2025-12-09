import { describe, it, expect } from 'vitest';

const barrels = [
  {
    name: 'agent',
    load: () => import('@/features/agent'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.ChatInterface).toBeDefined();
      expect(mod.useAgentOrchestrator).toBeDefined();
      expect(mod.useMemoryIntelligence).toBeDefined();
      expect(mod.PersonaSelector).toBeDefined();
    },
  },
  {
    name: 'analysis',
    load: () => import('@/features/analysis'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.AnalysisPanel).toBeDefined();
      expect(mod.AnalysisProvider).toBeDefined();
      expect(mod.BrainstormingPanel).toBeDefined();
    },
  },
  {
    name: 'core',
    load: () => import('@/features/core'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.EditorProvider).toBeDefined();
      expect(mod.EngineProvider).toBeDefined();
      expect(mod.AppBrainProvider).toBeDefined();
    },
  },
  {
    name: 'editor',
    load: () => import('@/features/editor'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.RichTextEditor).toBeDefined();
      expect(mod.useMagicEditor).toBeDefined();
      expect(mod.CommentMark).toBeDefined();
    },
  },
  {
    name: 'layout',
    load: () => import('@/features/layout'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.MainLayout).toBeDefined();
      expect(mod.EditorLayout).toBeDefined();
      expect(mod.useLayoutStore).toBeDefined();
    },
  },
  {
    name: 'lore',
    load: () => import('@/features/lore'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.LoreManager).toBeDefined();
      expect(mod.KnowledgeGraph).toBeDefined();
    },
  },
  {
    name: 'memory',
    load: () => import('@/features/memory'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.MemoryManager).toBeDefined();
    },
  },
  {
    name: 'project',
    load: () => import('@/features/project'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.useProjectStore).toBeDefined();
      expect(mod.ProjectDashboard).toBeDefined();
      expect(mod.ImportWizard).toBeDefined();
    },
  },
  {
    name: 'settings',
    load: () => import('@/features/settings'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.useSettingsStore).toBeDefined();
      expect(mod.ExperienceSelector).toBeDefined();
    },
  },
  {
    name: 'voice',
    load: () => import('@/features/voice'),
    assertions: (mod: Record<string, unknown>) => {
      expect(mod.VoiceMode).toBeDefined();
      expect(mod.useVoiceSession).toBeDefined();
      expect(mod.useAudioController).toBeDefined();
    },
  },
];

describe('feature barrel indexes', () => {
  for (const { name, load, assertions } of barrels) {
    it(`exposes expected exports for ${name}`, async () => {
      const mod = await load();
      assertions(mod);
    });
  }
});
