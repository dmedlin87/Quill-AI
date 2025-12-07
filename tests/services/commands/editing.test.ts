import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UpdateManuscriptCommand,
  AppendTextCommand,
} from '@/services/commands/editing';
import type { EditingDependencies } from '@/services/commands/types';

const baseDeps: EditingDependencies = {
  currentText: 'Hello world. This is the original text.',
  commitEdit: vi.fn(),
  runExclusiveEdit: vi.fn(async (fn) => fn()),
};

describe('UpdateManuscriptCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when searchText not found', async () => {
    const cmd = new UpdateManuscriptCommand();
    const result = await cmd.execute(
      { searchText: 'nonexistent', replacementText: 'new', description: 'test' },
      baseDeps,
    );
    
    expect(result).toContain('Could not find');
    expect(baseDeps.commitEdit).not.toHaveBeenCalled();
  });

  it('replaces text and commits edit', async () => {
    const cmd = new UpdateManuscriptCommand();
    const result = await cmd.execute(
      { searchText: 'world', replacementText: 'universe', description: 'Replace world' },
      baseDeps,
    );
    
    expect(baseDeps.runExclusiveEdit).toHaveBeenCalled();
    expect(baseDeps.commitEdit).toHaveBeenCalledWith(
      'Hello universe. This is the original text.',
      'Replace world',
      'Agent',
    );
    expect(result).toContain('Successfully updated');
  });

  it('truncates long search text in error message', async () => {
    const longText = 'a'.repeat(100);
    const cmd = new UpdateManuscriptCommand();
    const result = await cmd.execute(
      { searchText: longText, replacementText: 'new', description: 'test' },
      baseDeps,
    );
    
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longText.length);
  });
});

describe('AppendTextCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends text with double newline', async () => {
    const cmd = new AppendTextCommand();
    const result = await cmd.execute(
      { text: 'New paragraph', description: 'Add paragraph' },
      baseDeps,
    );
    
    expect(baseDeps.runExclusiveEdit).toHaveBeenCalled();
    expect(baseDeps.commitEdit).toHaveBeenCalledWith(
      'Hello world. This is the original text.\n\nNew paragraph',
      'Add paragraph',
      'Agent',
    );
    expect(result).toContain('Appended text');
  });

  it('returns success message with description', async () => {
    const cmd = new AppendTextCommand();
    const result = await cmd.execute(
      { text: 'Content', description: 'My description' },
      baseDeps,
    );
    
    expect(result).toBe('Appended text: My description');
  });
});
