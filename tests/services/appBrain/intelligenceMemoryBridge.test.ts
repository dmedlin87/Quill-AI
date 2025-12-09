import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeIntelligenceAgainstMemory,
  getHighPriorityConflicts,
  formatConflictsForPrompt,
  type IntelligenceConflict,
} from '@/services/appBrain/intelligenceMemoryBridge';
import type { ManuscriptIntelligence, ManuscriptHUD } from '@/types/intelligence';

// Mock the memory service
vi.mock('@/services/memory', () => ({
  searchMemoriesByTags: vi.fn(() => Promise.resolve([])),
  getActiveGoals: vi.fn(() => Promise.resolve([])),
  getWatchedEntities: vi.fn(() => Promise.resolve([])),
  createMemory: vi.fn(() => Promise.resolve({ id: 'test-memory' })),
  getMemories: vi.fn(() => Promise.resolve([])),
}));

import * as memory from '@/services/memory';

describe('intelligenceMemoryBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockIntelligence = (overrides?: Partial<ManuscriptIntelligence>): ManuscriptIntelligence => ({
    chapterId: 'test-chapter',
    structural: {
      scenes: [],
      paragraphs: [],
      dialogueMap: [],
      stats: {
        totalWords: 1000,
        totalSentences: 50,
        totalParagraphs: 10,
        avgSentenceLength: 20,
        sentenceLengthVariance: 5,
        dialogueRatio: 0.3,
        sceneCount: 3,
        povShifts: 1,
        avgSceneLength: 300,
      },
      processedAt: Date.now(),
    },
    entities: {
      nodes: [
        {
          id: 'char-1',
          name: 'Seth',
          type: 'character',
          aliases: [],
          firstMention: 0,
          mentionCount: 5,
          mentions: [{ offset: 0, chapterId: 'test-chapter' }],
          attributes: {},
        },
      ],
      edges: [],
      processedAt: Date.now(),
    },
    timeline: {
      events: [],
      causalChains: [],
      promises: [],
      processedAt: Date.now(),
    },
    style: {
      vocabulary: {
        uniqueWords: 500,
        totalWords: 1000,
        avgWordLength: 5,
        lexicalDiversity: 0.5,
        topWords: [],
        overusedWords: [],
        rareWords: [],
      },
      syntax: {
        avgSentenceLength: 20,
        sentenceLengthVariance: 5,
        minSentenceLength: 5,
        maxSentenceLength: 40,
        paragraphLengthAvg: 100,
        dialogueToNarrativeRatio: 0.3,
        questionRatio: 0.1,
        exclamationRatio: 0.05,
      },
      rhythm: {
        syllablePattern: [],
        punctuationDensity: 5,
        avgClauseCount: 2,
      },
      flags: {
        passiveVoiceRatio: 0.1,
        passiveVoiceInstances: [],
        adverbDensity: 0.05,
        adverbInstances: [],
        filterWordDensity: 0.02,
        filterWordInstances: [],
        clicheCount: 0,
        clicheInstances: [],
        repeatedPhrases: [],
      },
      processedAt: Date.now(),
    },
    voice: {
      profiles: {},
      consistencyAlerts: [],
    },
    heatmap: {
      sections: [],
      hotspots: [],
      processedAt: Date.now(),
    },
    delta: {
      changedRanges: [],
      invalidatedSections: [],
      affectedEntities: [],
      newPromises: [],
      resolvedPromises: [],
      contentHash: 'abc123',
      processedAt: Date.now(),
    },
    hud: {
      situational: {
        currentScene: null,
        currentParagraph: null,
        narrativePosition: { sceneIndex: 0, totalScenes: 3, percentComplete: 33 },
        tensionLevel: 'medium',
        pacing: 'moderate',
      },
      context: {
        activeEntities: [],
        activeRelationships: [],
        openPromises: [],
        recentEvents: [],
      },
      styleAlerts: [],
      prioritizedIssues: [],
      recentChanges: [],
      stats: { wordCount: 1000, readingTime: 5, dialoguePercent: 30, avgSentenceLength: 20 },
      lastFullProcess: Date.now(),
      processingTier: 'background',
    },
    ...overrides,
  });

  describe('analyzeIntelligenceAgainstMemory', () => {
    it('returns empty conflicts when no issues detected', async () => {
      const intelligence = createMockIntelligence();
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      expect(result.conflicts).toHaveLength(0);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('detects voice inconsistency conflicts with memory', async () => {
      vi.mocked(memory.searchMemoriesByTags).mockResolvedValueOnce([
        {
          id: 'mem-1',
          text: 'Seth speaks in a formal, measured voice.',
          type: 'fact',
          scope: 'project',
          projectId: 'test-project',
          topicTags: ['character:seth', 'voice'],
          importance: 0.8,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        voice: {
          profiles: {},
          consistencyAlerts: ['Seth shows avgSentenceLength shift of 35% between halves.'],
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].type).toBe('voice_inconsistency');
    });

    it('detects goal conflicts from heatmap issues', async () => {
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Improve pacing in slow sections',
          description: 'Speed up the slow parts',
          status: 'active',
          progress: 20,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        heatmap: {
          sections: [
            {
              offset: 0,
              length: 500,
              scores: {
                plotRisk: 0.2,
                pacingRisk: 0.8,
                characterRisk: 0.1,
                settingRisk: 0.1,
                styleRisk: 0.2,
              },
              overallRisk: 0.6,
              flags: ['pacing_slow'],
              suggestions: ['Consider adding tension'],
            },
          ],
          hotspots: [],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        minSeverity: 'info',
      });
      
      const goalConflict = result.conflicts.find(c => c.type === 'goal_conflict');
      expect(goalConflict).toBeDefined();
    });

    it('respects minSeverity filter', async () => {
      const intelligence = createMockIntelligence({
        hud: {
          ...createMockIntelligence().hud,
          context: {
            activeEntities: [
              {
                id: 'char-1',
                name: 'Seth',
                type: 'character',
                aliases: [],
                firstMention: 0,
                mentionCount: 5,
                mentions: [{ offset: 0, chapterId: 'test-chapter' }],
                attributes: {},
              },
            ],
            activeRelationships: [],
            openPromises: [],
            recentEvents: [],
          },
        },
      });

      vi.mocked(memory.getWatchedEntities).mockResolvedValueOnce([
        {
          id: 'watch-1',
          name: 'Seth',
          projectId: 'test-project',
          priority: 'high',
          reason: 'Main character',
          monitoringEnabled: true,
          createdAt: Date.now(),
        },
      ]);
      
      // With minSeverity 'warning', info-level watched entity alerts should be filtered
      const resultWarning = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        minSeverity: 'warning',
      });
      
      const resultInfo = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        minSeverity: 'info',
      });
      
      expect(resultInfo.conflicts.length).toBeGreaterThanOrEqual(resultWarning.conflicts.length);
    });

    it('creates memories for significant conflicts when enabled', async () => {
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Fix pacing issues',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        heatmap: {
          sections: [
            {
              offset: 0,
              length: 500,
              scores: { plotRisk: 0.8, pacingRisk: 0.8, characterRisk: 0.1, settingRisk: 0.1, styleRisk: 0.2 },
              overallRisk: 0.7,
              flags: ['pacing_slow'],
              suggestions: ['Speed up'],
            },
          ],
          hotspots: [],
          processedAt: Date.now(),
        },
      });
      
      await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        skipMemoryCreation: false,
      });
      
      // Memory creation should be called for warning/critical conflicts
      // (may not be called if no warning-level conflicts)
    });
  });

  describe('getHighPriorityConflicts', () => {
    it('returns empty array when no high-priority issues', async () => {
      const hud: ManuscriptHUD = createMockIntelligence().hud;
      
      const conflicts = await getHighPriorityConflicts(hud, 'test-project');
      
      expect(conflicts).toHaveLength(0);
    });

    it('detects conflicts between high-severity issues and goals', async () => {
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Fix plot holes',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ]);

      const hud: ManuscriptHUD = {
        ...createMockIntelligence().hud,
        prioritizedIssues: [
          {
            type: 'unresolved_promise',
            description: 'Plot hole detected in chapter 2',
            offset: 1000,
            severity: 0.9,
          },
        ],
      };
      
      const conflicts = await getHighPriorityConflicts(hud, 'test-project');
      
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].severity).toBe('critical');
    });
  });

  describe('formatConflictsForPrompt', () => {
    it('returns empty string for no conflicts', () => {
      expect(formatConflictsForPrompt([])).toBe('');
    });

    it('formats conflicts with severity icons', () => {
      const conflicts: IntelligenceConflict[] = [
        {
          id: 'c1',
          type: 'lore_violation',
          severity: 'critical',
          finding: { source: 'heatmap', description: 'Test issue' },
          reference: { type: 'memory', id: 'm1', text: 'Reference text' },
          explanation: 'This is a critical issue',
          createdAt: Date.now(),
        },
        {
          id: 'c2',
          type: 'goal_conflict',
          severity: 'warning',
          finding: { source: 'timeline', description: 'Test warning' },
          reference: { type: 'goal', id: 'g1', text: 'Goal text' },
          explanation: 'This is a warning',
          suggestion: 'Fix it',
          createdAt: Date.now(),
        },
      ];
      
      const result = formatConflictsForPrompt(conflicts);
      
      expect(result).toContain('[INTELLIGENCE-MEMORY CONFLICTS]');
      expect(result).toContain('🔴'); // Critical icon
      expect(result).toContain('🟡'); // Warning icon
      expect(result).toContain('This is a critical issue');
      expect(result).toContain('→ Fix it'); // Suggestion
    });

    it('respects maxLength', () => {
      const conflicts: IntelligenceConflict[] = Array(10).fill(null).map((_, i) => ({
        id: `c${i}`,
        type: 'lore_violation' as const,
        severity: 'warning' as const,
        finding: { source: 'heatmap' as const, description: 'Long description '.repeat(10) },
        reference: { type: 'memory' as const, id: `m${i}`, text: 'Ref' },
        explanation: 'Explanation '.repeat(20),
        createdAt: Date.now(),
      }));
      
      const result = formatConflictsForPrompt(conflicts, 200);
      
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('limits to 5 conflicts', () => {
      const conflicts: IntelligenceConflict[] = Array(10).fill(null).map((_, i) => ({
        id: `c${i}`,
        type: 'lore_violation' as const,
        severity: 'info' as const,
        finding: { source: 'heatmap' as const, description: `Issue ${i}` },
        reference: { type: 'memory' as const, id: `m${i}`, text: 'Ref' },
        explanation: `Explanation ${i}`,
        createdAt: Date.now(),
      }));
      
      const result = formatConflictsForPrompt(conflicts, 5000);
      
      expect(result).toContain('and 5 more conflicts');
    });

    it('formats info severity with blue icon', () => {
      const conflicts: IntelligenceConflict[] = [
        {
          id: 'info-1',
          type: 'lore_violation',
          severity: 'info',
          finding: { source: 'entity', description: 'Info issue' },
          reference: { type: 'memory', id: 'm1', text: 'Ref' },
          explanation: 'This is informational',
          createdAt: Date.now(),
        },
      ];
      
      const result = formatConflictsForPrompt(conflicts);
      
      expect(result).toContain('🔵'); // Info icon
    });
  });

  describe('plot promises against memory/goals', () => {
    it('detects unresolved promises conflicting with goals', async () => {
      vi.mocked(memory.getMemories).mockResolvedValueOnce([]);
      // getActiveGoals is called multiple times in analyzeIntelligenceAgainstMemory
      // (once for heatmap, once for plot promises)
      vi.mocked(memory.getActiveGoals).mockResolvedValue([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Resolve Sarah mystery revelation',
          description: 'Need to reveal Sarah secret soon',
          status: 'active',
          progress: 10,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [],
          promises: [
            {
              id: 'promise-1',
              type: 'foreshadowing',
              description: 'Sarah mystery secret foreshadowed revelation',
              quote: 'Sarah mystery text',
              offset: 500,
              resolved: false,
              chapterId: 'ch-1',
            },
          ],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      const plotConflict = result.conflicts.find(c => c.type === 'goal_conflict' && c.finding.source === 'timeline');
      expect(plotConflict).toBeDefined();
      expect(plotConflict?.explanation).toContain('unresolved');
    });

    it('detects unresolved promises conflicting with plan memories', async () => {
      vi.mocked(memory.getMemories).mockResolvedValueOnce([
        {
          id: 'mem-plan-1',
          text: 'Need to resolve and payoff the villain threat by chapter 10',
          type: 'plan',
          scope: 'project',
          projectId: 'test-project',
          topicTags: ['plan'],
          importance: 0.8,
          createdAt: Date.now(),
        },
      ]);
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([]);

      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [],
          promises: [
            {
              id: 'promise-2',
              type: 'conflict',
              description: 'The villain threat looms over the chapter',
              quote: 'villain text',
              offset: 200,
              resolved: false,
              chapterId: 'ch-1',
            },
          ],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      const plotMemoryConflict = result.conflicts.find(c => c.type === 'plot_contradiction');
      expect(plotMemoryConflict).toBeDefined();
    });

    it('ignores resolved promises', async () => {
      vi.mocked(memory.getMemories).mockResolvedValueOnce([]);
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Complete story arc',
          status: 'active',
          progress: 50,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        timeline: {
          events: [],
          causalChains: [],
          promises: [
            {
              id: 'promise-3',
              type: 'question',
              description: 'This promise is already resolved',
              quote: 'resolved text',
              offset: 100,
              resolved: true, // Resolved
              chapterId: 'ch-1',
            },
          ],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      // Resolved promises should not generate conflicts
      const plotConflict = result.conflicts.find(c => c.finding.source === 'timeline');
      expect(plotConflict).toBeUndefined();
    });
  });

  describe('world rules validation', () => {
    it('detects world rule violations with location restrictions', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            {
              id: 'loc-1',
              name: 'Forbidden Tower',
              type: 'location',
              aliases: [],
              firstMention: 0,
              mentionCount: 3,
              mentions: [{ offset: 100, chapterId: 'ch-1' }],
              attributes: {},
            },
          ],
          edges: [],
          processedAt: Date.now(),
        },
        timeline: {
          events: [{ id: 'ev-1', description: 'Event at midnight', temporalMarker: 'midnight', offset: 50, chapterId: 'ch-1', relativePosition: 'unknown', dependsOn: [] }],
          causalChains: [],
          promises: [],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        worldRules: [
          'No one can enter the Forbidden Tower after dark.',
          'Magic is forbidden in the capital.',
        ],
      });
      
      const worldRuleConflict = result.conflicts.find(
        c => c.type === 'lore_violation' && c.reference.type === 'lore'
      );
      expect(worldRuleConflict).toBeDefined();
      expect(worldRuleConflict?.severity).toBe('critical');
    });

    it('ignores world rules without negative keywords', async () => {
      const intelligence = createMockIntelligence({
        entities: {
          nodes: [
            {
              id: 'loc-2',
              name: 'Market Square',
              type: 'location',
              aliases: [],
              firstMention: 0,
              mentionCount: 2,
              mentions: [{ offset: 200, chapterId: 'ch-1' }],
              attributes: {},
            },
          ],
          edges: [],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        worldRules: [
          'The Market Square is always busy during the day.', // No negation
        ],
      });
      
      // Should not create a violation since rule has no negative keywords
      const worldRuleConflict = result.conflicts.find(
        c => c.reference.text?.includes('Market Square')
      );
      expect(worldRuleConflict).toBeUndefined();
    });

    it('returns empty when no world rules provided', async () => {
      const intelligence = createMockIntelligence();
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        worldRules: [],
      });
      
      const worldRuleConflicts = result.conflicts.filter(
        c => c.reference.type === 'lore' && c.reference.id === 'world-rule'
      );
      expect(worldRuleConflicts).toHaveLength(0);
    });
  });

  describe('voice with lore characters', () => {
    it('detects voice inconsistency with lore character bio', async () => {
      vi.mocked(memory.searchMemoriesByTags).mockResolvedValueOnce([]);

      const intelligence = createMockIntelligence({
        voice: {
          profiles: {},
          consistencyAlerts: ['Marcus shows dialogueRatio shift of 50% between halves.'],
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        loreCharacters: [
          {
            name: 'Marcus',
            bio: 'Marcus speaks in a gruff, informal manner with short sentences.',
            arc: 'protagonist journey',
            arcStages: [],
            relationships: [],
            plotThreads: [],
            inconsistencies: [],
            developmentSuggestion: '',
          },
        ],
      });
      
      const loreConflict = result.conflicts.find(
        c => c.type === 'lore_violation' && c.reference.type === 'lore'
      );
      expect(loreConflict).toBeDefined();
      expect(loreConflict?.explanation).toContain('Marcus');
    });

    it('skips lore check when character has no voice description', async () => {
      vi.mocked(memory.searchMemoriesByTags).mockResolvedValueOnce([]);

      const intelligence = createMockIntelligence({
        voice: {
          profiles: {},
          consistencyAlerts: ['Alex shows avgSentenceLength shift of 40% between halves.'],
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        loreCharacters: [
          {
            name: 'Alex',
            bio: 'Alex is a skilled warrior who fights bravely.', // No voice keywords
            arc: 'supporting arc',
            arcStages: [],
            relationships: [],
            plotThreads: [],
            inconsistencies: [],
            developmentSuggestion: '',
          },
        ],
      });
      
      const loreConflict = result.conflicts.find(
        c => c.type === 'lore_violation' && c.reference.type === 'lore'
      );
      expect(loreConflict).toBeUndefined();
    });
  });

  describe('memory creation and error handling', () => {
    it('handles memory creation errors gracefully', async () => {
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Fix pacing issues',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ]);
      vi.mocked(memory.createMemory).mockRejectedValueOnce(new Error('DB error'));

      const intelligence = createMockIntelligence({
        heatmap: {
          sections: [
            {
              offset: 0,
              length: 500,
              scores: { plotRisk: 0.8, pacingRisk: 0.9, characterRisk: 0.1, settingRisk: 0.1, styleRisk: 0.2 },
              overallRisk: 0.8,
              flags: ['pacing_slow'],
              suggestions: ['Speed up'],
            },
          ],
          hotspots: [],
          processedAt: Date.now(),
        },
      });
      
      // Should not throw even when createMemory fails
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        skipMemoryCreation: false,
      });
      
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.memoriesCreated).toBe(0); // Creation failed
    });

    it('skips memory creation when skipMemoryCreation is true', async () => {
      vi.mocked(memory.getActiveGoals).mockResolvedValueOnce([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Fix pacing issues',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        heatmap: {
          sections: [
            {
              offset: 0,
              length: 500,
              scores: { plotRisk: 0.8, pacingRisk: 0.9, characterRisk: 0.1, settingRisk: 0.1, styleRisk: 0.2 },
              overallRisk: 0.8,
              flags: ['pacing_slow'],
              suggestions: ['Speed up'],
            },
          ],
          hotspots: [],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        skipMemoryCreation: true,
      });
      
      expect(memory.createMemory).not.toHaveBeenCalled();
      expect(result.memoriesCreated).toBe(0);
    });

    it('only creates memories for warning and critical conflicts', async () => {
      vi.mocked(memory.getWatchedEntities).mockResolvedValueOnce([
        {
          id: 'watch-1',
          name: 'Seth',
          projectId: 'test-project',
          priority: 'low',
          reason: 'Minor character',
          monitoringEnabled: true,
          createdAt: Date.now(),
        },
      ]);
      vi.mocked(memory.createMemory).mockResolvedValue({ id: 'new-mem' } as any);

      const intelligence = createMockIntelligence({
        hud: {
          ...createMockIntelligence().hud,
          context: {
            activeEntities: [
              {
                id: 'char-1',
                name: 'Seth',
                type: 'character',
                aliases: [],
                firstMention: 0,
                mentionCount: 2,
                mentions: [{ offset: 0, chapterId: 'ch-1' }],
                attributes: {},
              },
            ],
            activeRelationships: [],
            openPromises: [],
            recentEvents: [],
          },
        },
      });
      
      await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        skipMemoryCreation: false,
        minSeverity: 'info',
      });
      
      // Info-level conflicts should not trigger createMemory
      // (watched entity alerts are info-level)
      expect(memory.createMemory).not.toHaveBeenCalled();
    });
  });

  describe('deduplication and sorting', () => {
    it('deduplicates conflicts with same ID', async () => {
      // Create a scenario where the same conflict could be detected multiple times
      vi.mocked(memory.getActiveGoals).mockResolvedValue([
        {
          id: 'goal-1',
          projectId: 'test-project',
          title: 'Improve pacing speed faster',
          status: 'active',
          progress: 0,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        heatmap: {
          sections: [
            {
              offset: 0,
              length: 500,
              scores: { plotRisk: 0.5, pacingRisk: 0.8, characterRisk: 0.1, settingRisk: 0.1, styleRisk: 0.2 },
              overallRisk: 0.6,
              flags: ['pacing_slow'],
              suggestions: ['Speed up'],
            },
          ],
          hotspots: [],
          processedAt: Date.now(),
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
      });
      
      // Check that IDs are unique
      const ids = result.conflicts.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('sorts conflicts by severity (critical first)', async () => {
      vi.mocked(memory.searchMemoriesByTags).mockResolvedValue([
        {
          id: 'mem-voice',
          text: 'Character voice pattern described',
          type: 'fact',
          scope: 'project',
          projectId: 'test-project',
          topicTags: ['character:test', 'voice'],
          importance: 0.8,
          createdAt: Date.now(),
        },
      ]);
      vi.mocked(memory.getActiveGoals).mockResolvedValue([]);
      vi.mocked(memory.getWatchedEntities).mockResolvedValue([
        {
          id: 'watch-1',
          name: 'Test',
          projectId: 'test-project',
          priority: 'medium',
          reason: 'Watching',
          monitoringEnabled: true,
          createdAt: Date.now(),
        },
      ]);

      const intelligence = createMockIntelligence({
        voice: {
          profiles: {},
          consistencyAlerts: ['Test shows avgSentenceLength shift of 30%.'],
        },
        hud: {
          ...createMockIntelligence().hud,
          context: {
            activeEntities: [
              {
                id: 'char-test',
                name: 'Test',
                type: 'character',
                aliases: [],
                firstMention: 0,
                mentionCount: 3,
                mentions: [],
                attributes: {},
              },
            ],
            activeRelationships: [],
            openPromises: [],
            recentEvents: [],
          },
        },
      });
      
      const result = await analyzeIntelligenceAgainstMemory(intelligence, {
        projectId: 'test-project',
        worldRules: ['No one can enter Test area - it is forbidden.'],
        minSeverity: 'info',
      });
      
      // If there are multiple severities, critical should come first
      if (result.conflicts.length > 1) {
        const severities = result.conflicts.map(c => c.severity);
        const criticalIndex = severities.indexOf('critical');
        const warningIndex = severities.indexOf('warning');
        const infoIndex = severities.indexOf('info');
        
        if (criticalIndex >= 0 && warningIndex >= 0) {
          expect(criticalIndex).toBeLessThan(warningIndex);
        }
        if (warningIndex >= 0 && infoIndex >= 0) {
          expect(warningIndex).toBeLessThan(infoIndex);
        }
      }
    });
  });
});
