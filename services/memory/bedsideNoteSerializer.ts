import { ApiDefaults, estimateTokens } from '@/config/api';
import type { BedsideNoteContent, BedsideNoteGoalSummary } from './types';

export type BedsideNoteSectionKey = keyof BedsideNoteContent;

interface SectionConfig {
  key: BedsideNoteSectionKey;
  title: string;
  priority: number;
  maxItems: number;
  defaultBudget: number;
}

const SECTION_CONFIG: SectionConfig[] = [
  { key: 'conflicts', title: 'CONFLICT ALERTS', priority: 0, maxItems: 3, defaultBudget: 150 },
  { key: 'currentFocus', title: 'Current Focus', priority: 1, maxItems: 1, defaultBudget: 80 },
  { key: 'warnings', title: 'Warnings & Risks', priority: 2, maxItems: 4, defaultBudget: 120 },
  { key: 'activeGoals', title: 'Active Goals', priority: 3, maxItems: 4, defaultBudget: 140 },
  { key: 'nextSteps', title: 'Next Steps', priority: 4, maxItems: 4, defaultBudget: 120 },
  { key: 'openQuestions', title: 'Open Questions', priority: 5, maxItems: 4, defaultBudget: 120 },
  { key: 'recentDiscoveries', title: 'Recent Discoveries', priority: 6, maxItems: 4, defaultBudget: 120 },
];

export const DEFAULT_BEDSIDE_NOTE_SECTION_BUDGETS: Record<BedsideNoteSectionKey, number> =
  SECTION_CONFIG.reduce((acc, { key, defaultBudget }) => {
    acc[key] = defaultBudget;
    return acc;
  }, {} as Record<BedsideNoteSectionKey, number>);

export const DEFAULT_BEDSIDE_NOTE_MAX_ITEMS: Record<BedsideNoteSectionKey, number> =
  SECTION_CONFIG.reduce((acc, { key, maxItems }) => {
    acc[key] = maxItems;
    return acc;
  }, {} as Record<BedsideNoteSectionKey, number>);

export interface SerializeBedsideNoteOptions {
  sectionBudgets?: Partial<Record<BedsideNoteSectionKey, number>>;
  maxItems?: Partial<Record<BedsideNoteSectionKey, number>>;
}

export interface SerializedBedsideNote {
  text: string;
  tokens: number;
}

const truncateToTokenBudget = (text: string, budget: number): string => {
  if (budget <= 0) return '';

  const estimated = estimateTokens(text);
  if (estimated <= budget) return text;

  const maxChars = Math.max(0, Math.floor(budget * ApiDefaults.charsPerToken) - 3);
  const truncated = text.slice(0, maxChars).trim();
  return truncated.length > 0 ? `${truncated}...` : '';
};

const formatGoalLine = (goal: BedsideNoteGoalSummary): string => {
  const progressPart = typeof goal.progress === 'number' ? ` [${goal.progress}%]` : '';
  const statusPart = goal.status && goal.status !== 'active' ? ` (${goal.status})` : '';
  const notePart = goal.note ? ` — ${goal.note}` : '';
  return `- ${goal.title}${progressPart}${statusPart}${notePart}`;
};

const scoreGoal = (goal: BedsideNoteGoalSummary): number => {
  const statusBoost = goal.status === 'active' ? 10 : 0;
  const progressScore = typeof goal.progress === 'number' ? 100 - goal.progress : 50;
  const recency = goal.updatedAt ?? 0;
  return statusBoost + progressScore + recency / 1000; // small recency weight
};

