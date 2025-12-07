import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SwitchPanelCommand,
  ToggleZenModeCommand,
  HighlightTextCommand,
  SetSelectionCommand,
} from '@/services/commands/ui';
import type { UIDependencies } from '@/services/commands/types';

const baseDeps: UIDependencies = {
  switchPanel: vi.fn(),
  toggleZenMode: vi.fn(),
  isZenMode: false,
  highlightText: vi.fn(),
  setSelection: vi.fn(),
  activePanel: 'analysis',
};

describe('SwitchPanelCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches to valid panel', async () => {
    const cmd = new SwitchPanelCommand();
    const result = await cmd.execute('analysis', baseDeps);
    
    expect(baseDeps.switchPanel).toHaveBeenCalledWith('analysis');
    expect(result).toBe('Switched to analysis panel');
  });

  it('rejects invalid panel', async () => {
    const cmd = new SwitchPanelCommand();
    const result = await cmd.execute('invalid', baseDeps);
    
    expect(baseDeps.switchPanel).not.toHaveBeenCalled();
    expect(result).toContain('Invalid panel');
    expect(result).toContain('analysis, chat, lore');
  });

  it('is case-insensitive', async () => {
    const cmd = new SwitchPanelCommand();
    const result = await cmd.execute('CHAT', baseDeps);
    
    expect(baseDeps.switchPanel).toHaveBeenCalledWith('CHAT');
  });
});

describe('ToggleZenModeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enters zen mode when currently off', async () => {
    const cmd = new ToggleZenModeCommand();
    const result = await cmd.execute(undefined, { ...baseDeps, isZenMode: false });
    
    expect(baseDeps.toggleZenMode).toHaveBeenCalled();
    expect(result).toBe('Entered Zen mode');
  });

  it('exits zen mode when currently on', async () => {
    const cmd = new ToggleZenModeCommand();
    const result = await cmd.execute(undefined, { ...baseDeps, isZenMode: true });
    
    expect(baseDeps.toggleZenMode).toHaveBeenCalled();
    expect(result).toBe('Exited Zen mode');
  });
});

describe('HighlightTextCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('highlights text at valid range', async () => {
    const cmd = new HighlightTextCommand();
    const result = await cmd.execute(
      { start: 10, end: 20, style: 'warning' },
      baseDeps,
    );
    
    expect(baseDeps.highlightText).toHaveBeenCalledWith(10, 20, 'warning');
    expect(result).toContain('Highlighted text at positions 10-20');
    expect(result).toContain('warning');
  });

  it('rejects negative start', async () => {
    const cmd = new HighlightTextCommand();
    const result = await cmd.execute(
      { start: -1, end: 10, style: 'error' },
      baseDeps,
    );
    
    expect(baseDeps.highlightText).not.toHaveBeenCalled();
    expect(result).toContain('Invalid range');
  });

  it('rejects end before start', async () => {
    const cmd = new HighlightTextCommand();
    const result = await cmd.execute(
      { start: 20, end: 10, style: 'info' },
      baseDeps,
    );
    
    expect(baseDeps.highlightText).not.toHaveBeenCalled();
    expect(result).toContain('Invalid range');
  });
});

describe('SetSelectionCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets selection at valid range', async () => {
    const cmd = new SetSelectionCommand();
    const result = await cmd.execute({ start: 5, end: 15 }, baseDeps);
    
    expect(baseDeps.setSelection).toHaveBeenCalledWith(5, 15);
    expect(result).toContain('Selected text at positions 5-15');
  });

  it('rejects negative start', async () => {
    const cmd = new SetSelectionCommand();
    const result = await cmd.execute({ start: -5, end: 10 }, baseDeps);
    
    expect(baseDeps.setSelection).not.toHaveBeenCalled();
    expect(result).toContain('Invalid selection range');
  });

  it('rejects end before start', async () => {
    const cmd = new SetSelectionCommand();
    const result = await cmd.execute({ start: 30, end: 20 }, baseDeps);
    
    expect(baseDeps.setSelection).not.toHaveBeenCalled();
    expect(result).toContain('Invalid selection range');
  });
});
