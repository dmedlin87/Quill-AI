import { describe, it, expect } from 'vitest';
import type {
  EntityAttribute,
  CharacterIndex,
  Contradiction,
  ManuscriptIndex,
  Lore,
  Project,
  Branch,
  InlineComment,
  Chapter,
  AppState,
} from '@/types/schema';

describe('schema types', () => {
  describe('EntityAttribute', () => {
    it('has expected shape', () => {
      const attr: EntityAttribute = {
        value: 'blue eyes',
        chapterId: 'ch1',
        position: 100,
      };

      expect(attr.value).toBe('blue eyes');
      expect(attr.chapterId).toBe('ch1');
      expect(attr.position).toBe(100);
    });
  });

  describe('CharacterIndex', () => {
    it('has expected shape', () => {
      const index: CharacterIndex = {
        name: 'Alice',
        attributes: {
          eyeColor: [{ value: 'blue', chapterId: 'ch1', position: 50 }],
        },
        firstMention: { chapterId: 'ch1', position: 10 },
        mentions: [{ chapterId: 'ch1', position: 10 }],
      };

      expect(index.name).toBe('Alice');
      expect(index.attributes.eyeColor).toHaveLength(1);
    });
  });

  describe('Contradiction', () => {
    it('has expected shape', () => {
      const contradiction: Contradiction = {
        type: 'character_attribute',
        characterName: 'Bob',
        attribute: 'hair',
        originalValue: 'brown',
        originalChapterId: 'ch1',
        newValue: 'blonde',
        newChapterId: 'ch3',
        position: 200,
      };

      expect(contradiction.type).toBe('character_attribute');
      expect(contradiction.originalValue).toBe('brown');
      expect(contradiction.newValue).toBe('blonde');
    });

    it('supports timeline type', () => {
      const contradiction: Contradiction = {
        type: 'timeline',
        originalValue: '1990',
        originalChapterId: 'ch1',
        newValue: '1985',
        newChapterId: 'ch2',
        position: 50,
      };

      expect(contradiction.type).toBe('timeline');
    });

    it('supports location type', () => {
      const contradiction: Contradiction = {
        type: 'location',
        originalValue: 'Paris',
        originalChapterId: 'ch1',
        newValue: 'London',
        newChapterId: 'ch2',
        position: 75,
      };

      expect(contradiction.type).toBe('location');
    });
  });

  describe('Project', () => {
    it('has required fields', () => {
      const project: Project = {
        id: 'proj1',
        title: 'My Novel',
        author: 'Writer',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(project.id).toBe('proj1');
      expect(project.title).toBe('My Novel');
    });

    it('has optional setting', () => {
      const project: Project = {
        id: 'proj2',
        title: 'Historical',
        author: 'Author',
        setting: {
          timePeriod: '1800s',
          location: 'England',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(project.setting?.timePeriod).toBe('1800s');
    });
  });

  describe('Branch', () => {
    it('has expected shape', () => {
      const branch: Branch = {
        id: 'br1',
        name: 'Alternative ending',
        content: 'Different chapter content...',
        createdAt: Date.now(),
      };

      expect(branch.id).toBe('br1');
      expect(branch.name).toBe('Alternative ending');
    });
  });

  describe('InlineComment', () => {
    it('has expected shape', () => {
      const comment: InlineComment = {
        id: 'cmt1',
        type: 'plot',
        issue: 'Pacing issue',
        suggestion: 'Add more tension',
        severity: 'warning',
        quote: 'The scene moved slowly',
        startIndex: 100,
        endIndex: 150,
        dismissed: false,
        createdAt: Date.now(),
      };

      expect(comment.type).toBe('plot');
      expect(comment.severity).toBe('warning');
    });

    it('supports all comment types', () => {
      const types: InlineComment['type'][] = ['plot', 'setting', 'character', 'pacing', 'prose'];
      
      types.forEach((type) => {
        expect(['plot', 'setting', 'character', 'pacing', 'prose']).toContain(type);
      });
    });

    it('supports all severity levels', () => {
      const severities: InlineComment['severity'][] = ['error', 'warning', 'info'];
      
      severities.forEach((severity) => {
        expect(['error', 'warning', 'info']).toContain(severity);
      });
    });
  });

  describe('Chapter', () => {
    it('has required fields', () => {
      const chapter: Chapter = {
        id: 'ch1',
        projectId: 'proj1',
        title: 'Chapter One',
        content: 'It was a dark and stormy night...',
        order: 0,
        updatedAt: Date.now(),
      };

      expect(chapter.id).toBe('ch1');
      expect(chapter.order).toBe(0);
    });

    it('has optional branches', () => {
      const chapter: Chapter = {
        id: 'ch1',
        projectId: 'proj1',
        title: 'Chapter',
        content: '',
        order: 0,
        updatedAt: Date.now(),
        branches: [{ id: 'br1', name: 'Alt', content: '', createdAt: Date.now() }],
        activeBranchId: 'br1',
      };

      expect(chapter.branches).toHaveLength(1);
      expect(chapter.activeBranchId).toBe('br1');
    });
  });

  describe('AppState', () => {
    it('has expected shape', () => {
      const state: AppState = {
        activeProjectId: 'proj1',
        activeChapterId: 'ch1',
      };

      expect(state.activeProjectId).toBe('proj1');
      expect(state.activeChapterId).toBe('ch1');
    });

    it('accepts null values', () => {
      const state: AppState = {
        activeProjectId: null,
        activeChapterId: null,
      };

      expect(state.activeProjectId).toBeNull();
      expect(state.activeChapterId).toBeNull();
    });
  });
});
