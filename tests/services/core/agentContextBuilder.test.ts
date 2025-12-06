import { describe, expect, it } from 'vitest';

import { buildAgentContextPrompt } from '@/services/core/agentContextBuilder';
import { EditorContext } from '@/types';

const editorContext: EditorContext = {
  cursorPosition: 10,
  selection: { start: 5, end: 8, text: 'abc' },
  totalLength: 200,
};

describe('buildAgentContextPrompt', () => {
  it('uses smart context when provided and trims user text', () => {
    const prompt = buildAgentContextPrompt({
      smartContext: '[SMART]',
      userText: '  Hello  ',
      mode: 'text',
    });

    expect(prompt).toContain('[CONTEXT]');
    expect(prompt).toContain('Source: Smart Context');
    expect(prompt).toContain('[SMART]');
    expect(prompt).toContain('[USER REQUEST]\nHello');
  });

  it('falls back to editor context with selection details', () => {
    const prompt = buildAgentContextPrompt({
      userText: 'Edit this',
      mode: 'text',
      editorContext,
    });

    expect(prompt).toContain('Source: Editor Fallback');
    expect(prompt).toContain('Cursor Index: 10');
    expect(prompt).toContain('Selection: "abc"');
    expect(prompt).toContain('Selection Range: 5-8 (len 3)');
    expect(prompt).toContain('Total Text Length: 200');
  });

  it('formats UI state with truncation and microphone transcript', () => {
    const longSelection = 'x'.repeat(150);
    const longTranscript = 't'.repeat(130);

    const prompt = buildAgentContextPrompt({
      userText: 'Check UI',
      mode: 'voice',
      uiState: {
        cursor: { position: 3 },
        selection: { text: longSelection },
        activePanel: 'analysis',
        microphone: { status: 'recording', lastTranscript: longTranscript },
      },
    });

    expect(prompt).toContain('[USER STATE]');
    expect(prompt).toContain('Active Panel: analysis');
    expect(prompt).toMatch(/Selection: "x{100}\.\.\."/);
    expect(prompt).toMatch(/last transcript: "t{120}\.\.\."/);
  });

  it('trims recent events and handles empty user text', () => {
    const prompt = buildAgentContextPrompt({
      userText: '   ',
      mode: 'text',
      recentEvents: '  event-a\n',
    });

    expect(prompt).toContain('[RECENT EVENTS]\nevent-a');
    expect(prompt).toContain('[USER REQUEST]\n(No user input provided)');
  });

  it('indicates unknown context when nothing is provided', () => {
    const prompt = buildAgentContextPrompt({
      userText: 'Hi',
      mode: 'text',
    });

    expect(prompt).toContain('[CONTEXT]\nSource: Unknown');
  });
});
