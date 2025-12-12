import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppBrainActions } from '@/services/appBrain';

// Hoisted mocks for command history and registry
vi.mock('@/services/commands/history', () => {
  const history = {
    record: vi.fn(),
    persist: vi.fn(),
    formatForPrompt: vi.fn().mockReturnValue('[HISTORY]'),
  };

  return {
    getCommandHistory: () => history,
  };
});

vi.mock('@/services/commands/registry', () => {
  const registry = {
    isReversible: vi.fn((name: string) => name === 'update_manuscript'),
    get: vi.fn(),
    has: vi.fn((name: string) => name === 'update_manuscript'),
  };

  return {
    CommandRegistry: registry,
  };
});

vi.mock('@/services/memory', () => {
  const createMemory = vi.fn().mockResolvedValue({
    text: 'Note text',
    scope: 'project',
    type: 'observation',
  });
  const updateMemory = vi.fn().mockResolvedValue({
    text: 'Updated text',
    scope: 'project',
    type: 'observation',
  });
  const deleteMemory = vi.fn().mockResolvedValue(undefined);
  const addGoal = vi.fn().mockResolvedValue({
    title: 'Goal',
    status: 'active',
    progress: 0,
  });
  const updateGoal = vi.fn().mockResolvedValue({
    title: 'Goal',
    status: 'completed',
    progress: 100,
  });
  const addWatchedEntity = vi.fn().mockResolvedValue({
    name: 'Seth',
    priority: 'high',
  });
  const applyBedsideNoteMutation = vi.fn().mockResolvedValue({
    text: 'New bedside note text',
  });
  const searchMemoriesByTags = vi.fn().mockResolvedValue([
    { scope: 'project', type: 'observation', text: 'note1' },
    { scope: 'author', type: 'preference', text: 'note2' },
  ]);
  const formatMemoriesForPrompt = vi.fn().mockReturnValue('formatted memories');

  return {
    createMemory,
    updateMemory,
    deleteMemory,
    addGoal,
    updateGoal,
    addWatchedEntity,
    applyBedsideNoteMutation,
    searchMemoriesByTags,
    formatMemoriesForPrompt,
  };
});

import * as memoryModule from '@/services/memory';
import { getCommandHistory } from '@/services/commands/history';
import { CommandRegistry } from '@/services/commands/registry';

import {
  isMemoryToolName,
  executeAppBrainToolCall,
  executeMemoryToolCall,
  executeAgentToolCall,
  ToolExecutor,
} from '@/services/gemini/toolExecutor';

const createMockActions = (): AppBrainActions => ({
  // Navigation
  navigateToText: vi.fn(async () => 'navigated'),
  jumpToChapter: vi.fn(async () => 'jumped'),
  jumpToScene: vi.fn(async () => 'scene'),
  scrollToPosition: vi.fn(),

  // Editing
  updateManuscript: vi.fn(async () => 'updated'),
  appendText: vi.fn(async () => 'appended'),
  undo: vi.fn(async () => 'undone'),
  redo: vi.fn(async () => 'redone'),

  // Analysis
  getCritiqueForSelection: vi.fn(async () => 'critique'),
  runAnalysis: vi.fn(async () => 'analysis'),

  // UI
  switchPanel: vi.fn(async () => 'switched'),
  toggleZenMode: vi.fn(async () => 'zen'),
  highlightText: vi.fn(async () => 'highlighted'),
  setMicrophoneState: vi.fn(),

  // Knowledge
  queryLore: vi.fn(async () => 'lore'),
  getCharacterInfo: vi.fn(async () => 'character info'),
  getTimelineContext: vi.fn(async () => 'timeline'),

  // Generation
  rewriteSelection: vi.fn(async () => 'rewritten'),
  continueWriting: vi.fn(async () => 'continued'),
});

