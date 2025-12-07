import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CommandRegistry } from '@/services/commands';

describe('CommandRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes default command metadata and instances', () => {
    const names = CommandRegistry.getAllNames();

    expect(names).toContain('navigate_to_text');
    expect(names).toContain('update_manuscript');
    expect(names).toContain('rewrite_selection');

    const navigationMeta = CommandRegistry.get('navigate_to_text');
    expect(navigationMeta?.category).toBe('navigation');
    expect(CommandRegistry.create('navigate_to_text')).toBeDefined();
  });

  it('checks reversibility, categories, and unknown lookups', () => {
    expect(CommandRegistry.isReversible('update_manuscript')).toBe(true);
    expect(CommandRegistry.isReversible('navigate_to_text')).toBe(false);
    expect(CommandRegistry.isReversible('unknown_command')).toBe(false);

    const generation = CommandRegistry.getByCategory('generation');
    expect(generation.some((meta) => meta.name === 'rewrite_selection')).toBe(true);
    expect(CommandRegistry.create('unknown_command')).toBeUndefined();
  });

  it('registers and resolves custom commands at runtime', async () => {
    const factory = vi.fn(() => ({
      async execute() {
        return 'ok';
      },
    }));

    CommandRegistry.register({
      name: 'custom_command_registry_test',
      category: 'ui',
      description: 'Custom runtime command',
      reversible: false,
      factory,
    });

    expect(CommandRegistry.has('custom_command_registry_test')).toBe(true);
    const meta = CommandRegistry.get('custom_command_registry_test');
    expect(meta?.description).toBe('Custom runtime command');
    expect(factory).not.toHaveBeenCalled();

    const instance = CommandRegistry.create('custom_command_registry_test');
    expect(instance).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(instance!.execute(undefined as never, undefined as never)).resolves.toBe('ok');
  });
});
