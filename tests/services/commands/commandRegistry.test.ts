import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '@/services/commands';

describe('CommandRegistry', () => {
  it('registers default commands and can resolve them', () => {
    // Defaults are registered in constructor
    const allNames = CommandRegistry.getAllNames();

    expect(allNames).toContain('navigate_to_text');
    expect(allNames).toContain('jump_to_chapter');
    expect(allNames).toContain('run_analysis');
    expect(allNames).toContain('switch_panel');
    expect(allNames).toContain('rewrite_selection');

    const meta = CommandRegistry.get('navigate_to_text');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('navigation');

    const instance = CommandRegistry.create('navigate_to_text');
    expect(instance).toBeDefined();
    expect(typeof instance!.execute).toBe('function');
  });

  it('reports reversibility correctly and groups by category', () => {
    expect(CommandRegistry.isReversible('update_manuscript')).toBe(true);
    expect(CommandRegistry.isReversible('navigate_to_text')).toBe(false);

    const editingCommands = CommandRegistry.getByCategory('editing');
    expect(editingCommands.length).toBeGreaterThan(0);
    expect(editingCommands.some(c => c.name === 'update_manuscript')).toBe(true);
  });

  it('allows registering custom commands at runtime', () => {
    const factory = () => ({
      name: 'custom',
      category: 'ui',
      async execute() {
        return 'done';
      },
    }) as any;

    CommandRegistry.register({
      name: 'custom_command',
      category: 'ui',
      description: 'Custom test command',
      reversible: false,
      factory,
    });

    expect(CommandRegistry.has('custom_command')).toBe(true);

    const meta = CommandRegistry.get('custom_command');
    expect(meta?.description).toBe('Custom test command');

    const instance = CommandRegistry.create('custom_command');
    expect(instance).toBeDefined();
    expect(instance!.execute).toBeTypeOf('function');
  });

  it('getAll returns all registered command metadata', () => {
    const allCommands = CommandRegistry.getAll();

    expect(allCommands.length).toBeGreaterThan(10);
    expect(allCommands.every(c => c.name && c.category && c.description)).toBe(true);
    expect(allCommands.some(c => c.name === 'navigate_to_text')).toBe(true);
    expect(allCommands.some(c => c.name === 'update_manuscript')).toBe(true);
  });

  it('returns undefined for unknown command', () => {
    expect(CommandRegistry.get('nonexistent_command')).toBeUndefined();
    expect(CommandRegistry.create('nonexistent_command')).toBeUndefined();
    expect(CommandRegistry.has('nonexistent_command')).toBe(false);
  });

  it('isReversible returns false for unknown command', () => {
    expect(CommandRegistry.isReversible('nonexistent_command')).toBe(false);
  });

  it('creates instances of all default commands', () => {
    const allCommands = CommandRegistry.getAll();

    for (const meta of allCommands) {
      const instance = CommandRegistry.create(meta.name);
      expect(instance, `Command ${meta.name} should create instance`).toBeDefined();
      expect(typeof instance!.execute).toBe('function');
    }
  });

  it('getByCategory returns commands filtered by category', () => {
    const navigationCommands = CommandRegistry.getByCategory('navigation');
    expect(navigationCommands.length).toBeGreaterThan(0);
    expect(navigationCommands.every(c => c.category === 'navigation')).toBe(true);
    expect(navigationCommands.some(c => c.name === 'navigate_to_text')).toBe(true);
    expect(navigationCommands.some(c => c.name === 'jump_to_chapter')).toBe(true);
    expect(navigationCommands.some(c => c.name === 'jump_to_scene')).toBe(true);

    const generationCommands = CommandRegistry.getByCategory('generation');
    expect(generationCommands.length).toBeGreaterThan(0);
    expect(generationCommands.every(c => c.category === 'generation')).toBe(true);
    expect(generationCommands.some(c => c.name === 'rewrite_selection')).toBe(true);
    expect(generationCommands.some(c => c.name === 'continue_writing')).toBe(true);
    expect(generationCommands.some(c => c.name === 'suggest_dialogue')).toBe(true);

    const analysisCommands = CommandRegistry.getByCategory('analysis');
    expect(analysisCommands.length).toBeGreaterThan(0);
    expect(analysisCommands.some(c => c.name === 'get_critique_for_selection')).toBe(true);
    expect(analysisCommands.some(c => c.name === 'run_analysis')).toBe(true);

    const knowledgeCommands = CommandRegistry.getByCategory('knowledge');
    expect(knowledgeCommands.length).toBeGreaterThan(0);
    expect(knowledgeCommands.some(c => c.name === 'query_lore')).toBe(true);
    expect(knowledgeCommands.some(c => c.name === 'get_character_info')).toBe(true);

    const uiCommands = CommandRegistry.getByCategory('ui');
    expect(uiCommands.length).toBeGreaterThan(0);
    expect(uiCommands.some(c => c.name === 'switch_panel')).toBe(true);
    expect(uiCommands.some(c => c.name === 'toggle_zen_mode')).toBe(true);
    expect(uiCommands.some(c => c.name === 'highlight_text')).toBe(true);
    expect(uiCommands.some(c => c.name === 'set_selection')).toBe(true);
  });

  it('all editing commands are reversible', () => {
    const editingCommands = CommandRegistry.getByCategory('editing');
    expect(editingCommands.every(c => c.reversible)).toBe(true);
  });

  it('all generation commands are reversible', () => {
    const generationCommands = CommandRegistry.getByCategory('generation');
    expect(generationCommands.every(c => c.reversible)).toBe(true);
  });

  it('navigation commands are not reversible', () => {
    const navigationCommands = CommandRegistry.getByCategory('navigation');
    expect(navigationCommands.every(c => !c.reversible)).toBe(true);
  });
});
