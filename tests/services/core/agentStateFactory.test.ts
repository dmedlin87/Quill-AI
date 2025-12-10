import { describe, it, expect } from 'vitest';
import {
  buildAppBrainStateFromAgentContext,
  buildManuscriptState,
  buildIntelligenceState,
  buildAnalysisState,
  buildLoreState,
  buildUIState,
  buildSessionState,
} from '@/services/core/agentStateFactory';
import {
  createMockChapter,
  createMockEditorContext,
  createMockEditorContextWithSelection,
  createMockPersona,
} from '@/tests/mocks/testFactories';

describe('agentStateFactory', () => {
  describe('buildManuscriptState', () => {
    it('builds manuscript state with provided values', () => {
      const chapters = [createMockChapter({ id: 'ch-1', title: 'Chapter 1' })];
      const result = buildManuscriptState({
        projectId: 'proj-123',
        chapters,
        fullText: 'Test content',
      });

      expect(result.projectId).toBe('proj-123');
      expect(result.chapters).toEqual(chapters);
      expect(result.currentText).toBe('Test content');
      expect(result.activeChapterId).toBe('ch-1');
    });

    it('handles null projectId', () => {
      const result = buildManuscriptState({
        projectId: null,
        chapters: [],
        fullText: '',
      });

      expect(result.projectId).toBeNull();
      expect(result.activeChapterId).toBeNull();
    });

    it('sets default values for optional fields', () => {
      const result = buildManuscriptState({
        projectId: null,
        chapters: [],
        fullText: '',
      });

      expect(result.projectTitle).toBe('');
      expect(result.branches).toEqual([]);
      expect(result.activeBranchId).toBeNull();
      expect(result.setting).toBeUndefined();
      expect(result.arcs).toEqual([]);
    });
  });

  describe('buildIntelligenceState', () => {
    it('builds intelligence state with HUD', () => {
      const mockHUD = { lastFullProcess: Date.now() } as any;
      const result = buildIntelligenceState(mockHUD);

      expect(result.hud).toBe(mockHUD);
      expect(result.full).toBeNull();
      expect(result.entities).toBeNull();
    });

    it('handles undefined HUD', () => {
      const result = buildIntelligenceState(undefined);

      expect(result.hud).toBeNull();
      expect(result.lastProcessedAt).toBeGreaterThan(0);
    });
  });

  describe('buildAnalysisState', () => {
    it('builds analysis state with result', () => {
      const mockAnalysis = { issues: [] } as any;
      const result = buildAnalysisState(mockAnalysis);

      expect(result.result).toBe(mockAnalysis);
      expect(result.status.pacing).toBe('idle');
    });

    it('handles null analysis', () => {
      const result = buildAnalysisState(null);

      expect(result.result).toBeNull();
      expect(result.inlineComments).toEqual([]);
    });
  });

  describe('buildLoreState', () => {
    it('builds lore state from provided lore', () => {
      const lore = {
        characters: [{ name: 'John' }],
        worldRules: ['Rule 1'],
      } as any;

      const result = buildLoreState(lore);

      expect(result.characters).toEqual([{ name: 'John' }]);
      expect(result.worldRules).toEqual(['Rule 1']);
    });

    it('handles undefined lore', () => {
      const result = buildLoreState(undefined);

      expect(result.characters).toEqual([]);
      expect(result.worldRules).toEqual([]);
      expect(result.manuscriptIndex).toBeUndefined();
    });
  });

  describe('buildUIState', () => {
    it('builds UI state without selection', () => {
      const editorContext = createMockEditorContext({ cursorPosition: 100 });
      const result = buildUIState(editorContext);

      expect(result.cursor.position).toBe(100);
      expect(result.selection).toBeNull();
      expect(result.activePanel).toBe('agent');
      expect(result.activeView).toBe('editor');
    });

    it('builds UI state with selection', () => {
      const editorContext = createMockEditorContextWithSelection(10, 20, 'selected');
      const result = buildUIState(editorContext);

      expect(result.selection).toEqual({
        start: 10,
        end: 20,
        text: 'selected',
      });
    });

    it('initializes microphone state', () => {
      const editorContext = createMockEditorContext();
      const result = buildUIState(editorContext);

      expect(result.microphone.status).toBe('idle');
      expect(result.microphone.mode).toBe('text');
      expect(result.microphone.lastTranscript).toBeNull();
      expect(result.microphone.error).toBeNull();
    });
  });

  describe('buildSessionState', () => {
    it('builds session state with persona', () => {
      const persona = createMockPersona();
      const result = buildSessionState(persona);

      expect(result.currentPersona).toBe(persona);
      expect(result.chatHistory).toEqual([]);
      expect(result.isProcessing).toBe(false);
    });

    it('handles null persona', () => {
      const result = buildSessionState(null);

      expect(result.currentPersona).toBeNull();
    });

    it('handles undefined persona', () => {
      const result = buildSessionState(undefined);

      expect(result.currentPersona).toBeNull();
    });
  });

  describe('buildAppBrainStateFromAgentContext', () => {
    it('builds complete AppBrainState', () => {
      const chapters = [createMockChapter()];
      const persona = createMockPersona();
      const editorContext = createMockEditorContextWithSelection(10, 20, 'selected');

      const result = buildAppBrainStateFromAgentContext({
        projectId: 'proj-123',
        chapters,
        fullText: 'Full manuscript text',
        editorContext,
        persona,
      });

      expect(result.manuscript.projectId).toBe('proj-123');
      expect(result.manuscript.currentText).toBe('Full manuscript text');
      expect(result.ui.selection?.text).toBe('selected');
      expect(result.session.currentPersona).toBe(persona);
    });

    it('handles minimal input', () => {
      const result = buildAppBrainStateFromAgentContext({
        projectId: null,
        chapters: [],
        fullText: '',
        editorContext: createMockEditorContext(),
      });

      expect(result.manuscript.projectId).toBeNull();
      expect(result.manuscript.chapters).toEqual([]);
      expect(result.intelligence.hud).toBeNull();
      expect(result.lore.characters).toEqual([]);
    });

    it('includes all optional fields when provided', () => {
      const mockHUD = { lastFullProcess: Date.now() } as any;
      const mockAnalysis = { issues: [] } as any;
      const lore = {
        characters: [{ name: 'Character' }],
        worldRules: ['Rule'],
      } as any;

      const result = buildAppBrainStateFromAgentContext({
        projectId: 'proj-123',
        chapters: [createMockChapter()],
        fullText: 'Text',
        intelligenceHUD: mockHUD,
        analysis: mockAnalysis,
        lore,
        editorContext: createMockEditorContext(),
        persona: createMockPersona(),
      });

      expect(result.intelligence.hud).toBe(mockHUD);
      expect(result.analysis.result).toBe(mockAnalysis);
      expect(result.lore.characters).toHaveLength(1);
    });
  });
});
