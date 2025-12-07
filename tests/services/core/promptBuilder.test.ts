import { describe, it, expect } from 'vitest';
import { buildUserContextPrompt } from '@/services/core/promptBuilder';
import type { EditorContext } from '@/types';

describe('buildUserContextPrompt', () => {
  const baseContext: EditorContext = {
    cursorPosition: 50,
    selection: null,
    totalLength: 500,
  };

  it('includes cursor position', () => {
    const result = buildUserContextPrompt(baseContext, 'Test request');
    
    expect(result).toContain('Cursor Index: 50');
  });

  it('includes total text length', () => {
    const result = buildUserContextPrompt(baseContext, 'Test request');
    
    expect(result).toContain('Total Text Length: 500');
  });

  it('shows Selection: None when no selection', () => {
    const result = buildUserContextPrompt(baseContext, 'Test request');
    
    expect(result).toContain('Selection: None');
    expect(result).toContain('Selection Range: None');
  });

  it('includes selection text when present', () => {
    const contextWithSelection: EditorContext = {
      ...baseContext,
      selection: { start: 10, end: 30, text: 'selected text here' },
    };
    
    const result = buildUserContextPrompt(contextWithSelection, 'Test request');
    
    expect(result).toContain('"selected text here"');
    expect(result).toContain('10-30');
  });

  it('truncates long selection text', () => {
    const longText = 'a'.repeat(200);
    const contextWithSelection: EditorContext = {
      ...baseContext,
      selection: { start: 0, end: 200, text: longText },
    };
    
    const result = buildUserContextPrompt(contextWithSelection, 'Test request');
    
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longText.length + 200);
  });

  it('includes user request text', () => {
    const result = buildUserContextPrompt(baseContext, 'Please fix this paragraph');
    
    expect(result).toContain('[USER REQUEST]');
    expect(result).toContain('Please fix this paragraph');
  });

  it('shows placeholder when user text empty', () => {
    const result = buildUserContextPrompt(baseContext, '');
    
    expect(result).toContain('(No user input provided)');
  });

  it('trims whitespace from user text', () => {
    const result = buildUserContextPrompt(baseContext, '   some request   ');
    
    expect(result).toContain('some request');
  });
});
