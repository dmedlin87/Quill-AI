import { describe, it, expect, vi } from 'vitest';
import { GetCritiqueCommand, RunAnalysisCommand } from '@/services/commands/analysis';

describe('GetCritiqueCommand', () => {
  it('returns guidance when no selection is present', async () => {
    const cmd = new GetCritiqueCommand();
    const deps = { selection: undefined } as any;

    const result = await cmd.execute('focus', deps);

    expect(result).toBe('No text selected. Please select text to critique.');
  });

  it('includes focus or defaults to "all" in the critique message', async () => {
    const cmd = new GetCritiqueCommand();
    const deps = {
      selection: { text: 'Some selected text that is long enough', start: 0, end: 10 },
    } as any;

    const withFocus = await cmd.execute('characters', deps);
    expect(withFocus).toContain('Critique for:');
    expect(withFocus).toContain('Focus: characters');

    const defaultFocus = await cmd.execute(undefined, deps);
    expect(defaultFocus).toContain('Critique for:');
    expect(defaultFocus).toContain('Focus: all');
  });
});

describe('RunAnalysisCommand', () => {
  const createDeps = () => {
    const text = 'Full manuscript text for analysis';
    const setting = 'Gothic castle';

    return {
      currentText: text,
      setting,
      analyzePacing: vi.fn(async () => {}),
      analyzeCharacters: vi.fn(async () => {}),
      analyzePlot: vi.fn(async () => {}),
      analyzeSetting: vi.fn(async () => {}),
      runFullAnalysis: vi.fn(async () => {}),
    };
  };

  it('routes to pacing analysis when section is pacing', async () => {
    const deps = createDeps();
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute('pacing', deps as any);

    expect(deps.analyzePacing).toHaveBeenCalledWith(deps.currentText, deps.setting);
    expect(result).toBe('Pacing analysis complete');
  });

  it('routes to character analysis when section is characters', async () => {
    const deps = createDeps();
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute('characters', deps as any);

    expect(deps.analyzeCharacters).toHaveBeenCalledWith(deps.currentText);
    expect(result).toBe('Character analysis complete');
  });

  it('routes to plot analysis when section is plot', async () => {
    const deps = createDeps();
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute('plot', deps as any);

    expect(deps.analyzePlot).toHaveBeenCalledWith(deps.currentText);
    expect(result).toBe('Plot analysis complete');
  });

  it('routes to setting analysis when section is setting and a setting is provided', async () => {
    const deps = createDeps();
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute('setting', deps as any);

    expect(deps.analyzeSetting).toHaveBeenCalledWith(deps.currentText, deps.setting);
    expect(result).toBe('Setting analysis complete');
  });

  it('falls back to full analysis when section is setting but no setting is available', async () => {
    const deps = createDeps();
    deps.setting = undefined;
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute('setting', deps as any);

    expect(deps.runFullAnalysis).toHaveBeenCalledWith(deps.currentText, undefined);
    expect(result).toBe('Full analysis complete');
  });

  it('falls back to full analysis for unknown or missing section', async () => {
    const deps = createDeps();
    const cmd = new RunAnalysisCommand();

    const result = await cmd.execute(undefined, deps as any);

    expect(deps.runFullAnalysis).toHaveBeenCalledWith(deps.currentText, deps.setting);
    expect(result).toBe('Full analysis complete');
  });
});