describe('toolExecutor core helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identifies memory tool names correctly', () => {
    expect(isMemoryToolName('write_memory_note')).toBe(true);
    expect(isMemoryToolName('search_memory')).toBe(true);
    expect(isMemoryToolName('update_memory_note')).toBe(true);
    expect(isMemoryToolName('delete_memory_note')).toBe(true);
    expect(isMemoryToolName('create_goal')).toBe(true);
    expect(isMemoryToolName('update_goal')).toBe(true);
    expect(isMemoryToolName('watch_entity')).toBe(true);

    expect(isMemoryToolName('navigate_to_text')).toBe(false);
    expect(isMemoryToolName('rewrite_selection')).toBe(false);
  });

  it('routes update_manuscript to AppBrainActions with correct params', async () => {
    const actions = createMockActions();

    const result = await executeAppBrainToolCall(
      'update_manuscript',
      {
        search_text: 'old',
        replacement_text: 'new',
        description: 'desc',
      },
      actions,
    );

    expect(actions.updateManuscript).toHaveBeenCalledWith({
      searchText: 'old',
      replacementText: 'new',
      description: 'desc',
    });
    expect(result).toEqual({ success: true, message: 'updated' });
  });

  it('handles unknown AppBrain tools as success with message', async () => {
    const actions = createMockActions();

    const result = await executeAppBrainToolCall('unknown_tool', {}, actions);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Unknown tool: unknown_tool');
  });

  it('executes navigation and editing AppBrain tools', async () => {
    const actions = createMockActions();

    await executeAppBrainToolCall('navigate_to_text', { query: 'find me' }, actions);
    await executeAppBrainToolCall('jump_to_chapter', { identifier: 'ch1' }, actions);
    await executeAppBrainToolCall('jump_to_scene', { sceneType: 'fight', direction: 'next' }, actions);
    await executeAppBrainToolCall('scroll_to_position', { position: 42 }, actions);
    await executeAppBrainToolCall('append_to_manuscript', { text: 'add', description: 'desc' }, actions);
    await executeAppBrainToolCall('insert_at_cursor', { text: 'add', description: 'desc' }, actions);
    await executeAppBrainToolCall('undo_last_change', {}, actions);
    await executeAppBrainToolCall('redo_last_change', {}, actions);

    expect(actions.navigateToText).toHaveBeenCalledWith({
      query: 'find me',
      searchType: undefined,
      character: undefined,
      chapter: undefined,
    });
    expect(actions.jumpToChapter).toHaveBeenCalledWith('ch1');
    expect(actions.jumpToScene).toHaveBeenCalledWith('fight', 'next');
    expect(actions.scrollToPosition).toHaveBeenCalledWith(42);
    expect(actions.appendText).toHaveBeenCalledTimes(2);
    expect(actions.undo).toHaveBeenCalled();
    expect(actions.redo).toHaveBeenCalled();
  });

  it('executes analysis, UI, knowledge, and generation AppBrain tools', async () => {
    const actions = createMockActions();

    await executeAppBrainToolCall('get_critique_for_selection', { focus: 'para' }, actions);
    await executeAppBrainToolCall('run_analysis', { section: 'arc' }, actions);
    await executeAppBrainToolCall('switch_panel', { panel: 'analysis' }, actions);
    await executeAppBrainToolCall('toggle_zen_mode', {}, actions);
    await executeAppBrainToolCall('highlight_text', { start: 1, end: 3, style: 'info' }, actions);
    await executeAppBrainToolCall('set_selection', { start: 4, end: 6 }, actions);
    await executeAppBrainToolCall('query_lore', { query: 'dragons' }, actions);
    await executeAppBrainToolCall('get_character_info', { name: 'Ada' }, actions);
    await executeAppBrainToolCall('get_timeline_context', { range: 'all' }, actions);
    await executeAppBrainToolCall('rewrite_selection', { mode: 'shorter', targetTone: 'calm' }, actions);
    await executeAppBrainToolCall('continue_writing', {}, actions);

    expect(actions.getCritiqueForSelection).toHaveBeenCalledWith('para');
    expect(actions.runAnalysis).toHaveBeenCalledWith('arc');
    expect(actions.switchPanel).toHaveBeenCalledWith('analysis');
    expect(actions.toggleZenMode).toHaveBeenCalled();
    expect(actions.highlightText).toHaveBeenCalledWith(1, 3, 'info');
    expect(actions.highlightText).toHaveBeenCalledWith(4, 6, 'info');
    expect(actions.queryLore).toHaveBeenCalledWith('dragons');
    expect(actions.getCharacterInfo).toHaveBeenCalledWith('Ada');
    expect(actions.getTimelineContext).toHaveBeenCalledWith('all');
    expect(actions.rewriteSelection).toHaveBeenCalledWith({ mode: 'shorter', targetTone: 'calm' });
    expect(actions.continueWriting).toHaveBeenCalled();
  });

  it('captures errors from AppBrain actions with legacy param keys', async () => {
    const actions = createMockActions();
    (actions.updateManuscript as any).mockRejectedValueOnce(new Error('kaboom'));

    const result = await executeAppBrainToolCall(
      'update_manuscript',
      { search_text: 'old', replacement_text: 'new', description: 'desc' },
      actions,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('kaboom');
    expect(result.message).toContain('Error executing update_manuscript');
  });

  it('handles non-Error throws from AppBrain actions', async () => {
    const actions = createMockActions();
    (actions.updateManuscript as any).mockRejectedValueOnce('bad');

    const result = await executeAppBrainToolCall(
      'update_manuscript',
      { search_text: 'old', replacement_text: 'new', description: 'desc' },
      actions,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
    expect(result.message).toContain('Error executing update_manuscript');
  });

  it('wraps AppBrain action errors in ToolResult', async () => {
    const actions = createMockActions();
    (actions.updateManuscript as any).mockRejectedValueOnce(new Error('boom'));

    const result = await executeAppBrainToolCall(
      'update_manuscript',
      { search_text: 'a', replacement_text: 'b', description: 'c' },
      actions,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Error executing update_manuscript');
    expect(result.error).toBe('boom');
  });

  it('executes write_memory_note and returns formatted message', async () => {
    const result = await executeMemoryToolCall(
      'write_memory_note',
      {
        text: 'Note text',
        type: 'observation',
        scope: 'project',
        tags: ['tag1'],
        importance: 0.7,
      },
      'project-1',
    );

    expect(memoryModule.createMemory).toHaveBeenCalledWith({
      scope: 'project',
      projectId: 'project-1',
      text: 'Note text',
      type: 'observation',
      topicTags: ['tag1'],
      importance: 0.7,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved memory note');
  });

  it('truncates preview for long write_memory_note text', async () => {
    const longText = 'x'.repeat(200);
    vi.mocked(memoryModule.createMemory).mockResolvedValueOnce({
      text: longText,
      scope: 'project',
      type: 'observation',
    } as any);

    const result = await executeMemoryToolCall(
      'write_memory_note',
      { text: longText, type: 'observation', scope: 'project' },
      'project-1',
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('...');
  });

  it('fails to write project-scoped memory without projectId', async () => {
    const result = await executeMemoryToolCall(
      'write_memory_note',
      { text: 'Note text', type: 'observation', scope: 'project' },
      null,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('projectId');
  });

  it('returns failure for unknown memory tool', async () => {
    const result = await executeMemoryToolCall('unknown_memory', {}, 'project-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('UnknownMemoryTool');
  });

  it('executeAgentToolCall routes memory tools to executeMemoryToolCall', async () => {
    const actions = createMockActions();

    const result = await executeAgentToolCall(
      'write_memory_note',
      { text: 'Note text', type: 'observation', scope: 'author' },
      actions,
      'project-1',
    );

    expect(memoryModule.createMemory).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('search_memory defaults to scope=all and returns fallback message when formatting is empty', async () => {
    vi.mocked(memoryModule.formatMemoriesForPrompt).mockReturnValueOnce('');

    const result = await executeMemoryToolCall(
      'search_memory',
      { tags: [] },
      'project-1',
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('No matching memories found.');
  });

  it('handles update_bedside_note via memory helper', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'currentFocus', action: 'set', content: 'Fresh focus' },
      'project-1',
    );

    expect(memoryModule.applyBedsideNoteMutation).toHaveBeenCalledWith('project-1', {
      section: 'currentFocus',
      action: 'set',
      content: 'Fresh focus',
    });
    expect(result.message).toContain('Bedside note set applied');
    expect(result.success).toBe(true);
  });

  it('rejects update_bedside_note when required fields are missing', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'currentFocus', action: 'set' },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Missing required fields');
  });

  it('accepts bedside note list sections with non-empty content', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'warnings', action: 'add', content: ['One warning', '  ', 'Two'] },
      'project-1',
    );

    expect(memoryModule.applyBedsideNoteMutation).toHaveBeenCalledWith('project-1', {
      section: 'warnings',
      action: 'add',
      content: ['One warning', 'Two'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts bedside note activeGoals with string and object goals', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      {
        section: 'activeGoals',
        action: 'add',
        content: ['Goal 1', { title: 'Goal 2', status: 'active' }],
      },
      'project-1',
    );

    expect(memoryModule.applyBedsideNoteMutation).toHaveBeenCalledWith('project-1', {
      section: 'activeGoals',
      action: 'add',
      content: [{ title: 'Goal 1' }, { title: 'Goal 2', status: 'active' }],
    });
    expect(result.success).toBe(true);
  });

  it('returns error for invalid bedside note content', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'currentFocus', action: 'set', content: '   ' },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('currentFocus content');
    expect(result.message).toContain('currentFocus content');
  });

  it('rejects bedside note list sections with empty items', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'warnings', action: 'set', content: [] },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('warnings content');
  });

  it('rejects bedside note activeGoals without valid titles', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'activeGoals', action: 'set', content: ['   ', null] },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('activeGoals content');
  });

  it('rejects bedside note updates without projectId', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'currentFocus', action: 'set', content: 'focus' },
      null,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('projectId');
  });

  it('rejects unknown bedside note sections', async () => {
    const result = await executeMemoryToolCall(
      'update_bedside_note',
      { section: 'unknown_section', action: 'set', content: 'x' },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown bedside note section');
  });

  it('filters search_memory results by scope and type', async () => {
    const result = await executeMemoryToolCall(
      'search_memory',
      { tags: ['any'], scope: 'author', type: 'preference' },
      'project-1',
    );

    expect(memoryModule.searchMemoriesByTags).toHaveBeenCalledWith(['any'], {
      projectId: 'project-1',
      limit: 50,
    });
    expect(memoryModule.formatMemoriesForPrompt).toHaveBeenCalledWith(
      {
        author: [{ scope: 'author', type: 'preference', text: 'note2' }],
        project: [],
      },
      { maxLength: 2000 },
    );
    expect(result.success).toBe(true);
  });

  it('returns error when update_goal is missing id', async () => {
    const result = await executeMemoryToolCall(
      'update_goal',
      { progress: 10 },
      'project-1',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing id');
  });

  it('handles update_memory_note success and missing id errors', async () => {
    const success = await executeMemoryToolCall(
      'update_memory_note',
      { id: 'mem-1', text: 'new text', importance: 0.9, tags: ['x'] },
      'project-1',
    );
    expect(memoryModule.updateMemory).toHaveBeenCalledWith('mem-1', {
      text: 'new text',
      importance: 0.9,
      topicTags: ['x'],
    });
    expect(success.success).toBe(true);

    const missingId = await executeMemoryToolCall('update_memory_note', { text: 'x' }, 'project-1');
    expect(missingId.success).toBe(false);
    expect(missingId.message).toContain('Missing id');
  });

  it('truncates preview for long update_memory_note text', async () => {
    const longText = 'y'.repeat(200);
    vi.mocked(memoryModule.updateMemory).mockResolvedValueOnce({
      text: longText,
      scope: 'project',
      type: 'observation',
    } as any);

    const result = await executeMemoryToolCall(
      'update_memory_note',
      { id: 'mem-1', text: longText },
      'project-1',
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('...');
  });

  it('handles delete_memory_note success and missing id errors', async () => {
    const success = await executeMemoryToolCall(
      'delete_memory_note',
      { id: 'mem-1' },
      'project-1',
    );
    expect(memoryModule.deleteMemory).toHaveBeenCalledWith('mem-1');
    expect(success.success).toBe(true);

    const missingId = await executeMemoryToolCall('delete_memory_note', {}, 'project-1');
    expect(missingId.success).toBe(false);
    expect(missingId.message).toContain('Missing id');
  });

  it('handles create_goal success and validation errors', async () => {
    const success = await executeMemoryToolCall(
      'create_goal',
      { title: 'Goal title', description: 'desc' },
      'project-1',
    );
    expect(memoryModule.addGoal).toHaveBeenCalledWith({
      projectId: 'project-1',
      title: 'Goal title',
      description: 'desc',
      status: 'active',
    });
    expect(success.success).toBe(true);

    const missingTitle = await executeMemoryToolCall(
      'create_goal',
      { description: 'desc' },
      'project-1',
    );
    expect(missingTitle.success).toBe(false);
    expect(missingTitle.message).toContain('Missing title');

    const missingProject = await executeMemoryToolCall(
      'create_goal',
      { title: 'x' },
      null,
    );
    expect(missingProject.success).toBe(false);
    expect(missingProject.message).toContain('projectId');
  });

  it('handles update_goal success and status/progress updates', async () => {
    const success = await executeMemoryToolCall(
      'update_goal',
      { id: 'goal-1', progress: 50, status: 'completed' },
      'project-1',
    );
    expect(memoryModule.updateGoal).toHaveBeenCalledWith('goal-1', {
      progress: 50,
      status: 'completed',
    });
    expect(success.success).toBe(true);
  });

  it('handles watch_entity success and validation errors', async () => {
    const success = await executeMemoryToolCall(
      'watch_entity',
      { name: 'Seth', priority: 'high', reason: 'hero' },
      'project-1',
    );
    expect(memoryModule.addWatchedEntity).toHaveBeenCalledWith({
      name: 'Seth',
      projectId: 'project-1',
      priority: 'high',
      reason: 'hero',
    });
    expect(success.success).toBe(true);

    const missingName = await executeMemoryToolCall(
      'watch_entity',
      { priority: 'low' },
      'project-1',
    );
    expect(missingName.success).toBe(false);
    expect(missingName.message).toContain('Missing name');

    const missingProject = await executeMemoryToolCall(
      'watch_entity',
      { name: 'Seth' },
      null,
    );
    expect(missingProject.success).toBe(false);
    expect(missingProject.message).toContain('projectId');
  });
});

describe('ToolExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes non-memory tools and records to history', async () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);

    const args = {
      search_text: 'old',
      replacement_text: 'new',
      description: 'desc',
    };

    const result = await executor.execute('update_manuscript', args);

    expect(result).toEqual({ success: true, message: 'updated' });
    const history = getCommandHistory();
    expect(history.record).toHaveBeenCalledWith({
      toolName: 'update_manuscript',
      params: args,
      result: 'updated',
      success: true,
      reversible: true,
    });
    expect(history.persist).toHaveBeenCalled();
  });

  it('does not record history for memory tools', async () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);

    await executor.execute('write_memory_note', {
      text: 'Note text',
      type: 'observation',
      scope: 'project',
    });

    const history = getCommandHistory();
    expect(history.record).not.toHaveBeenCalled();
    expect(memoryModule.createMemory).toHaveBeenCalled();
  });

  it('exposes command metadata via getCommandInfo', () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);

    const meta = { name: 'update_manuscript' } as any;
    (CommandRegistry.get as any).mockReturnValueOnce(meta);

    expect(executor.getCommandInfo('update_manuscript')).toBe(meta);
    expect(CommandRegistry.get).toHaveBeenCalledWith('update_manuscript');
  });

  it('hasCommand checks registry and memory tools', () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);

    (CommandRegistry.has as any).mockReturnValueOnce(true);
    expect(executor.hasCommand('update_manuscript')).toBe(true);

    (CommandRegistry.has as any).mockReturnValueOnce(false);
    expect(executor.hasCommand('watch_entity')).toBe(true);
  });

  it('getHistoryForPrompt delegates to CommandHistory', () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);

    const text = executor.getHistoryForPrompt(3);

    const history = getCommandHistory();
    expect(history.formatForPrompt).toHaveBeenCalledWith(3);
    expect(text).toBe('[HISTORY]');
  });

  it('skips history recording when recordHistory is false', async () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', false);

    await executor.execute('update_manuscript', {
      search_text: 'old',
      replacement_text: 'new',
      description: 'desc',
    });

    const history = getCommandHistory();
    expect(history.record).not.toHaveBeenCalled();
    expect(history.persist).not.toHaveBeenCalled();
  });

  it('records reversible flag as false for non-reversible commands', async () => {
    const actions = createMockActions();
    const executor = new ToolExecutor(actions, 'project-1', true);
    (CommandRegistry.isReversible as any).mockReturnValueOnce(false);

    await executor.execute('navigate_to_text', { query: 'hello' });

    const history = getCommandHistory();
    expect(history.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'navigate_to_text',
        reversible: false,
      }),
    );
  });
});
