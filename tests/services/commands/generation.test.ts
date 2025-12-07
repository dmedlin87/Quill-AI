import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RewriteSelectionCommand,
  ContinueWritingCommand,
  SuggestDialogueCommand,
} from '@/services/commands/generation';

const baseDeps = {
  currentText: 'Hello world. This is a fairly long paragraph providing enough context for AI continuation.',
  selection: { start: 6, end: 11, text: 'world' },
  commitEdit: vi.fn(),
  runExclusiveEdit: vi.fn(async (fn) => fn()),
  generateRewrite: vi.fn(async (_text: string, _mode: string) => 'rewritten'),
  generateContinuation: vi.fn(async () => 'new continuation content'),
};

describe('RewriteSelectionCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns message when no selection', async () => {
    const cmd = new RewriteSelectionCommand();
    const result = await cmd.execute(
      { mode: 'rephrase' },
      { ...baseDeps, selection: null },
    );
    expect(result).toContain('No text selected');
    expect(baseDeps.commitEdit).not.toHaveBeenCalled();
  });

  it('returns message when selection is empty', async () => {
    const cmd = new RewriteSelectionCommand();
    const result = await cmd.execute(
      { mode: 'rephrase' },
      { ...baseDeps, selection: { start: 0, end: 1, text: '   ' } },
    );
    expect(result).toContain('Selected text is empty');
  });

  it('rewrites selection and commits edit with description', async () => {
    const cmd = new RewriteSelectionCommand();
    const result = await cmd.execute({ mode: 'expand', targetTone: 'formal' }, baseDeps);

    expect(baseDeps.runExclusiveEdit).toHaveBeenCalled();
    expect(baseDeps.generateRewrite).toHaveBeenCalledWith('world', 'expand', 'formal');
    expect(baseDeps.commitEdit).toHaveBeenCalledWith(
      expect.stringContaining('rewritten'),
      'Rewrite (expand) with formal tone',
      'Agent',
    );
    expect(result).toContain('Rewrote selection using expand mode');
  });
});

describe('ContinueWritingCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when context is too short', async () => {
    const cmd = new ContinueWritingCommand();
    const shortDeps = { ...baseDeps, currentText: 'Too short' };
    const result = await cmd.execute(undefined as never, shortDeps);
    expect(result).toContain('Not enough context');
    expect(shortDeps.commitEdit).not.toHaveBeenCalled();
  });

  it('generates continuation and commits with word count', async () => {
    const cmd = new ContinueWritingCommand();
    const result = await cmd.execute(undefined as never, baseDeps);

    expect(baseDeps.runExclusiveEdit).toHaveBeenCalled();
    expect(baseDeps.generateContinuation).toHaveBeenCalledWith({
      context: expect.stringContaining('Hello'),
      selection: 'world',
    });
    expect(baseDeps.commitEdit).toHaveBeenCalledWith(
      expect.stringContaining('new continuation content'),
      'AI continuation',
      'Agent',
    );
    expect(result).toMatch(/Added \d+ words of continuation/);
  });
});

describe('SuggestDialogueCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates dialogue using provided context and appends to text', async () => {
    const cmd = new SuggestDialogueCommand();
    const deps = { ...baseDeps };
    const result = await cmd.execute({ character: 'Alice', context: 'custom scene' }, deps);

    expect(deps.runExclusiveEdit).toHaveBeenCalled();
    expect(deps.generateRewrite).toHaveBeenCalledWith(
      '[Generate dialogue for Alice]',
      'rephrase',
      'in-character as Alice',
    );
    expect(deps.commitEdit).toHaveBeenCalledWith(
      expect.stringContaining('\n\nrewritten'),
      'Dialogue suggestion for Alice',
      'Agent',
    );
    expect(result).toBe('Generated dialogue for Alice.');
  });
});
