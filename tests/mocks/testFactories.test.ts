import { describe, expect, it } from 'vitest';
import {
  createFullMockAgentContextInput,
  createMockAgentContextInput,
  createMockAgentState,
  createMockAppBrainState,
  createMockAppBrainStateWithManuscript,
  createMockChapter,
  createMockChapters,
  createMockEditorContext,
  createMockEditorContextWithSelection,
  createMockGrammarSuggestion,
  createMockGrammarSuggestions,
  createMockPersona,
  createMockSelectionRange,
  createSelectionFromText,
} from '@/tests/mocks/testFactories';

describe('test factory utilities', () => {
  it('builds editor contexts with defaults and selections', () => {
    const defaultContext = createMockEditorContext();
    expect(defaultContext.cursorPosition).toBe(0);
    expect(defaultContext.selection).toBeNull();

    const overriddenContext = createMockEditorContext({
      cursorPosition: 5,
      selection: { start: 5, end: 10, text: 'override' },
      totalLength: 42,
    });
    expect(overriddenContext.cursorPosition).toBe(5);
    expect(overriddenContext.selection?.text).toBe('override');
    expect(overriddenContext.totalLength).toBe(42);

    const selectionContext = createMockEditorContextWithSelection(2, 6, 'value');
    expect(selectionContext.cursorPosition).toBe(2);
    expect(selectionContext.selection).toEqual({ start: 2, end: 6, text: 'value' });
  });

  it('generates chapters and persona fixtures', () => {
    const chapter = createMockChapter({
      id: 'chapter-test',
      title: 'Custom',
      order: 3,
      projectId: 'project-alpha',
      updatedAt: 123456,
    });
    expect(chapter.id).toBe('chapter-test');
    expect(chapter.order).toBe(3);
    expect(chapter.projectId).toBe('project-alpha');
    expect(chapter.updatedAt).toBe(123456);

    const chapters = createMockChapters(2);
    expect(chapters).toHaveLength(2);
    expect(chapters[1].title).toBe('Chapter 2');
    expect(chapters[1].order).toBe(1);

    const persona = createMockPersona({ id: 'persona-1', name: 'Hero', systemPrompt: 'Focus mode' });
    expect(persona.id).toBe('persona-1');
    expect(persona.systemPrompt).toBe('Focus mode');
    expect(persona.name).toBe('Hero');
    expect(createMockPersona().description).toBe('A test persona');
  });

  it('creates grammar suggestions with predictable offsets', () => {
    const single = createMockGrammarSuggestion({ start: 8, end: 13, message: 'Fix', severity: 'style' });
    expect(single.start).toBe(8);
    expect(single.end).toBe(13);
    expect(single.severity).toBe('style');

    const suggestions = createMockGrammarSuggestions(3, 5);
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0].start).toBe(5);
    expect(suggestions[1].start).toBe(15);
    expect(suggestions[2].message).toBe('Issue 3');
  });

  it('builds agent context inputs with defaults and full data', () => {
    const defaultContext = createMockAgentContextInput();
    expect(defaultContext.fullText).toContain('Test');
    expect(defaultContext.chapters).toHaveLength(1);
    expect(defaultContext.critiqueIntensity).toBe('balanced');

    const customContext = createMockAgentContextInput({
      fullText: 'Custom story',
      chapters: createMockChapters(2),
      critiqueIntensity: 'intensive',
      experienceLevel: 'pro',
      autonomyMode: 'auto',
    });
    expect(customContext.fullText).toBe('Custom story');
    expect(customContext.chapters).toHaveLength(2);
    expect(customContext.critiqueIntensity).toBe('intensive');
    expect(customContext.autonomyMode).toBe('auto');

    const fullContext = createFullMockAgentContextInput();
    expect(fullContext.lore).toBeDefined();
    expect(fullContext.projectId).toBe('test-project-id');
    expect(fullContext.analysis).toBeNull();
    expect(fullContext.intelligenceHUD).toBeNull();
  });

  it('creates app brain snapshots with manuscript helpers', () => {
    const brain = createMockAppBrainState({
      manuscript: { projectTitle: 'Merged', currentText: 'content', projectId: 'p-1' },
      ui: { activePanel: 'analysis' },
      session: { isProcessing: true },
    });
    expect(brain.manuscript.projectTitle).toBe('Merged');
    expect(brain.manuscript.currentText).toBe('content');
    expect(brain.ui.activePanel).toBe('analysis');
    expect(brain.session.isProcessing).toBe(true);

    const manuscriptBrain = createMockAppBrainStateWithManuscript('story text', null);
    expect(manuscriptBrain.manuscript.currentText).toBe('story text');
    expect(manuscriptBrain.manuscript.chapters).toHaveLength(1);
    expect(manuscriptBrain.manuscript.projectId).toBeNull();
  });

  it('exposes agent state and selection factories', () => {
    const idleState = createMockAgentState();
    expect(idleState.status).toBe('idle');

    const thinkingState = createMockAgentState({ status: 'thinking', lastError: 'fail' });
    expect(thinkingState.status).toBe('thinking');
    expect(thinkingState.lastError).toBe('fail');

    const selection = createMockSelectionRange(1, 4, 'hey');
    expect(selection).toEqual({ start: 1, end: 4, text: 'hey' });

    const found = createSelectionFromText('hello world', 'lo w');
    expect(found).toEqual({ start: 3, end: 7, text: 'lo w' });
    expect(createSelectionFromText('short', 'missing')).toBeNull();
  });
});
