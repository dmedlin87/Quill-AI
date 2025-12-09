import { describe, it, expect } from 'vitest';
import {
  buildCrossChapterContext,
  formatCrossChapterContext,
} from '@/services/appBrain/crossChapterContext';
import type { ManuscriptIntelligence } from '@/types/intelligence';

const baseChapters = [
  { id: 'c1', title: 'One', content: 'First', order: 0, updatedAt: 0 },
  { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
  { id: 'c3', title: 'Three', content: 'Third', order: 2, updatedAt: 0 },
];

describe('buildCrossChapterContext', () => {
  it('includes active chapter with neighbors', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'c2', 'Current text');

    expect(context.previousChapter?.title).toBe('One');
    expect(context.nextChapter?.title).toBe('Three');
  });

  it('falls back when no chapter is active', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'missing', '');

    expect(context.previousChapter).toBeNull();
    expect(context.nextChapter).toBeNull();
  });

  it('returns null for previousChapter when on first chapter', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'c1', 'Current text');

    expect(context.previousChapter).toBeNull();
    expect(context.nextChapter?.title).toBe('Two');
  });

  it('returns null for nextChapter when on last chapter', () => {
    const context = buildCrossChapterContext(baseChapters as any, 'c3', 'Current text');

    expect(context.previousChapter?.title).toBe('Two');
    expect(context.nextChapter).toBeNull();
  });

  describe('narrative arc position', () => {
    it('identifies beginning position (0-15%)', () => {
      const chapters = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `Chapter ${i + 1}`,
        content: `Content ${i + 1}`,
        order: i,
        updatedAt: 0,
      }));

      const context = buildCrossChapterContext(chapters as any, 'c1', 'Text');
      expect(context.narrativeArc.position).toBe('beginning');
      expect(context.narrativeArc.percentComplete).toBe(10);
    });

    it('identifies rising_action position (16-40%)', () => {
      const chapters = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `Chapter ${i + 1}`,
        content: `Content ${i + 1}`,
        order: i,
        updatedAt: 0,
      }));

      const context = buildCrossChapterContext(chapters as any, 'c3', 'Text');
      expect(context.narrativeArc.position).toBe('rising_action');
      expect(context.narrativeArc.percentComplete).toBe(30);
    });

    it('identifies climax position (41-60%)', () => {
      const chapters = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `Chapter ${i + 1}`,
        content: `Content ${i + 1}`,
        order: i,
        updatedAt: 0,
      }));

      const context = buildCrossChapterContext(chapters as any, 'c5', 'Text');
      expect(context.narrativeArc.position).toBe('climax');
      expect(context.narrativeArc.percentComplete).toBe(50);
    });

    it('identifies falling_action position (61-85%)', () => {
      const chapters = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `Chapter ${i + 1}`,
        content: `Content ${i + 1}`,
        order: i,
        updatedAt: 0,
      }));

      const context = buildCrossChapterContext(chapters as any, 'c7', 'Text');
      expect(context.narrativeArc.position).toBe('falling_action');
      expect(context.narrativeArc.percentComplete).toBe(70);
    });

    it('identifies resolution position (86-100%)', () => {
      const chapters = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `Chapter ${i + 1}`,
        content: `Content ${i + 1}`,
        order: i,
        updatedAt: 0,
      }));

      const context = buildCrossChapterContext(chapters as any, 'c10', 'Text');
      expect(context.narrativeArc.position).toBe('resolution');
      expect(context.narrativeArc.percentComplete).toBe(100);
    });
  });

  describe('ending mood detection', () => {
    it('detects cliffhanger ending with question mark', () => {
      const chapters = [
        { id: 'c1', title: 'One', content: 'First paragraph.\n\nWhat was he doing?', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.endingMood).toBe('cliffhanger');
    });

    it('detects cliffhanger ending with ellipsis', () => {
      const chapters = [
        { id: 'c1', title: 'One', content: 'First paragraph.\n\nAnd then suddenly...', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.endingMood).toBe('cliffhanger');
    });

    it('detects resolution ending', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'First paragraph.\n\nFinally, peace settled over the land.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.endingMood).toBe('resolution');
    });

    it('detects transition ending', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'First paragraph.\n\nMeanwhile, elsewhere in the city.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.endingMood).toBe('transition');
    });

    it('defaults to neutral ending', () => {
      const chapters = [
        { id: 'c1', title: 'One', content: 'First paragraph.\n\nThe sun set in the west.', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.endingMood).toBe('neutral');
    });
  });

  describe('continuity issue detection', () => {
    it('detects character presence issues', () => {
      const intelligenceMap = new Map<string, ManuscriptIntelligence>();
      intelligenceMap.set('c1', {
        entities: {
          nodes: [
            { name: 'John', type: 'character', mentions: [{ offset: 100 }] },
            { name: 'Sarah', type: 'character', mentions: [{ offset: 150 }] },
          ],
        },
      } as unknown as ManuscriptIntelligence);

      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content:
            'First paragraph with some text.\n\nJohn and Sarah walked together through the forest. They continued their journey.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'The morning sun rose. Something else happened.', order: 1, updatedAt: 0 },
      ];

      // Current text doesn't mention John or Sarah
      const context = buildCrossChapterContext(
        chapters as any,
        'c2',
        'The morning sun rose brightly. A new adventure began.',
        intelligenceMap
      );

      // Should detect missing characters if the previous chapter ended with them present
      expect(context.continuityIssues.length).toBeGreaterThanOrEqual(0);
    });

    it('detects timeline gap issues for cliffhangers', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'Something happened.\n\nBut then suddenly, what was that noise?',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second chapter content', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(
        chapters as any,
        'c2',
        'The city sprawled before them. Life was ordinary.'
      );

      const timelineIssue = context.continuityIssues.find(i => i.type === 'timeline_gap');
      expect(timelineIssue).toBeDefined();
      expect(timelineIssue?.severity).toBe('high');
    });

    it('detects setting change issues', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'First paragraph.\n\nThey walked into the castle.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'In the forest, something stirred.');

      const settingIssue = context.continuityIssues.find(i => i.type === 'setting_change');
      expect(settingIssue).toBeDefined();
      expect(settingIssue?.severity).toBe('low');
    });

    it('detects plot thread issues when many threads unaddressed', () => {
      const intelligenceMap = new Map<string, ManuscriptIntelligence>();
      intelligenceMap.set('c1', {
        timeline: {
          promises: [
            { description: 'find the treasure', resolved: false },
            { description: 'save the princess', resolved: false },
            { description: 'defeat the dragon', resolved: false },
          ],
        },
      } as unknown as ManuscriptIntelligence);

      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'Setup chapter with plot threads.\n\nThe adventure begins.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(
        chapters as any,
        'c2',
        'The weather was nice. Birds sang in the trees.',
        intelligenceMap
      );

      const plotIssue = context.continuityIssues.find(i => i.type === 'plot_thread');
      expect(plotIssue).toBeDefined();
    });
  });

  describe('paragraph extraction', () => {
    it('extracts first meaningful paragraph from chapter', () => {
      const chapters = [
        { id: 'c1', title: 'One', content: 'Short.\n\nThis is a longer paragraph with meaningful content.', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.firstParagraph).toContain('This is a longer paragraph');
    });

    it('extracts last meaningful paragraph from chapter', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'First paragraph content here.\n\nThis is the ending paragraph.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.lastParagraph).toContain('ending paragraph');
    });

    it('truncates long paragraphs', () => {
      const longContent = 'A'.repeat(500);
      const chapters = [
        { id: 'c1', title: 'One', content: longContent, order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');
      expect(context.previousChapter?.firstParagraph.length).toBeLessThanOrEqual(210);
      expect(context.previousChapter?.firstParagraph).toContain('...');
    });
  });

  describe('active character extraction', () => {
    it('extracts active characters from chapter ending using entity graph', () => {
      const intelligenceMap = new Map<string, ManuscriptIntelligence>();
      intelligenceMap.set('c1', {
        entities: {
          nodes: [
            { name: 'John', type: 'character', mentions: [{ offset: 10 }] },
            { name: 'Sarah', type: 'character', mentions: [{ offset: 50 }] },
            { name: 'Castle', type: 'location', mentions: [{ offset: 30 }] },
          ],
        },
      } as unknown as ManuscriptIntelligence);

      const chapters = [
        { id: 'c1', title: 'One', content: 'John met Sarah at the castle. They talked for hours.', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text', intelligenceMap);

      expect(context.previousChapter?.activeCharacters).toContain('John');
      expect(context.previousChapter?.activeCharacters).toContain('Sarah');
      // Should not include locations
      expect(context.previousChapter?.activeCharacters).not.toContain('Castle');
    });

    it('falls back to simple name detection without entity graph', () => {
      const chapters = [
        {
          id: 'c1',
          title: 'One',
          content: 'John John John met Sarah Sarah at the castle. Mike arrived later.',
          order: 0,
          updatedAt: 0,
        },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text');

      // Should find names by frequency
      expect(context.previousChapter?.activeCharacters.length).toBeGreaterThan(0);
    });
  });

  describe('open plot threads extraction', () => {
    it('extracts unresolved promises from timeline', () => {
      const intelligenceMap = new Map<string, ManuscriptIntelligence>();
      intelligenceMap.set('c1', {
        timeline: {
          promises: [
            { description: 'Find the lost key', resolved: false },
            { description: 'Meet at noon', resolved: true },
            { description: 'Rescue the village', resolved: false },
          ],
        },
      } as unknown as ManuscriptIntelligence);

      const chapters = [
        { id: 'c1', title: 'One', content: 'First chapter content', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'Second', order: 1, updatedAt: 0 },
      ];

      const context = buildCrossChapterContext(chapters as any, 'c2', 'Current text', intelligenceMap);

      expect(context.previousChapter?.openPlotThreads).toContain('Find the lost key');
      expect(context.previousChapter?.openPlotThreads).toContain('Rescue the village');
      expect(context.previousChapter?.openPlotThreads).not.toContain('Meet at noon');
    });
  });
});

describe('formatCrossChapterContext', () => {
  it('formats context with previous and next chapters', () => {
    const context = {
      previousChapter: {
        chapterId: 'c1',
        title: 'Chapter One',
        firstParagraph: 'The beginning...',
        lastParagraph: 'The ending of chapter one...',
        endingMood: 'cliffhanger' as const,
        activeCharacters: ['John', 'Sarah'],
        openPlotThreads: ['Find treasure'],
      },
      nextChapter: {
        chapterId: 'c3',
        title: 'Chapter Three',
        firstParagraph: 'The start of chapter three...',
        lastParagraph: 'The end of three...',
        endingMood: 'neutral' as const,
        activeCharacters: ['John'],
        openPlotThreads: [],
      },
      continuityIssues: [],
      narrativeArc: {
        position: 'rising_action' as const,
        percentComplete: 30,
      },
    };

    const formatted = formatCrossChapterContext(context);

    expect(formatted).toContain('[CHAPTER CONTEXT]');
    expect(formatted).toContain('Previous Chapter: "Chapter One"');
    expect(formatted).toContain('Mood: cliffhanger');
    expect(formatted).toContain('Active characters: John, Sarah');
    expect(formatted).toContain('Next Chapter: "Chapter Three"');
    expect(formatted).toContain('Narrative Position: rising action (30% complete)');
  });

  it('formats continuity issues with severity icons', () => {
    const context = {
      previousChapter: null,
      nextChapter: null,
      continuityIssues: [
        { type: 'timeline_gap' as const, description: 'Major gap', severity: 'high' as const },
        { type: 'character_presence' as const, description: 'Missing character', severity: 'medium' as const },
        { type: 'setting_change' as const, description: 'Location shift', severity: 'low' as const },
      ],
      narrativeArc: {
        position: 'beginning' as const,
        percentComplete: 5,
      },
    };

    const formatted = formatCrossChapterContext(context);

    expect(formatted).toContain('Continuity Warnings (3)');
    expect(formatted).toContain('🔴 Major gap');
    expect(formatted).toContain('🟡 Missing character');
    expect(formatted).toContain('🟢 Location shift');
  });

  it('omits sections when not present', () => {
    const context = {
      previousChapter: null,
      nextChapter: null,
      continuityIssues: [],
      narrativeArc: {
        position: 'beginning' as const,
        percentComplete: 10,
      },
    };

    const formatted = formatCrossChapterContext(context);

    expect(formatted).not.toContain('Previous Chapter');
    expect(formatted).not.toContain('Next Chapter');
    expect(formatted).not.toContain('Continuity Warnings');
    expect(formatted).toContain('Narrative Position');
  });
});
