import type { AppBrainCommand, UIDependencies } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// UI Control Commands
// ─────────────────────────────────────────────────────────────────────────────

export class SwitchPanelCommand
  implements AppBrainCommand<string, string, UIDependencies>
{
  async execute(panel: string, deps: UIDependencies): Promise<string> {
    const validPanels = ['analysis', 'chat', 'lore', 'graph', 'branches', 'settings'];
    
    if (!validPanels.includes(panel.toLowerCase())) {
      return `Invalid panel "${panel}". Available: ${validPanels.join(', ')}`;
    }

    deps.switchPanel(panel);
    return `Switched to ${panel} panel`;
  }
}

export class ToggleZenModeCommand
  implements AppBrainCommand<void, string, UIDependencies>
{
  async execute(_params: void, deps: UIDependencies): Promise<string> {
    deps.toggleZenMode();
    return deps.isZenMode ? 'Exited Zen mode' : 'Entered Zen mode';
  }
}

export interface HighlightTextParams {
  start: number;
  end: number;
  style: 'warning' | 'error' | 'info' | 'success';
}

export class HighlightTextCommand
  implements AppBrainCommand<HighlightTextParams, string, UIDependencies>
{
  async execute(
    params: HighlightTextParams,
    deps: UIDependencies,
  ): Promise<string> {
    const { start, end, style } = params;

    if (start < 0 || end < start) {
      return `Invalid range: start=${start}, end=${end}`;
    }

    deps.highlightText(start, end, style);
    return `Highlighted text at positions ${start}-${end} with ${style} style`;
  }
}

export class SetSelectionCommand
  implements AppBrainCommand<{ start: number; end: number }, string, UIDependencies>
{
  async execute(
    params: { start: number; end: number },
    deps: UIDependencies,
  ): Promise<string> {
    const { start, end } = params;

    if (start < 0 || end < start) {
      return `Invalid selection range: start=${start}, end=${end}`;
    }

    deps.setSelection(start, end);
    return `Selected text at positions ${start}-${end}`;
  }
}
