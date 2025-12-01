import type { AppBrainCommand } from './types';

// Navigation Commands
import {
  NavigateToTextCommand,
  JumpToChapterCommand,
  JumpToSceneCommand,
} from './navigation';

// Editing Commands
import { UpdateManuscriptCommand, AppendTextCommand } from './editing';

// Analysis Commands
import { GetCritiqueCommand, RunAnalysisCommand } from './analysis';

// Knowledge Commands
import { QueryLoreCommand, GetCharacterInfoCommand } from './knowledge';

// UI Commands
import {
  SwitchPanelCommand,
  ToggleZenModeCommand,
  HighlightTextCommand,
  SetSelectionCommand,
} from './ui';

// Generation Commands
import {
  RewriteSelectionCommand,
  ContinueWritingCommand,
  SuggestDialogueCommand,
} from './generation';

// ─────────────────────────────────────────────────────────────────────────────
// Command Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandMeta {
  name: string;
  category: 'navigation' | 'editing' | 'analysis' | 'knowledge' | 'ui' | 'generation';
  description: string;
  reversible: boolean;
  factory: () => AppBrainCommand<unknown, unknown, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registry
// ─────────────────────────────────────────────────────────────────────────────

class CommandRegistryImpl {
  private commands = new Map<string, CommandMeta>();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register a command with metadata
   */
  register(meta: CommandMeta): void {
    this.commands.set(meta.name, meta);
  }

  /**
   * Get a command by name
   */
  get(name: string): CommandMeta | undefined {
    return this.commands.get(name);
  }

  /**
   * Create a command instance by name
   */
  create(name: string): AppBrainCommand<unknown, unknown, unknown> | undefined {
    const meta = this.commands.get(name);
    return meta?.factory();
  }

  /**
   * Check if a command is registered
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Check if a command is reversible
   */
  isReversible(name: string): boolean {
    return this.commands.get(name)?.reversible ?? false;
  }

  /**
   * Get all commands in a category
   */
  getByCategory(category: CommandMeta['category']): CommandMeta[] {
    return Array.from(this.commands.values()).filter((c) => c.category === category);
  }

  /**
   * Get all registered command names
   */
  getAllNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get all command metadata
   */
  getAll(): CommandMeta[] {
    return Array.from(this.commands.values());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Default registrations
  // ─────────────────────────────────────────────────────────────────────────

  private registerDefaults(): void {
    // Navigation
    this.register({
      name: 'navigate_to_text',
      category: 'navigation',
      description: 'Navigate to a specific text in the manuscript',
      reversible: false,
      factory: () => new NavigateToTextCommand(),
    });

    this.register({
      name: 'jump_to_chapter',
      category: 'navigation',
      description: 'Jump to a specific chapter by name or number',
      reversible: false,
      factory: () => new JumpToChapterCommand(),
    });

    this.register({
      name: 'jump_to_scene',
      category: 'navigation',
      description: 'Jump to the next or previous scene of a given type',
      reversible: false,
      factory: () => new JumpToSceneCommand(),
    });

    // Editing
    this.register({
      name: 'update_manuscript',
      category: 'editing',
      description: 'Find and replace text in the manuscript',
      reversible: true,
      factory: () => new UpdateManuscriptCommand(),
    });

    this.register({
      name: 'append_to_manuscript',
      category: 'editing',
      description: 'Append text to the end of the manuscript',
      reversible: true,
      factory: () => new AppendTextCommand(),
    });

    // Analysis
    this.register({
      name: 'get_critique_for_selection',
      category: 'analysis',
      description: 'Get a critique of the currently selected text',
      reversible: false,
      factory: () => new GetCritiqueCommand(),
    });

    this.register({
      name: 'run_analysis',
      category: 'analysis',
      description: 'Run analysis on the manuscript (pacing, characters, plot, setting)',
      reversible: false,
      factory: () => new RunAnalysisCommand(),
    });

    // Knowledge
    this.register({
      name: 'query_lore',
      category: 'knowledge',
      description: 'Search the lore bible for matching entries',
      reversible: false,
      factory: () => new QueryLoreCommand(),
    });

    this.register({
      name: 'get_character_info',
      category: 'knowledge',
      description: 'Get detailed information about a character',
      reversible: false,
      factory: () => new GetCharacterInfoCommand(),
    });

    // UI
    this.register({
      name: 'switch_panel',
      category: 'ui',
      description: 'Switch to a different sidebar panel',
      reversible: false,
      factory: () => new SwitchPanelCommand(),
    });

    this.register({
      name: 'toggle_zen_mode',
      category: 'ui',
      description: 'Toggle distraction-free Zen mode',
      reversible: false,
      factory: () => new ToggleZenModeCommand(),
    });

    this.register({
      name: 'highlight_text',
      category: 'ui',
      description: 'Highlight a range of text with a specific style',
      reversible: false,
      factory: () => new HighlightTextCommand(),
    });

    this.register({
      name: 'set_selection',
      category: 'ui',
      description: 'Set the text selection to a specific range',
      reversible: false,
      factory: () => new SetSelectionCommand(),
    });

    // Generation
    this.register({
      name: 'rewrite_selection',
      category: 'generation',
      description: 'Rewrite the selected text using AI',
      reversible: true,
      factory: () => new RewriteSelectionCommand(),
    });

    this.register({
      name: 'continue_writing',
      category: 'generation',
      description: 'Continue writing from the current position using AI',
      reversible: true,
      factory: () => new ContinueWritingCommand(),
    });

    this.register({
      name: 'suggest_dialogue',
      category: 'generation',
      description: 'Generate dialogue for a specific character',
      reversible: true,
      factory: () => new SuggestDialogueCommand(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────

export const CommandRegistry = new CommandRegistryImpl();
