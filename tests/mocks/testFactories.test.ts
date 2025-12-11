/**
 * Tests for testFactories.ts factory functions
 * Covers lines 71-72, 110-163, 210-264 for improved branch coverage
 */

import { describe, it, expect } from 'vitest';
import {
  createMockEditorContext,
  createMockEditorContextWithSelection,
  createMockChapter,
  createMockChapters,
  createMockPersona,
  createMockGrammarSuggestion,
  createMockGrammarSuggestions,
  createMockAgentContextInput,
  createFullMockAgentContextInput,
  createMockAppBrainState,
  createMockAppBrainStateWithManuscript,
  createMockAgentState,
  createMockSelectionRange,
  createSelectionFromText,
} from './testFactories';

describe('testFactories', () => {
  describe('createMockEditorContext', () => {
    it('should create default editor context', () => {
      const context = createMockEditorContext();
      expect(context.cursorPosition).toBe(0);
      expect(context.selection).toBeNull();
    });

    it('should accept overrides', () => {
      const context = createMockEditorContext({
        cursorPosition: 100,
        selection: { start: 50, end: 100, text: 'selected' },
      });
      expect(context.cursorPosition).toBe(100);
      expect(context.selection).toEqual({ start: 50, end: 100, text: 'selected' });
    });
  });

  describe('createMockEditorContextWithSelection', () => {
    it('should create context with selection', () => {
      const context = createMockEditorContextWithSelection(10, 20, 'hello');
      expect(context.cursorPosition).toBe(10);
      expect(context.selection).toEqual({ start: 10, end: 20, text: 'hello' });
    });

    it('should handle zero-based positions', () => {
      const context = createMockEditorContextWithSelection(0, 5, 'start');
      expect(context.selection!.start).toBe(0);
      expect(context.selection!.end).toBe(5);
    });
  });

  describe('createMockChapter', () => {
    it('should create default chapter', () => {
      const chapter = createMockChapter();
      expect(chapter.id).toBeDefined();
      expect(chapter.title).toBe('Test Chapter');
      expect(chapter.content).toBe('Test chapter content.');
      expect(chapter.order).toBe(0);
    });

    it('should accept overrides', () => {
      const chapter = createMockChapter({
        id: 'custom-id',
        title: 'Custom Title',
        content: 'Custom content',
        order: 5,
      });
      expect(chapter.id).toBe('custom-id');
      expect(chapter.title).toBe('Custom Title');
      expect(chapter.content).toBe('Custom content');
      expect(chapter.order).toBe(5);
    });

    it('should use provided id in override', () => {
      const chapter = createMockChapter({ id: 'my-chapter' });
      expect(chapter.id).toBe('my-chapter');
    });
  });

  describe('createMockChapters', () => {
    it('should create specified number of chapters', () => {
      const chapters = createMockChapters(3);
      expect(chapters).toHaveLength(3);
    });

    it('should create chapters with sequential ids', () => {
      const chapters = createMockChapters(3);
      expect(chapters[0].id).toBe('chapter-1');
      expect(chapters[1].id).toBe('chapter-2');
      expect(chapters[2].id).toBe('chapter-3');
    });

    it('should create chapters with sequential titles', () => {
      const chapters = createMockChapters(2);
      expect(chapters[0].title).toBe('Chapter 1');
      expect(chapters[1].title).toBe('Chapter 2');
    });

    it('should create chapters with sequential order', () => {
      const chapters = createMockChapters(4);
      expect(chapters[0].order).toBe(0);
      expect(chapters[1].order).toBe(1);
      expect(chapters[2].order).toBe(2);
      expect(chapters[3].order).toBe(3);
    });

    it('should create empty array for count 0', () => {
      const chapters = createMockChapters(0);
      expect(chapters).toHaveLength(0);
    });

    it('should create chapters with unique content', () => {
      const chapters = createMockChapters(2);
      expect(chapters[0].content).toBe('Content for chapter 1.');
      expect(chapters[1].content).toBe('Content for chapter 2.');
    });
  });

  describe('createMockPersona', () => {
    it('should create default persona', () => {
      const persona = createMockPersona();
      expect(persona.id).toBe('test-persona');
      expect(persona.name).toBe('Test Persona');
      expect(persona.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should accept overrides', () => {
      const persona = createMockPersona({
        id: 'custom-id',
        name: 'Custom Persona',
        systemPrompt: 'Custom prompt',
      });
      expect(persona.id).toBe('custom-id');
      expect(persona.name).toBe('Custom Persona');
      expect(persona.systemPrompt).toBe('Custom prompt');
    });
  });

  describe('createMockGrammarSuggestion', () => {
    it('should create default suggestion', () => {
      const suggestion = createMockGrammarSuggestion();
      expect(suggestion.id).toBeDefined();
      expect(suggestion.start).toBe(0);
      expect(suggestion.end).toBe(5);
      expect(suggestion.replacement).toBe('fixed');
      expect(suggestion.message).toBe('Grammar issue');
      expect(suggestion.severity).toBe('grammar');
      expect(suggestion.originalText).toBe('error');
    });

    it('should accept overrides', () => {
      const suggestion = createMockGrammarSuggestion({
        id: 'custom-id',
        start: 10,
        end: 20,
        replacement: 'corrected',
        message: 'Grammar error',
        severity: 'style',
        originalText: 'teh',
      });
      expect(suggestion.id).toBe('custom-id');
      expect(suggestion.start).toBe(10);
      expect(suggestion.end).toBe(20);
      expect(suggestion.replacement).toBe('corrected');
      expect(suggestion.message).toBe('Grammar error');
      expect(suggestion.severity).toBe('style');
      expect(suggestion.originalText).toBe('teh');
    });
  });

  describe('createMockGrammarSuggestions', () => {
    it('should create specified number of suggestions', () => {
      const suggestions = createMockGrammarSuggestions(5);
      expect(suggestions).toHaveLength(5);
    });

    it('should create suggestions with sequential ids', () => {
      const suggestions = createMockGrammarSuggestions(3);
      expect(suggestions[0].id).toBe('suggestion-1');
      expect(suggestions[1].id).toBe('suggestion-2');
      expect(suggestions[2].id).toBe('suggestion-3');
    });

    it('should create suggestions with staggered positions', () => {
      const suggestions = createMockGrammarSuggestions(3);
      expect(suggestions[0].start).toBe(0);
      expect(suggestions[0].end).toBe(5);
      expect(suggestions[1].start).toBe(10);
      expect(suggestions[1].end).toBe(15);
      expect(suggestions[2].start).toBe(20);
      expect(suggestions[2].end).toBe(25);
    });

    it('should respect baseOffset', () => {
      const suggestions = createMockGrammarSuggestions(2, 100);
      expect(suggestions[0].start).toBe(100);
      expect(suggestions[0].end).toBe(105);
      expect(suggestions[1].start).toBe(110);
      expect(suggestions[1].end).toBe(115);
    });

    it('should create sequential messages', () => {
      const suggestions = createMockGrammarSuggestions(3);
      expect(suggestions[0].message).toBe('Issue 1');
      expect(suggestions[1].message).toBe('Issue 2');
      expect(suggestions[2].message).toBe('Issue 3');
    });

    it('should create empty array for count 0', () => {
      const suggestions = createMockGrammarSuggestions(0);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('createMockAgentContextInput', () => {
    it('should create default context input', () => {
      const context = createMockAgentContextInput();
      expect(context.fullText).toBe('Test manuscript content.');
      expect(context.chapters).toHaveLength(1);
      expect(context.critiqueIntensity).toBe('balanced');
      expect(context.experienceLevel).toBe('intermediate');
      expect(context.autonomyMode).toBe('balanced');
    });

    it('should accept overrides', () => {
      const context = createMockAgentContextInput({
        fullText: 'Custom text',
        critiqueIntensity: 'intensive',
        experienceLevel: 'pro',
        autonomyMode: 'auto',
      });
      expect(context.fullText).toBe('Custom text');
      expect(context.critiqueIntensity).toBe('intensive');
      expect(context.experienceLevel).toBe('pro');
      expect(context.autonomyMode).toBe('auto');
    });

    it('should allow overriding chapters', () => {
      const customChapters = createMockChapters(5);
      const context = createMockAgentContextInput({ chapters: customChapters });
      expect(context.chapters).toHaveLength(5);
    });
  });

  describe('createFullMockAgentContextInput', () => {
    it('should create context with all fields populated', () => {
      const context = createFullMockAgentContextInput();

      expect(context.fullText).toContain('Full test manuscript');
      expect(context.chapters).toHaveLength(3);
      expect(context.lore).toBeDefined();
      expect(context.lore!.characters).toEqual([]);
      expect(context.lore!.worldRules).toEqual([]);
      expect(context.analysis).toBeNull();
      expect(context.intelligenceHUD).toBeNull();
      expect(context.interviewTarget).toBeUndefined();
      expect(context.projectId).toBe('test-project-id');
      expect(context.critiqueIntensity).toBe('balanced');
      expect(context.experienceLevel).toBe('intermediate');
      expect(context.autonomyMode).toBe('balanced');
    });

    it('should have multi-paragraph text', () => {
      const context = createFullMockAgentContextInput();
      expect(context.fullText).toContain('\n\n');
    });
  });

  describe('createMockAppBrainState', () => {
    it('should create valid state based on empty state', () => {
      const state = createMockAppBrainState();
      expect(state).toBeDefined();
      expect(state.manuscript).toBeDefined();
      expect(state.intelligence).toBeDefined();
      expect(state.analysis).toBeDefined();
      expect(state.lore).toBeDefined();
      expect(state.ui).toBeDefined();
      expect(state.session).toBeDefined();
    });

    it('should merge manuscript overrides', () => {
      const state = createMockAppBrainState({
        manuscript: {
          projectId: null,
          projectTitle: 'Custom Title',
          chapters: [],
          activeChapterId: null,
          currentText: '',
          branches: [],
          activeBranchId: null,
        },
      });
      expect(state.manuscript.projectTitle).toBe('Custom Title');
    });

    it('should merge intelligence overrides', () => {
      const state = createMockAppBrainState({
        intelligence: {
          hud: null,
          full: null,
          entities: null,
          timeline: null,
          style: null,
          heatmap: null,
          lastProcessedAt: 12345,
        },
      });
      expect(state.intelligence.lastProcessedAt).toBe(12345);
    });

    it('should merge analysis overrides', () => {
      const state = createMockAppBrainState({
        analysis: {
          result: null,
          status: {
            pacing: 'loading',
            characters: 'idle',
            plot: 'idle',
            setting: 'idle',
          },
          inlineComments: [],
        },
      });
      expect(state.analysis.status.pacing).toBe('loading');
    });

    it('should merge ui overrides', () => {
      const state = createMockAppBrainState({
        ui: {
          cursor: { position: 0, scene: null, paragraph: null },
          selection: null,
          activePanel: 'chat',
          activeView: 'storyboard',
          isZenMode: false,
          activeHighlight: null,
          microphone: { status: 'idle', mode: 'text', lastTranscript: null, error: null },
        },
      });
      expect(state.ui.activeView).toBe('storyboard');
    });

    it('should merge session overrides', () => {
      const state = createMockAppBrainState({
        session: {
          chatHistory: [],
          currentPersona: null,
          pendingToolCalls: [],
          lastAgentAction: null,
          isProcessing: true,
        },
      });
      expect(state.session.isProcessing).toBe(true);
    });
  });

  describe('createMockAppBrainStateWithManuscript', () => {
    it('should create state with specified text', () => {
      const state = createMockAppBrainStateWithManuscript('My story content');
      expect(state.manuscript.currentText).toBe('My story content');
    });

    it('should create state with default project id', () => {
      const state = createMockAppBrainStateWithManuscript('Text');
      expect(state.manuscript.projectId).toBe('test-project');
    });

    it('should create state with custom project id', () => {
      const state = createMockAppBrainStateWithManuscript('Text', 'custom-project');
      expect(state.manuscript.projectId).toBe('custom-project');
    });

    it('should create state with null project id', () => {
      const state = createMockAppBrainStateWithManuscript('Text', null);
      expect(state.manuscript.projectId).toBeNull();
    });

    it('should set project title', () => {
      const state = createMockAppBrainStateWithManuscript('Text');
      expect(state.manuscript.projectTitle).toBe('Test Project');
    });

    it('should create chapter with provided text', () => {
      const state = createMockAppBrainStateWithManuscript('Chapter content here');
      expect(state.manuscript.chapters[0].content).toBe('Chapter content here');
    });

    it('should initialize branches as empty array', () => {
      const state = createMockAppBrainStateWithManuscript('Text');
      expect(state.manuscript.branches).toEqual([]);
    });

    it('should set activeBranchId to null', () => {
      const state = createMockAppBrainStateWithManuscript('Text');
      expect(state.manuscript.activeBranchId).toBeNull();
    });
  });

  describe('createMockAgentState', () => {
    it('should create default state with idle status', () => {
      const state = createMockAgentState();
      expect(state.status).toBe('idle');
    });

    it('should accept status override', () => {
      const state = createMockAgentState({ status: 'thinking' });
      expect(state.status).toBe('thinking');
    });

    it('should accept other overrides', () => {
      const state = createMockAgentState({
        status: 'executing',
      });
      expect(state.status).toBe('executing');
    });
  });

  describe('createMockSelectionRange', () => {
    it('should create selection range with provided values', () => {
      const selection = createMockSelectionRange(10, 20, 'selected text');
      expect(selection.start).toBe(10);
      expect(selection.end).toBe(20);
      expect(selection.text).toBe('selected text');
    });

    it('should handle zero start position', () => {
      const selection = createMockSelectionRange(0, 5, 'start');
      expect(selection.start).toBe(0);
    });

    it('should handle empty text', () => {
      const selection = createMockSelectionRange(5, 5, '');
      expect(selection.text).toBe('');
      expect(selection.start).toBe(selection.end);
    });
  });

  describe('createSelectionFromText', () => {
    it('should find substring and create selection', () => {
      const selection = createSelectionFromText('Hello World', 'World');
      expect(selection).not.toBeNull();
      expect(selection!.start).toBe(6);
      expect(selection!.end).toBe(11);
      expect(selection!.text).toBe('World');
    });

    it('should return null when substring not found', () => {
      const selection = createSelectionFromText('Hello World', 'Goodbye');
      expect(selection).toBeNull();
    });

    it('should find substring at start', () => {
      const selection = createSelectionFromText('Hello World', 'Hello');
      expect(selection).not.toBeNull();
      expect(selection!.start).toBe(0);
      expect(selection!.end).toBe(5);
    });

    it('should find first occurrence of substring', () => {
      const selection = createSelectionFromText('Hello Hello', 'Hello');
      expect(selection).not.toBeNull();
      expect(selection!.start).toBe(0);
      expect(selection!.end).toBe(5);
    });

    it('should handle empty selectedText (finds at position 0)', () => {
      const selection = createSelectionFromText('Hello', '');
      expect(selection).not.toBeNull();
      expect(selection!.start).toBe(0);
      expect(selection!.end).toBe(0);
      expect(selection!.text).toBe('');
    });

    it('should handle full text selection', () => {
      const fullText = 'Complete text selection';
      const selection = createSelectionFromText(fullText, fullText);
      expect(selection).not.toBeNull();
      expect(selection!.start).toBe(0);
      expect(selection!.end).toBe(fullText.length);
    });
  });
});
