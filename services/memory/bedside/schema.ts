import { z } from 'zod';
import { BedsideNoteGoalSummary, GoalStatus } from '../types';

export const BedsideNoteActionSchema = z.enum(['set', 'append', 'remove']);
export type BedsideNoteAction = z.infer<typeof BedsideNoteActionSchema>;

const goalStatuses: [GoalStatus, ...GoalStatus[]] = ['active', 'completed', 'abandoned'];
const GoalStatusSchema = z.enum(goalStatuses);

const BedsideNoteGoalSummarySchema = z.object({
  title: z.string().trim().min(1),
  progress: z.number().int().min(0).max(100).optional(),
  status: GoalStatusSchema.optional(),
  note: z.string().trim().min(1).optional(),
  updatedAt: z.number().optional(),
});

const StringListContentSchema = z
  .union([z.string(), z.array(z.string())])
  .transform(value => {
    if (Array.isArray(value)) return value.map(v => v.trim()).filter(Boolean);
    return typeof value === 'string' ? [value.trim()].filter(Boolean) : [];
  });

const GoalContentSchema = z
  .union([
    BedsideNoteGoalSummarySchema,
    z.array(BedsideNoteGoalSummarySchema),
    z.string().transform(title => ({ title: title.trim() })),
  ])
  .transform(value => {
    if (Array.isArray(value)) return value;
    return [value];
  });

const CurrentFocusMutationSchema = z.object({
  section: z.literal('currentFocus'),
  action: BedsideNoteActionSchema,
  content: z.string().trim(),
});

const ListMutationSchema = z.object({
  section: z.union([
    z.literal('warnings'),
    z.literal('nextSteps'),
    z.literal('openQuestions'),
    z.literal('recentDiscoveries'),
  ]),
  action: BedsideNoteActionSchema,
  content: StringListContentSchema,
});

const GoalsMutationSchema = z.object({
  section: z.literal('activeGoals'),
  action: BedsideNoteActionSchema,
  content: GoalContentSchema,
});

export const BedsideNoteMutationSchema = z.discriminatedUnion('section', [
  CurrentFocusMutationSchema,
  ListMutationSchema,
  GoalsMutationSchema,
]);

export type BedsideNoteMutation = z.infer<typeof BedsideNoteMutationSchema>;
export type BedsideNoteMutationRequest = z.input<typeof BedsideNoteMutationSchema>;

export const parseBedsideNoteMutation = (input: BedsideNoteMutationRequest): BedsideNoteMutation => {
  return BedsideNoteMutationSchema.parse(input);
};
