/**
 * Test Factories
 *
 * Provides factory functions for creating mock objects for testing.
 * These factories create consistent, minimal mock objects that can be
 * customized with overrides.
 */

import type { EditorContext, GrammarSuggestion, AnalysisResult } from '@/types';
import type { Chapter, Lore } from '@/types/schema';
import type { Persona } from '@/types/personas';
import type { AppBrainState } from '@/services/appBrain/types';
import type { AgentContextInput, AgentState } from '@/services/core/AgentController';
import { createEmptyAppBrainState } from '@/services/appBrain';

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR CONTEXT FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal EditorContext for testing.
 */
export function createMockEditorContext(
  overrides: Partial<EditorContext> = {}
): EditorContext {
  return {
    cursorPosition: 0,
    selection: null,
    ...overrides,
  };
}

/**
 * Creates an EditorContext with a selection.
 */
export function createMockEditorContextWithSelection(
  start: number,
  end: number,
  text: string
): EditorContext {
  return {
    cursorPosition: start,
    selection: { start, end, text },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Chapter for testing.
 */
export function createMockChapter(
  overrides: Partial<Chapter> = {}
): Chapter {
  const id = overrides.id ?? `chapter-${Date.now()}`;
  return {
    id,
    title: `Test Chapter`,
    content: 'Test chapter content.',
    order: 0,
    ...overrides,
  };
}

/**
 * Creates multiple chapters for testing.
 */
export function createMockChapters(count: number): Chapter[] {
  return Array.from({ length: count }, (_, i) =>
    createMockChapter({
      id: `chapter-${i + 1}`,
      title: `Chapter ${i + 1}`,
      content: `Content for chapter ${i + 1}.`,
      order: i,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONA FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Persona for testing.
 */
export function createMockPersona(
  overrides: Partial<Persona> = {}
): Persona {
  return {
    id: 'test-persona',
    name: 'Test Persona',
    description: 'A test persona',
    systemPrompt: 'You are a helpful assistant.',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR SUGGESTION FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal GrammarSuggestion for testing.
 */
export function createMockGrammarSuggestion(
  overrides: Partial<GrammarSuggestion> = {}
): GrammarSuggestion {
  return {
    id: `suggestion-${Date.now()}`,
    start: 0,
    end: 5,
    replacement: 'fixed',
    message: 'Grammar issue',
    severity: 'grammar',
    originalText: 'error',
    ...overrides,
  };
}

/**
 * Creates multiple grammar suggestions for testing.
 */
export function createMockGrammarSuggestions(
  count: number,
  baseOffset = 0
): GrammarSuggestion[] {
  return Array.from({ length: count }, (_, i) =>
    createMockGrammarSuggestion({
      id: `suggestion-${i + 1}`,
      start: baseOffset + i * 10,
      end: baseOffset + i * 10 + 5,
      message: `Issue ${i + 1}`,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT CONTEXT FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal AgentContextInput for testing.
 */
export function createMockAgentContextInput(
  overrides: Partial<AgentContextInput> = {}
): AgentContextInput {
  return {
    fullText: 'Test manuscript content.',
    chapters: [createMockChapter()],
    critiqueIntensity: 'balanced',
    experienceLevel: 'intermediate',
    autonomyMode: 'balanced',
    ...overrides,
  };
}

/**
 * Creates an AgentContextInput with all optional fields populated.
 */
export function createFullMockAgentContextInput(): AgentContextInput {
  return {
    fullText: 'Full test manuscript with multiple paragraphs.\n\nSecond paragraph.',
    chapters: createMockChapters(3),
    lore: {
      characters: [],
      worldRules: [],
    },
    analysis: null,
    intelligenceHUD: null,
    interviewTarget: undefined,
    projectId: 'test-project-id',
    critiqueIntensity: 'balanced',
    experienceLevel: 'intermediate',
    autonomyMode: 'balanced',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// APP BRAIN STATE FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an AppBrainState for testing.
 */
export function createMockAppBrainState(
  overrides: Partial<AppBrainState> = {}
): AppBrainState {
  const base = createEmptyAppBrainState();
  return {
    ...base,
    ...overrides,
    manuscript: { ...base.manuscript, ...overrides.manuscript },
    intelligence: { ...base.intelligence, ...overrides.intelligence },
    analysis: { ...base.analysis, ...overrides.analysis },
    lore: { ...base.lore, ...overrides.lore },
    ui: { ...base.ui, ...overrides.ui },
    session: { ...base.session, ...overrides.session },
  };
}

/**
 * Creates an AppBrainState with typical manuscript content.
 */
export function createMockAppBrainStateWithManuscript(
  text: string,
  projectId: string | null = 'test-project'
): AppBrainState {
  return createMockAppBrainState({
    manuscript: {
      projectId,
      projectTitle: 'Test Project',
      chapters: [createMockChapter({ content: text })],
      activeChapterId: 'chapter-1',
      currentText: text,
      branches: [],
      activeBranchId: null,
      setting: undefined,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT STATE FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a minimal AgentState for testing.
 */
export function createMockAgentState(
  overrides: Partial<AgentState> = {}
): AgentState {
  return {
    status: 'idle',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION RANGE FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a selection range for testing.
 */
export function createMockSelectionRange(
  start: number,
  end: number,
  text: string
): { start: number; end: number; text: string } {
  return { start, end, text };
}

/**
 * Creates a selection range from a text and substring.
 */
export function createSelectionFromText(
  fullText: string,
  selectedText: string
): { start: number; end: number; text: string } | null {
  const start = fullText.indexOf(selectedText);
  if (start === -1) return null;
  return {
    start,
    end: start + selectedText.length,
    text: selectedText,
  };
}
