import { describe, it, expect } from 'vitest';
import type {
  MemoryScope,
  MemoryNoteType,
  MemoryNote,
  MemoryEmbedding,
  GoalStatus,
  AgentGoal,
  WatchedEntity,
  CreateMemoryNoteInput,
  UpdateMemoryNoteInput,
  ListMemoryNotesParams,
  CreateGoalInput,
  BedsideNoteContent,
  BedsideNoteGoalSummary,
  BedsideNoteConflict,
  BedsideNoteSectionKey,
  BedsideNoteListSectionKey,
  BedsideNoteInputSectionKey,
} from '@/services/memory/types';
import {
  BEDSIDE_NOTE_TAG,
  BEDSIDE_NOTE_DEFAULT_TAGS,
} from '@/services/memory/types';

describe('services/memory/types', () => {
  describe('MemoryScope', () => {
    it('accepts valid scopes', () => {
      const projectScope: MemoryScope = 'project';
      const authorScope: MemoryScope = 'author';
      expect(projectScope).toBe('project');
      expect(authorScope).toBe('author');
    });
  });

  describe('MemoryNoteType', () => {
    it('accepts valid types', () => {
      const types: MemoryNoteType[] = ['observation', 'issue', 'fact', 'plan', 'preference'];
      expect(types).toHaveLength(5);
    });
  });

  describe('MemoryNote', () => {
    it('can construct a valid MemoryNote', () => {
      const embedding: MemoryEmbedding = [0.1, 0.2, 0.3];
      const note: MemoryNote = {
        id: 'mem-1',
        scope: 'project',
        projectId: 'proj-1',
        text: 'Sarah has blue eyes',
        type: 'fact',
        topicTags: ['character:sarah', 'appearance'],
        importance: 0.8,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        embedding,
        structuredContent: { key: 'value' },
      };
      expect(note.id).toBe('mem-1');
      expect(note.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('supports minimal MemoryNote without optional fields', () => {
      const note: MemoryNote = {
        id: 'mem-2',
        scope: 'author',
        text: 'Prefer short sentences',
        type: 'preference',
        topicTags: ['style'],
        importance: 0.5,
        createdAt: Date.now(),
      };
      expect(note.projectId).toBeUndefined();
      expect(note.embedding).toBeUndefined();
    });
  });

  describe('GoalStatus', () => {
    it('accepts valid statuses', () => {
      const statuses: GoalStatus[] = ['active', 'completed', 'abandoned'];
      expect(statuses).toHaveLength(3);
    });
  });

  describe('AgentGoal', () => {
    it('can construct a valid AgentGoal', () => {
      const goal: AgentGoal = {
        id: 'goal-1',
        projectId: 'proj-1',
        title: 'Fix plot hole in Act 2',
        description: 'Resolve the disappearing character issue',
        status: 'active',
        progress: 25,
        relatedNoteIds: ['mem-1', 'mem-2'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(goal.progress).toBe(25);
      expect(goal.relatedNoteIds).toHaveLength(2);
    });
  });

  describe('WatchedEntity', () => {
    it('can construct a valid WatchedEntity', () => {
      const entity: WatchedEntity = {
        id: 'character:marcus',
        name: 'Marcus',
        projectId: 'proj-1',
        priority: 'high',
        reason: 'Main antagonist',
        monitoringEnabled: true,
        createdAt: Date.now(),
      };
      expect(entity.priority).toBe('high');
      expect(entity.monitoringEnabled).toBe(true);
    });
  });

  describe('CreateMemoryNoteInput', () => {
    it('omits auto-generated fields', () => {
      const input: CreateMemoryNoteInput = {
        scope: 'project',
        projectId: 'proj-1',
        text: 'New memory',
        type: 'observation',
        topicTags: ['test'],
        importance: 0.6,
      };
      // Should not have id, createdAt, updatedAt
      expect('id' in input).toBe(false);
      expect(input.text).toBe('New memory');
    });
  });

  describe('UpdateMemoryNoteInput', () => {
    it('allows partial updates', () => {
      const update: UpdateMemoryNoteInput = {
        text: 'Updated text',
        importance: 0.9,
      };
      expect(update.text).toBe('Updated text');
      expect(update.scope).toBeUndefined();
    });
  });

  describe('ListMemoryNotesParams', () => {
    it('supports all filter options', () => {
      const params: ListMemoryNotesParams = {
        scope: 'project',
        projectId: 'proj-1',
        type: 'fact',
        topicTags: ['character:sarah'],
        minImportance: 0.5,
        limit: 20,
      };
      expect(params.limit).toBe(20);
    });
  });

  describe('CreateGoalInput', () => {
    it('omits auto-generated fields and has optional progress', () => {
      const input: CreateGoalInput = {
        projectId: 'proj-1',
        title: 'Complete chapter revision',
        status: 'active',
        progress: 10,
      };
      expect(input.progress).toBe(10);
    });
  });

  describe('BedsideNoteContent', () => {
    it('can construct a full BedsideNoteContent', () => {
      const goalSummary: BedsideNoteGoalSummary = {
        title: 'Fix timeline',
        progress: 50,
        status: 'active',
        note: 'Working on it',
        updatedAt: Date.now(),
      };
      const conflict: BedsideNoteConflict = {
        previous: 'Sarah is blonde',
        current: 'Sarah has brown hair',
        confidence: 0.85,
        strategy: 'heuristic',
        resolution: 'agent',
      };
      const content: BedsideNoteContent = {
        currentFocus: 'Revising Act 2',
        openQuestions: ['What happens to Marcus?'],
        activeGoals: [goalSummary],
        recentDiscoveries: ['Found plot hole'],
        nextSteps: ['Review chapter 5'],
        warnings: ['Timeline inconsistency'],
        conflicts: [conflict],
      };
      expect(content.activeGoals).toHaveLength(1);
      expect(content.conflicts).toHaveLength(1);
    });
  });

  describe('BedsideNote section key types', () => {
    it('BedsideNoteSectionKey includes all keys', () => {
      const keys: BedsideNoteSectionKey[] = [
        'currentFocus',
        'openQuestions',
        'activeGoals',
        'recentDiscoveries',
        'nextSteps',
        'warnings',
        'conflicts',
      ];
      expect(keys).toHaveLength(7);
    });

    it('BedsideNoteListSectionKey includes list keys', () => {
      const keys: BedsideNoteListSectionKey[] = [
        'warnings',
        'nextSteps',
        'openQuestions',
        'recentDiscoveries',
      ];
      expect(keys).toHaveLength(4);
    });

    it('BedsideNoteInputSectionKey includes input keys', () => {
      const keys: BedsideNoteInputSectionKey[] = [
        'currentFocus',
        'warnings',
        'nextSteps',
        'openQuestions',
        'recentDiscoveries',
      ];
      expect(keys).toHaveLength(5);
    });
  });

  describe('Constants', () => {
    it('BEDSIDE_NOTE_TAG has expected value', () => {
      expect(BEDSIDE_NOTE_TAG).toBe('meta:bedside-note');
    });

    it('BEDSIDE_NOTE_DEFAULT_TAGS has expected values', () => {
      expect(BEDSIDE_NOTE_DEFAULT_TAGS).toContain('meta:bedside-note');
      expect(BEDSIDE_NOTE_DEFAULT_TAGS).toContain('planner:global');
      expect(BEDSIDE_NOTE_DEFAULT_TAGS).toContain('arc:story');
      expect(BEDSIDE_NOTE_DEFAULT_TAGS).toHaveLength(3);
    });
  });
});
