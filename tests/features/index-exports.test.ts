/**
 * Feature Index Coverage Tests
 *
 * These tests ensure all feature index barrel files are properly exporting
 * their components, hooks, and contexts. This provides coverage for the
 * index.ts files which are otherwise at 0% branch coverage.
 */
import { describe, it, expect } from 'vitest';

describe('Feature Index Exports', () => {
  describe('features/agent/index.ts', () => {
    it('exports all agent components and hooks', async () => {
      const agentExports = await import('@/features/agent');

      // Components
      expect(agentExports.ChatInterface).toBeDefined();
      expect(agentExports.ActivityFeed).toBeDefined();
      expect(agentExports.PersonaSelector).toBeDefined();
      expect(agentExports.AIPresenceOrb).toBeDefined();
      expect(agentExports.ProactiveSuggestions).toBeDefined();
      expect(agentExports.ProactiveSuggestionsBadge).toBeDefined();

      // Hooks
      expect(agentExports.useAgenticEditor).toBeDefined();
      expect(agentExports.useAgentService).toBeDefined();
      expect(agentExports.useAgentOrchestrator).toBeDefined();
      expect(agentExports.useProactiveSuggestions).toBeDefined();
      expect(agentExports.useMemoryIntelligence).toBeDefined();
    });
  });

  describe('features/analysis/index.ts', () => {
    it('exports all analysis components and context', async () => {
      const analysisExports = await import('@/features/analysis');

      // Context
      expect(analysisExports.AnalysisProvider).toBeDefined();
      expect(analysisExports.useAnalysis).toBeDefined();

      // Components
      expect(analysisExports.BrainstormingPanel).toBeDefined();
      expect(analysisExports.Dashboard).toBeDefined();
      expect(analysisExports.ExecutiveSummary).toBeDefined();
      expect(analysisExports.CharactersSection).toBeDefined();
      expect(analysisExports.PacingSection).toBeDefined();
      expect(analysisExports.PlotIssuesSection).toBeDefined();
      expect(analysisExports.SettingConsistencySection).toBeDefined();
      expect(analysisExports.StrengthsWeaknesses).toBeDefined();
      expect(analysisExports.AnalysisPanel).toBeDefined();
      expect(analysisExports.ShadowReaderPanel).toBeDefined();
      expect(analysisExports.ScoreCard).toBeDefined();
      expect(analysisExports.IssueCard).toBeDefined();
    });
  });

  describe('features/core/index.ts', () => {
    it('exports all core contexts', async () => {
      const coreExports = await import('@/features/core');

      // Editor Context
      expect(coreExports.EditorProvider).toBeDefined();
      expect(coreExports.useEditor).toBeDefined();
      expect(coreExports.useEditorState).toBeDefined();
      expect(coreExports.useEditorActions).toBeDefined();
      expect(coreExports.useManuscript).toBeDefined();
      expect(coreExports.ManuscriptProvider).toBeDefined();

      // Engine Context
      expect(coreExports.EngineProvider).toBeDefined();
      expect(coreExports.useEngine).toBeDefined();

      // App Brain Context
      expect(coreExports.AppBrainProvider).toBeDefined();
      expect(coreExports.useAppBrain).toBeDefined();
      expect(coreExports.useAppBrainState).toBeDefined();
      expect(coreExports.useAppBrainActions).toBeDefined();
      expect(coreExports.useAppBrainContext).toBeDefined();
    });
  });

  describe('features/debug/index.ts', () => {
    it('exports debug components', async () => {
      const debugExports = await import('@/features/debug');

      expect(debugExports.BrainActivityMonitor).toBeDefined();
    });
  });

  describe('features/editor/index.ts', () => {
    it('exports all editor components and hooks', async () => {
      const editorExports = await import('@/features/editor');

      // Components
      expect(editorExports.RichTextEditor).toBeDefined();
      expect(editorExports.EditorWorkspace).toBeDefined();
      expect(editorExports.MagicBar).toBeDefined();
      expect(editorExports.CommentCard).toBeDefined();
      expect(editorExports.DiffViewer).toBeDefined();
      expect(editorExports.VisualDiff).toBeDefined();
      expect(editorExports.FindReplaceModal).toBeDefined();
      expect(editorExports.VersionControlPanel).toBeDefined();
      expect(editorExports.StoryVersionsPanel).toBeDefined();

      // Hooks
      expect(editorExports.useAutoResize).toBeDefined();
      expect(editorExports.useBranching).toBeDefined();
      expect(editorExports.useChunkIndex).toBeDefined();
      expect(editorExports.useDocumentHistory).toBeDefined();
      expect(editorExports.useEditorBranching).toBeDefined();
      expect(editorExports.useEditorComments).toBeDefined();
      expect(editorExports.useEditorSelection).toBeDefined();
      expect(editorExports.useInlineComments).toBeDefined();
      expect(editorExports.useMagicEditor).toBeDefined();
      expect(editorExports.useTiptapSync).toBeDefined();

      // Extensions
      expect(editorExports.CommentMark).toBeDefined();
    });
  });

  describe('features/layout/index.ts', () => {
    it('exports all layout components and store', async () => {
      const layoutExports = await import('@/features/layout');

      // Layouts
      expect(layoutExports.MainLayout).toBeDefined();
      expect(layoutExports.Workspace).toBeDefined();
      expect(layoutExports.EditorLayout).toBeDefined();
      expect(layoutExports.UploadLayout).toBeDefined();

      // Components
      expect(layoutExports.NavigationRail).toBeDefined();
      expect(layoutExports.EditorHeader).toBeDefined();
      expect(layoutExports.ToolsPanel).toBeDefined();
      expect(layoutExports.ZenModeOverlay).toBeDefined();

      // Store
      expect(layoutExports.useLayoutStore).toBeDefined();
    });
  });

  describe('features/lore/index.ts', () => {
    it('exports lore components', async () => {
      const loreExports = await import('@/features/lore');

      expect(loreExports.LoreManager).toBeDefined();
      expect(loreExports.KnowledgeGraph).toBeDefined();
    });
  });

  describe('features/memory/index.ts', () => {
    it('exports memory components', async () => {
      const memoryExports = await import('@/features/memory');

      expect(memoryExports.MemoryManager).toBeDefined();
      // Note: BedsideNotePanel is not exported from memory index
    });
  });

  describe('features/project/index.ts', () => {
    it('exports project components and store', async () => {
      const projectExports = await import('@/features/project');

      // Store
      expect(projectExports.useProjectStore).toBeDefined();

      // Components
      expect(projectExports.FileUpload).toBeDefined();
      expect(projectExports.ProjectDashboard).toBeDefined();
      expect(projectExports.ProjectSidebar).toBeDefined();
      expect(projectExports.ImportWizard).toBeDefined();
      expect(projectExports.StoryBoard).toBeDefined();
    });
  });

  describe('features/settings/index.ts', () => {
    it('exports settings components and store', async () => {
      const settingsExports = await import('@/features/settings');

      // Store
      expect(settingsExports.useSettingsStore).toBeDefined();

      // Components
      expect(settingsExports.ApiKeyManager).toBeDefined();
      expect(settingsExports.ModelBuildSelector).toBeDefined();
      expect(settingsExports.ModelBuildBadge).toBeDefined();
      expect(settingsExports.ExperienceSelector).toBeDefined();
      expect(settingsExports.ExperienceBadge).toBeDefined();
      expect(settingsExports.CritiqueIntensitySelector).toBeDefined();
      expect(settingsExports.IntensityBadge).toBeDefined();
      expect(settingsExports.DeveloperModeToggle).toBeDefined();
      expect(settingsExports.NativeSpellcheckToggle).toBeDefined();
      expect(settingsExports.RelevanceTuning).toBeDefined();
      expect(settingsExports.ThemeSelector).toBeDefined();
    });
  });

  describe('features/voice/index.ts', () => {
    it('exports voice components, hooks, and services', async () => {
      const voiceExports = await import('@/features/voice');

      // Components
      expect(voiceExports.VoiceMode).toBeDefined();
      expect(voiceExports.VoiceCommandButton).toBeDefined();

      // Hooks
      expect(voiceExports.useVoiceSession).toBeDefined();
      expect(voiceExports.useTextToSpeech).toBeDefined();
      expect(voiceExports.useAudioController).toBeDefined();
      expect(voiceExports.useSpeechIntent).toBeDefined();

      // Services
      expect(voiceExports.base64ToUint8Array).toBeDefined();
      expect(voiceExports.arrayBufferToBase64).toBeDefined();
      expect(voiceExports.decodeAudioData).toBeDefined();
      expect(voiceExports.createBlob).toBeDefined();
    });
  });

  describe('features/shared/index.ts', () => {
    it('exports shared contexts, hooks, utils, and components', async () => {
      const sharedExports = await import('@/features/shared');

      // Contexts
      expect(sharedExports.UsageProvider).toBeDefined();
      expect(sharedExports.useUsage).toBeDefined();

      // Hooks
      expect(sharedExports.useQuillAIEngine).toBeDefined();
      expect(sharedExports.useManuscriptIndexer).toBeDefined();
      expect(sharedExports.usePlotSuggestions).toBeDefined();
      expect(sharedExports.useViewportCollision).toBeDefined();
      expect(sharedExports.useManuscriptIntelligence).toBeDefined();
      expect(sharedExports.useSmartnessPipeline).toBeDefined();

      // Utils
      expect(sharedExports.findQuoteRange).toBeDefined();
      expect(sharedExports.calculateDiff).toBeDefined();

      // Components
      expect(sharedExports.ErrorBoundary).toBeDefined();
      expect(sharedExports.UsageBadge).toBeDefined();
      expect(sharedExports.AccessibleTooltip).toBeDefined();
    });
  });
});

describe('Services Index Exports', () => {
  describe('services/commands/index.ts', () => {
    it('exports command registry and related infrastructure', async () => {
      const commandsExports = await import('@/services/commands');

      // Infrastructure
      expect(commandsExports.CommandRegistry).toBeDefined();
      expect(commandsExports.CommandHistory).toBeDefined();
      expect(commandsExports.getCommandHistory).toBeDefined();
      expect(commandsExports.resetCommandHistory).toBeDefined();

      // Navigation Commands
      expect(commandsExports.NavigateToTextCommand).toBeDefined();
      expect(commandsExports.JumpToChapterCommand).toBeDefined();
      expect(commandsExports.JumpToSceneCommand).toBeDefined();

      // Editing Commands
      expect(commandsExports.UpdateManuscriptCommand).toBeDefined();
      expect(commandsExports.AppendTextCommand).toBeDefined();

      // Analysis Commands
      expect(commandsExports.GetCritiqueCommand).toBeDefined();
      expect(commandsExports.RunAnalysisCommand).toBeDefined();
    });
  });
});