const normalizeLines = (items: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const normalizeGoals = (goals: BedsideNoteGoalSummary[]): BedsideNoteGoalSummary[] => {
  const seenTitles = new Set<string>();
  const normalized: BedsideNoteGoalSummary[] = [];

  for (const goal of goals) {
    const title = goal.title?.trim();
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    const note = goal.note?.trim() || undefined;
    normalized.push({ ...goal, title, note });
  }

  return normalized;
};

const enforceListBudget = (
  title: string,
  lines: string[],
  budget: number,
): string => {
  let trimmed = [...lines];
  let block = `${title}:\n${trimmed.join('\n')}`;

  while (trimmed.length > 1 && estimateTokens(block) > budget) {
    trimmed = trimmed.slice(0, -1);
    block = `${title}:\n${trimmed.join('\n')}`;
  }

  if (estimateTokens(block) > budget && trimmed.length > 0) {
    const preserved = trimmed.slice(0, -1).join('\n');
    const prefix = preserved ? `${title}:\n${preserved}\n` : `${title}:\n`;
    const remainingBudget = Math.max(budget - estimateTokens(prefix), 1);
    const lastItem = trimmed[trimmed.length - 1].replace(/^-\s*/, '');
    trimmed[trimmed.length - 1] = `- ${truncateToTokenBudget(lastItem, remainingBudget)}`;
    block = `${title}:\n${trimmed.join('\n')}`;
  }

  return block;
};

export function serializeBedsideNote(
  content: BedsideNoteContent,
  options: SerializeBedsideNoteOptions = {},
): SerializedBedsideNote {
  const budgets = { ...DEFAULT_BEDSIDE_NOTE_SECTION_BUDGETS, ...options.sectionBudgets };
  const maxItems = { ...DEFAULT_BEDSIDE_NOTE_MAX_ITEMS, ...options.maxItems };

  const sectionOrder = [...SECTION_CONFIG].sort((a, b) => a.priority - b.priority);
  const sections: string[] = [];

  for (const section of sectionOrder) {
    const budget = budgets[section.key] ?? section.defaultBudget;
    const limit = maxItems[section.key] ?? section.maxItems;

    switch (section.key) {
      case 'conflicts': {
        if (!content.conflicts || content.conflicts.length === 0) break;
        const conflictLines = content.conflicts
          .slice(0, limit)
          .map(c => `- ${c.previous} ↔ ${c.current} (${Math.round(c.confidence * 100)}%)`);
        if (conflictLines.length > 0) {
          sections.push(enforceListBudget(section.title, conflictLines, budget));
        }
        break;
      }
      case 'currentFocus': {
        if (!content.currentFocus) break;
        const headingTokens = estimateTokens(`${section.title}:\n- `);
        const availableBudget = Math.max(budget - headingTokens, 1);
        const focusLine = truncateToTokenBudget(content.currentFocus, availableBudget);
        if (focusLine) {
          sections.push(`${section.title}:\n- ${focusLine}`);
        }
        break;
      }
      case 'activeGoals': {
        if (!content.activeGoals || content.activeGoals.length === 0) break;
        const normalizedGoals = normalizeGoals(content.activeGoals);
        if (normalizedGoals.length === 0) break;
        const sortedGoals = [...normalizedGoals].sort((a, b) => scoreGoal(b) - scoreGoal(a));
        const goals = sortedGoals.slice(0, limit);
        const lines = goals.map(goal => formatGoalLine(goal));
        if (lines.length > 0) {
          sections.push(enforceListBudget(section.title, lines, budget));
        }
        break;
      }
      case 'warnings': {
        if (!content.warnings || content.warnings.length === 0) break;
        const warnings = normalizeLines(content.warnings.slice(0, limit)).map(warning => `- ${warning}`);
        sections.push(enforceListBudget(section.title, warnings, budget));
        break;
      }
      case 'nextSteps': {
        if (!content.nextSteps || content.nextSteps.length === 0) break;
        const steps = normalizeLines(content.nextSteps.slice(0, limit)).map(step => `- ${step}`);
        sections.push(enforceListBudget(section.title, steps, budget));
        break;
      }
      case 'openQuestions': {
        if (!content.openQuestions || content.openQuestions.length === 0) break;
        const questions = normalizeLines(content.openQuestions.slice(0, limit)).map(question => `- ${question}`);
        sections.push(enforceListBudget(section.title, questions, budget));
        break;
      }
      case 'recentDiscoveries': {
        if (!content.recentDiscoveries || content.recentDiscoveries.length === 0) break;
        const discoveries = normalizeLines(content.recentDiscoveries.slice(0, limit)).map(
          discovery => `- ${discovery}`,
        );
        sections.push(enforceListBudget(section.title, discoveries, budget));
        break;
      }
      default:
        break;
    }
  }

  const text = sections.join('\n\n').trim();
  return { text, tokens: estimateTokens(text) };
}
