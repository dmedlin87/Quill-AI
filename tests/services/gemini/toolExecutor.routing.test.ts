import { describe, it, expect, vi } from 'vitest';
import { executeAppBrainToolCall, isMemoryToolName } from '@/services/gemini/toolExecutor';

const mockActions = {
  navigateToText: vi.fn(async () => 'navigated'),
  jumpToChapter: vi.fn(async () => 'chapter'),
  jumpToScene: vi.fn(async () => 'scene'),
  scrollToPosition: vi.fn(),
  updateManuscript: vi.fn(async () => 'updated'),
  appendText: vi.fn(async () => 'appended'),
  setSelection: vi.fn(),
  highlightText: vi.fn(),
  toggleZenMode: vi.fn(),
  setMicrophoneState: vi.fn(),
  rewriteSelection: vi.fn(async () => 'rewritten'),
  continueWriting: vi.fn(async () => 'continued'),
  runAnalysis: vi.fn(async () => 'analysis'),
  getCritique: vi.fn(async () => 'critique'),
  queryLore: vi.fn(async () => 'lore'),
  getCharacterInfo: vi.fn(async () => 'character'),
  createMemory: vi.fn(async () => 'memory'),
  searchMemory: vi.fn(async () => 'search'),
  updateMemory: vi.fn(async () => 'update'),
  deleteMemory: vi.fn(async () => 'delete'),
  createGoal: vi.fn(async () => 'goal'),
  updateGoal: vi.fn(async () => 'goal'),
  watchEntity: vi.fn(async () => 'watch'),
};

describe('executeAppBrainToolCall', () => {
  it('routes navigation tool calls', async () => {
    const result = await executeAppBrainToolCall('navigate_to_text', { query: 'hello' }, mockActions as any);
    expect(result.message).toContain('navigated');
    expect(mockActions.navigateToText).toHaveBeenCalled();
  });

  it('captures errors from actions', async () => {
    const errorActions = { ...mockActions, navigateToText: vi.fn(() => Promise.reject(new Error('boom'))) } as any;
    const result = await executeAppBrainToolCall('navigate_to_text', { query: 'oops' }, errorActions);
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });
});

describe('memory tool detection', () => {
  it('recognizes memory tool names', () => {
    expect(isMemoryToolName('write_memory_note')).toBe(true);
    expect(isMemoryToolName('navigate_to_text')).toBe(false);
  });
});
