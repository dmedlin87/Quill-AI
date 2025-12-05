import { serializeBedsideNote } from './bedsideNoteSerializer';
import { BedsideNoteContent, BedsideNoteGoalSummary, MemoryNote } from './types';
import { evolveBedsideNote, getOrCreateBedsideNote } from './chains';
import {
  BedsideNoteMutation,
  BedsideNoteMutationRequest,
  parseBedsideNoteMutation,
} from './bedside/schema';

const mergeUnique = (existing: string[] = [], additions: string[]): string[] => {
  const set = new Set(existing);
  additions.forEach(item => set.add(item));
  return Array.from(set);
};

const mergeGoals = (
  current: BedsideNoteGoalSummary[],
  additions: BedsideNoteGoalSummary[],
): BedsideNoteGoalSummary[] => {
  const titles = new Set(current.map(goal => goal.title.toLowerCase()));
  const merged = [...current];
  for (const goal of additions) {
    if (!titles.has(goal.title.toLowerCase())) {
      merged.push(goal);
    }
  }
  return merged;
};

const removeGoals = (
  current: BedsideNoteGoalSummary[],
  removals: BedsideNoteGoalSummary[],
): BedsideNoteGoalSummary[] => {
  const titlesToRemove = new Set(removals.map(goal => goal.title.toLowerCase()));
  return current.filter(goal => !titlesToRemove.has(goal.title.toLowerCase()));
};

const applyMutation = (
  baseContent: BedsideNoteContent,
  mutation: BedsideNoteMutation,
): BedsideNoteContent => {
  const nextContent: BedsideNoteContent = { ...baseContent };

  switch (mutation.section) {
    case 'currentFocus': {
      const value = mutation.content;
      if (mutation.action === 'set') {
        nextContent.currentFocus = value;
      } else if (mutation.action === 'append' && value) {
        nextContent.currentFocus = nextContent.currentFocus
          ? `${nextContent.currentFocus}\n${value}`
          : value;
      } else if (mutation.action === 'remove') {
        if ((nextContent.currentFocus || '').trim() === value.trim()) {
          delete nextContent.currentFocus;
        }
      }
      break;
    }

    case 'warnings':
    case 'nextSteps':
    case 'openQuestions':
    case 'recentDiscoveries': {
      const values = mutation.content;
      const current = (nextContent[mutation.section] as string[] | undefined) ?? [];

      if (mutation.action === 'set') {
        nextContent[mutation.section] = values;
      } else if (mutation.action === 'append') {
        nextContent[mutation.section] = mergeUnique(current, values);
      } else if (mutation.action === 'remove') {
        const toRemove = new Set(values.map(v => v.trim().toLowerCase()));
        nextContent[mutation.section] = current.filter(item => !toRemove.has(item.trim().toLowerCase()));
        if ((nextContent[mutation.section] as string[]).length === 0) {
          delete nextContent[mutation.section];
        }
      }
      break;
    }

    case 'activeGoals': {
      const goals = mutation.content;
      const currentGoals = nextContent.activeGoals ?? [];

      if (mutation.action === 'set') {
        nextContent.activeGoals = goals;
      } else if (mutation.action === 'append') {
        nextContent.activeGoals = mergeGoals(currentGoals, goals);
      } else if (mutation.action === 'remove') {
        nextContent.activeGoals = removeGoals(currentGoals, goals);
        if (nextContent.activeGoals.length === 0) {
          delete nextContent.activeGoals;
        }
      }
      break;
    }

    default:
      return nextContent;
  }

  return nextContent;
};

export function applyBedsideNoteMutationLocally(
  baseContent: BedsideNoteContent,
  mutationInput: BedsideNoteMutationRequest,
): { nextContent: BedsideNoteContent; text: string } {
  const mutation = parseBedsideNoteMutation(mutationInput);
  const nextContent = applyMutation(baseContent, mutation);
  const { text } = serializeBedsideNote(nextContent);
  return { nextContent, text };
}

export async function applyBedsideNoteMutation(
  projectId: string,
  mutation: BedsideNoteMutationRequest,
): Promise<MemoryNote> {
  if (!projectId) {
    throw new Error('projectId is required to update the bedside note');
  }

  const bedsideNote = await getOrCreateBedsideNote(projectId);
  const baseContent = (bedsideNote.structuredContent as BedsideNoteContent | undefined) || {};
  const { nextContent, text } = applyBedsideNoteMutationLocally(baseContent, mutation);

  return evolveBedsideNote(projectId, text, {
    changeReason: `agent_${mutation.action}_${mutation.section}`,
    structuredContent: nextContent,
  });
}
