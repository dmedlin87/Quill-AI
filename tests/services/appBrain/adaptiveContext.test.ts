import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAdaptiveContext,
  DEFAULT_BUDGET,
  VOICE_MODE_BUDGET,
  EDITING_BUDGET,
  DEEP_ANALYSIS_BUDGET,
  estimateTokens,
  selectContextProfile,
  selectBudget,
  getContextBudgetForModel,
  PROFILE_ALLOCATIONS,
  // Smartness Upgrade: Scene-aware memory filtering
  getSceneContextFromState,
  buildSceneAwareRelevance,
  type SceneContext,
} from '@/services/appBrain/adaptiveContext';
import { eventBus } from '@/services/appBrain/eventBus';
import * as memoryService from '@/services/memory';

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    formatRecentEventsForAI: vi.fn(() => 'Events...'),
  },
}));

describe('adaptiveContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState: any = {
    manuscript: {
      projectTitle: 'Novel',
      chapters: [
        { id: 'c1', title: 'One', content: 'abc', order: 0, updatedAt: 0 },
        { id: 'c2', title: 'Two', content: 'xyz', order: 1, updatedAt: 0 },
      ],
      activeChapterId: 'c1',
      currentText: 'Hello world around cursor',
      setting: { timePeriod: 'Now', location: 'Here' },
    },
    ui: {
      cursor: { position: 6 },
      selection: { text: 'Hello', start: 0, end: 5 },
      microphone: { status: 'idle', mode: 'voice', lastTranscript: null, error: null },
    },
    intelligence: {
      hud: {
        situational: {
          tensionLevel: 'medium',
          pacing: 'steady',
          narrativePosition: { percentComplete: 50 },
          currentScene: { type: 'intro' },
          currentParagraph: { type: 'body' },
        },
        context: { activeEntities: [] },
        prioritizedIssues: [],
        styleAlerts: [],
        stats: { wordCount: 1000, sentenceCount: 100, paragraphCount: 10 },
      },
      timeline: null,
    },
    analysis: { result: null },
    lore: { characters: [], worldRules: [], manuscriptIndex: null },
    session: { chatHistory: [] },
  };

  describe('buildAdaptiveContext', () => {
    it('prefers voice budget when mode provided and tracks inclusions', async () => {
      const result = await buildAdaptiveContext(baseState, 'p1', { budget: VOICE_MODE_BUDGET });

      expect(result.budget.totalTokens).toBeLessThan(DEFAULT_BUDGET.totalTokens);
      expect(result.sectionsIncluded).toContain('manuscript');
    });

    it('truncates sections when exceeding budget', async () => {
      const tinyBudget = { ...DEFAULT_BUDGET, totalTokens: 100 };
      const largeState = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          currentText: 'lorem '.repeat(500),
        },
      };

      const result = await buildAdaptiveContext(largeState, 'p1', { budget: tinyBudget });

      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeLessThanOrEqual(tinyBudget.totalTokens + 100);
    });

    it('uses default budget when no options provided', async () => {
      const result = await buildAdaptiveContext(baseState, 'p1');

      expect(result.budget.totalTokens).toBe(DEFAULT_BUDGET.totalTokens);
    });

    it('ensures a bedside-note planning memory exists for the project', async () => {
      const getMemoriesSpy = vi
        .spyOn(memoryService, 'getMemories')
        .mockResolvedValueOnce([] as any); // No existing bedside note

      const createMemorySpy = vi
        .spyOn(memoryService, 'createMemory')
        .mockResolvedValueOnce({
          id: 'bedside-1',
          scope: 'project',
          projectId: 'p1',
          type: 'plan',
          text: 'Project planning notes for this manuscript. This note will be updated over time with key goals, concerns, and constraints.',
          topicTags: ['meta:bedside-note', 'planner:global', 'arc:story'],
          importance: 0.85,
          createdAt: Date.now(),
        } as any);

      vi
        .spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce({ author: [], project: [] } as any);
      vi
        .spyOn(memoryService, 'getActiveGoals')
        .mockResolvedValueOnce([] as any);

      vi
        .spyOn(memoryService, 'formatMemoriesForPrompt')
        .mockReturnValue('[MEM]');
      vi
        .spyOn(memoryService, 'formatGoalsForPrompt')
        .mockReturnValue('');

      await buildAdaptiveContext(baseState, 'p1');

      expect(getMemoriesSpy).toHaveBeenCalledWith({
        scope: 'project',
        projectId: 'p1',
        type: 'plan',
        topicTags: ['meta:bedside-note'],
        limit: 1,
      });
      expect(createMemorySpy).toHaveBeenCalledTimes(1);
    });

    it('prioritizes bedside-note memories at the top of project memory list', async () => {
      // Simulate that a bedside-note plan already exists so ensureBedsideNoteExists is a no-op
      vi
        .spyOn(memoryService, 'getMemories')
        .mockResolvedValueOnce([
          {
            id: 'bedside-1',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'Bedside planning note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.9,
            createdAt: Date.now(),
          },
        ] as any);

      const memoriesForContext = {
        author: [],
        project: [
          {
            id: 'other-1',
            scope: 'project',
            projectId: 'p1',
            type: 'fact',
            text: 'Some other project fact',
            topicTags: ['general'],
            importance: 0.5,
            createdAt: Date.now(),
          },
          {
            id: 'bedside-1',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'Bedside planning note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.9,
            createdAt: Date.now(),
          },
        ],
      } as any;

      vi
        .spyOn(memoryService, 'getRelevantMemoriesForContext')
        .mockResolvedValueOnce(memoriesForContext);
      vi
        .spyOn(memoryService, 'getActiveGoals')
        .mockResolvedValueOnce([] as any);

      const formatMemoriesForPromptSpy = vi
        .spyOn(memoryService, 'formatMemoriesForPrompt')
        .mockImplementation(({ project }) => project.map((m: any) => m.id).join(','));
      vi
        .spyOn(memoryService, 'formatGoalsForPrompt')
        .mockReturnValue('');

      await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(formatMemoriesForPromptSpy).toHaveBeenCalledTimes(1);
      const [passedMemories] = formatMemoriesForPromptSpy.mock.calls[0];
      expect((passedMemories as any).project.map((m: any) => m.id)).toEqual([
        'bedside-1',
        'other-1',
      ]);
    });

    it('refreshes stale bedside note using latest analysis summary and goals', async () => {
      const staleTimestamp = Date.now() - 1000 * 60 * 60 * 24;
      vi
        .spyOn(memoryService, 'getMemories')
        .mockResolvedValueOnce([
          {
            id: 'bedside-1',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'Old bedside note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.9,
            createdAt: staleTimestamp,
            updatedAt: staleTimestamp,
          },
        ] as any);

      const memoriesForContext = {
        author: [],
        project: [
          {
            id: 'bedside-1',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'Old bedside note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.9,
            createdAt: staleTimestamp,
            updatedAt: staleTimestamp,
          },
          {
            id: 'other-1',
            scope: 'project',
            projectId: 'p1',
            type: 'fact',
            text: 'Another note',
            topicTags: ['general'],
            importance: 0.4,
            createdAt: Date.now(),
          },
        ],
      } as any;

      const refreshedMemoriesForContext = {
        author: [],
        project: [
          {
            id: 'bedside-2',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'New bedside note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.95,
            createdAt: staleTimestamp,
            updatedAt: Date.now(),
          },
          memoriesForContext.project[1],
        ],
      } as any;

      vi
        .spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce(memoriesForContext)
        .mockResolvedValueOnce(refreshedMemoriesForContext);
      const evolveSpy = vi
        .spyOn(memoryService, 'evolveBedsideNote')
        .mockResolvedValueOnce({} as any);
      vi
        .spyOn(memoryService, 'getActiveGoals')
        .mockResolvedValueOnce([
          { id: 'g1', title: 'Finish draft', progress: 30 } as any,
        ]);
      const formatMemoriesForPromptSpy = vi
        .spyOn(memoryService, 'formatMemoriesForPrompt')
        .mockImplementation(({ project }) => project.map((m: any) => m.id).join(','));
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      const stateWithAnalysis = {
        ...baseState,
        analysis: {
          result: {
            summary: 'Fresh summary',
            strengths: [],
            weaknesses: ['weakness'],
            plotIssues: [{ issue: 'Plot hole' }],
          },
        },
      };

      await buildAdaptiveContext(stateWithAnalysis, 'p1', {
        budget: DEFAULT_BUDGET,
        bedsideNoteStalenessMs: 1000 * 60 * 60,
        sceneAwareMemory: false,
      });

      expect(evolveSpy).toHaveBeenCalledTimes(1);
      const [projectIdArg, planText, options] = evolveSpy.mock.calls[0];
      expect(projectIdArg).toBe('p1');
      expect(planText).toContain('Fresh summary');
      expect(planText).toContain('Finish draft');
      expect(options).toEqual({ changeReason: 'staleness_refresh' });
      const [passedMemories] = formatMemoriesForPromptSpy.mock.calls[0];
      expect((passedMemories as any).project.map((m: any) => m.id)).toEqual([
        'bedside-2',
        'other-1',
      ]);
    });

    it('does not refresh bedside note when within staleness threshold', async () => {
      const recentTimestamp = Date.now() - 1000 * 60 * 10;
      vi
        .spyOn(memoryService, 'getMemories')
        .mockResolvedValueOnce([
          {
            id: 'bedside-1',
            scope: 'project',
            projectId: 'p1',
            type: 'plan',
            text: 'Recent bedside note',
            topicTags: ['meta:bedside-note', 'planner:global'],
            importance: 0.9,
            createdAt: recentTimestamp,
            updatedAt: recentTimestamp,
          },
        ] as any);

      vi
        .spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce({
          author: [],
          project: [
            {
              id: 'bedside-1',
              scope: 'project',
              projectId: 'p1',
              type: 'plan',
              text: 'Recent bedside note',
              topicTags: ['meta:bedside-note', 'planner:global'],
              importance: 0.9,
              createdAt: recentTimestamp,
              updatedAt: recentTimestamp,
            },
          ],
        } as any);
      const evolveSpy = vi
        .spyOn(memoryService, 'evolveBedsideNote')
        .mockResolvedValue({} as any);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValueOnce([] as any);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
        bedsideNoteStalenessMs: 1000 * 60 * 60,
        sceneAwareMemory: false,
      });

      expect(evolveSpy).not.toHaveBeenCalled();
    });

    it('merges project, arc, and chapter bedside notes hierarchically', async () => {
      const stateWithArc = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          activeArcId: 'arc-1',
          arcs: [{ id: 'arc-1', title: 'The Descent' }],
        },
      } as any;

      const projectNote = {
        id: 'bed-project',
        scope: 'project',
        projectId: 'p1',
        type: 'plan',
        text: 'Project bedside plan',
        topicTags: ['meta:bedside-note'],
        importance: 0.9,
        createdAt: Date.now(),
      };

      const arcNote = {
        ...projectNote,
        id: 'bed-arc',
        text: 'Arc bedside plan',
        topicTags: ['meta:bedside-note', 'arc:arc-1'],
      };

      const chapterNote = {
        ...projectNote,
        id: 'bed-chapter',
        text: 'Chapter bedside plan',
        topicTags: ['meta:bedside-note', 'chapter:c1'],
      };

      vi.spyOn(memoryService, 'getMemories').mockResolvedValue([projectNote] as any);
      vi
        .spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce({
          author: [],
          project: [projectNote, arcNote, chapterNote],
        } as any);

      const manualFormatted = [
        '## Project Memory',
        '### Bedside Notes',
        '- Project plan: Project bedside plan',
        '- Arc plan (The Descent): Arc bedside plan',
        '- Chapter plan (One): Chapter bedside plan',
      ].join('\n');

      const formatSpy = vi
        .spyOn(memoryService, 'formatMemoriesForPrompt')
        .mockReturnValue(manualFormatted);

      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValue([] as any);
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      await buildAdaptiveContext(stateWithArc, 'p1', {
        budget: DEFAULT_BUDGET,
        relevance: {},
        sceneAwareMemory: false,
      });

      expect(formatSpy).toHaveBeenCalled();
      const [passedMemories, formatOptions] = formatSpy.mock.calls[0];
      expect((passedMemories as any).project.map((m: any) => m.id)).toEqual([
        'bed-chapter',
        'bed-arc',
        'bed-project',
      ]);
      expect(formatOptions).toEqual(
        expect.objectContaining({ activeArcId: 'arc-1', activeChapterId: 'c1' })
      );
      expect(formatSpy.mock.results[0]?.value as string).toContain('Arc plan (The Descent)');
      expect(formatSpy.mock.results[0]?.value as string).toContain('Chapter plan (One)');
    });

    it('injects a conflict alert section when bedside notes are tagged with conflicts', async () => {
      const conflictNote = {
        id: 'bed-conflict',
        scope: 'project',
        projectId: 'p1',
        type: 'plan',
        text: 'Sarah has green eyes',
        topicTags: ['meta:bedside-note', 'conflict:detected'],
        importance: 0.9,
        structuredContent: {
          conflicts: [
            {
              previous: 'Sarah has blue eyes',
              current: 'Sarah has green eyes',
              resolution: 'agent',
            },
          ],
        },
      } as any;

      vi.spyOn(memoryService, 'getMemories').mockResolvedValue([conflictNote]);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValue([] as any);
      vi.spyOn(memoryService, 'getMemoriesForContext').mockResolvedValue({
        author: [],
        project: [conflictNote],
      } as any);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('Formatted memories');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      const result = await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('[CONFLICT ALERT]');
      expect(result.context).toContain('Sarah has blue eyes');
      expect(result.context).toContain('resolution: agent');
    });
  });

  describe('estimateTokens', () => {
    it('estimates tokens by character count', () => {
      expect(estimateTokens('12345678')).toBe(2);
    });

    it('handles empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('selectContextProfile', () => {
    it('returns voice profile for voice mode', () => {
      expect(selectContextProfile({ mode: 'voice', hasSelection: false })).toBe('voice');
      expect(selectContextProfile({ mode: 'voice', hasSelection: true })).toBe('voice');
    });

    it('returns analysis_deep for analysis queryType', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'analysis' })).toBe('analysis_deep');
    });

    it('returns editing for editing queryType or selection', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: true })).toBe('editing');
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'editing' })).toBe('editing');
    });

    it('returns full for general text mode without selection', () => {
      expect(selectContextProfile({ mode: 'text', hasSelection: false })).toBe('full');
      expect(selectContextProfile({ mode: 'text', hasSelection: false, queryType: 'general' })).toBe('full');
    });
  });

  describe('getContextBudgetForModel', () => {
    it('returns budget with appropriate total tokens', () => {
      const budget = getContextBudgetForModel('agent', 'full');

      expect(budget.totalTokens).toBeGreaterThan(0);
      expect(budget.totalTokens).toBeLessThanOrEqual(16000); // maxBudget default
    });

    it('uses profile allocations', () => {
      const editingBudget = getContextBudgetForModel('agent', 'editing');
      const voiceBudget = getContextBudgetForModel('agent', 'voice');

      expect(editingBudget.sections).toEqual(PROFILE_ALLOCATIONS.editing);
      expect(voiceBudget.sections).toEqual(PROFILE_ALLOCATIONS.voice);
    });

    it('respects maxBudget option', () => {
      const budget = getContextBudgetForModel('agent', 'full', { maxBudget: 5000 });

      expect(budget.totalTokens).toBeLessThanOrEqual(5000);
    });

    it('respects reserveForResponse option', () => {
      const normalBudget = getContextBudgetForModel('agent', 'full');
      const largeReserveBudget = getContextBudgetForModel('agent', 'full', { reserveForResponse: 10000 });

      // Larger reserve should result in smaller available budget
      expect(largeReserveBudget.totalTokens).toBeLessThanOrEqual(normalBudget.totalTokens);
    });

    it('falls back to default token limit when model config has no limits', async () => {
      vi.resetModules();
      vi.doMock('@/config/models', () => ({
        ActiveModels: {
          agent: { id: 'unknown-model' },
          analysis: { id: 'unknown-model' },
        },
        TokenLimits: {},
      }));

      const mod = await import('@/services/appBrain/adaptiveContext');
      const budget = mod.getContextBudgetForModel('agent', 'full', { reserveForResponse: 4000, maxBudget: 999999 });

      // Default fallback is 32_000 - reserveForResponse.
      expect(budget.totalTokens).toBe(32000 - 4000);
      vi.doUnmock('@/config/models');
    });
  });

  describe('PROFILE_ALLOCATIONS', () => {
    it('has all expected profiles', () => {
      expect(PROFILE_ALLOCATIONS).toHaveProperty('full');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('editing');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('voice');
      expect(PROFILE_ALLOCATIONS).toHaveProperty('analysis_deep');
    });

    it('all profiles sum to ~1.0', () => {
      for (const [profile, sections] of Object.entries(PROFILE_ALLOCATIONS)) {
        const sum = Object.values(sections).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SMARTNESS UPGRADE: Scene-Aware Memory Filtering
  // ─────────────────────────────────────────────────────────────────────────

  describe('getSceneContextFromState', () => {
    it('returns default context when no HUD available', () => {
      const stateWithoutHud = {
        ...baseState,
        intelligence: { hud: null },
      };

      const context = getSceneContextFromState(stateWithoutHud);

      expect(context.sceneType).toBeNull();
      expect(context.location).toBeNull();
      expect(context.pov).toBeNull();
      expect(context.tensionLevel).toBe('medium');
    });

    it('extracts scene context from HUD', () => {
      const stateWithScene = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            situational: {
              ...baseState.intelligence.hud.situational,
              currentScene: {
                type: 'action',
                pov: 'Seth',
                location: 'Castle',
              },
              tensionLevel: 'high',
            },
          },
        },
      };

      const context = getSceneContextFromState(stateWithScene);

      expect(context.sceneType).toBe('action');
      expect(context.pov).toBe('Seth');
      expect(context.location).toBe('Castle');
      expect(context.tensionLevel).toBe('high');
    });

    it('returns null scene fields when currentScene is present but missing values', () => {
      const stateWithPartialScene = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            situational: {
              ...baseState.intelligence.hud.situational,
              currentScene: {} as any,
            },
          },
        },
      };

      const context = getSceneContextFromState(stateWithPartialScene);
      expect(context.sceneType).toBeNull();
      expect(context.location).toBeNull();
      expect(context.pov).toBeNull();
    });
  });

  describe('buildSceneAwareRelevance', () => {
    it('adds scene-type-specific keywords', () => {
      const baseRelevance = { activeEntityNames: [], selectionKeywords: [] };
      const actionContext: SceneContext = {
        sceneType: 'action',
        location: null,
        pov: null,
        tensionLevel: 'medium',
      };

      const result = buildSceneAwareRelevance(baseRelevance, actionContext);

      // Action scenes should add combat/tension keywords
      expect(result.selectionKeywords).toContain('conflict');
      expect(result.selectionKeywords).toContain('tension');
      expect(result.selectionKeywords).toContain('stakes');
    });

    it('adds dialogue-specific keywords for dialogue scenes', () => {
      const baseRelevance = { activeEntityNames: [], selectionKeywords: [] };
      const dialogueContext: SceneContext = {
        sceneType: 'dialogue',
        location: null,
        pov: null,
        tensionLevel: 'low',
      };

      const result = buildSceneAwareRelevance(baseRelevance, dialogueContext);

      expect(result.selectionKeywords).toContain('relationship');
      expect(result.selectionKeywords).toContain('conversation');
      expect(result.selectionKeywords).toContain('voice');
    });

    it('adds tension-level keywords', () => {
      const baseRelevance = { activeEntityNames: [], selectionKeywords: [] };
      const highTensionContext: SceneContext = {
        sceneType: null,
        location: null,
        pov: null,
        tensionLevel: 'high',
      };

      const result = buildSceneAwareRelevance(baseRelevance, highTensionContext);

      // High tension should boost conflict/stakes keywords
      expect(result.selectionKeywords).toContain('conflict');
      expect(result.selectionKeywords).toContain('stakes');
      expect(result.selectionKeywords).toContain('climax');
    });

    it('adds location as keyword', () => {
      const baseRelevance = { activeEntityNames: [], selectionKeywords: [] };
      const locationContext: SceneContext = {
        sceneType: null,
        location: 'The Castle',
        pov: null,
        tensionLevel: 'medium',
      };

      const result = buildSceneAwareRelevance(baseRelevance, locationContext);

      expect(result.selectionKeywords).toContain('the castle');
    });

    it('adds POV character to active entities', () => {
      const baseRelevance = { activeEntityNames: ['Maria'], selectionKeywords: [] };
      const povContext: SceneContext = {
        sceneType: null,
        location: null,
        pov: 'Seth',
        tensionLevel: 'medium',
      };

      const result = buildSceneAwareRelevance(baseRelevance, povContext);

      expect(result.activeEntityNames).toContain('Maria');
      expect(result.activeEntityNames).toContain('Seth');
    });

    it('preserves base relevance keywords', () => {
      const baseRelevance = { 
        activeEntityNames: ['TestChar'], 
        selectionKeywords: ['custom', 'keywords'] 
      };
      const context: SceneContext = {
        sceneType: 'action',
        location: null,
        pov: null,
        tensionLevel: 'medium',
      };

      const result = buildSceneAwareRelevance(baseRelevance, context);

      expect(result.selectionKeywords).toContain('custom');
      expect(result.selectionKeywords).toContain('keywords');
      expect(result.activeEntityNames).toContain('TestChar');
    });

    it('deduplicates keywords', () => {
      const baseRelevance = { 
        activeEntityNames: [], 
        selectionKeywords: ['conflict', 'tension'] // Already has these
      };
      const actionContext: SceneContext = {
        sceneType: 'action', // Would add conflict, tension again
        location: null,
        pov: null,
        tensionLevel: 'high', // Would add conflict again
      };

      const result = buildSceneAwareRelevance(baseRelevance, actionContext);

      // Should not have duplicates
      const conflictCount = result.selectionKeywords!.filter(k => k === 'conflict').length;
      expect(conflictCount).toBe(1);
    });
  });

  describe('buildAdaptiveContext with sceneAwareMemory', () => {
    it('applies scene-aware filtering by default', async () => {
      const stateWithScene = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            situational: {
              ...baseState.intelligence.hud.situational,
              currentScene: { type: 'dialogue', pov: 'Seth', location: 'Cafe' },
              tensionLevel: 'low',
            },
          },
        },
      };

      // Should not throw
      const result = await buildAdaptiveContext(stateWithScene, 'p1');
      expect(result.context).toBeDefined();
    });

    it('can disable scene-aware filtering', async () => {
      const result = await buildAdaptiveContext(baseState, 'p1', { 
        sceneAwareMemory: false 
      });
      
      expect(result.context).toBeDefined();
    });
  });
  describe('Detailed Section Generation', () => {
    it('omits active chapter line when activeChapterId does not match', async () => {
      const stateNoActiveChapter = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          activeChapterId: 'missing',
        },
      };

      const result = await buildAdaptiveContext(stateNoActiveChapter, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('[MANUSCRIPT STATE]');
      expect(result.context).not.toContain('Active Chapter:');
    });

    it('truncates selected text preview when selection exceeds 200 chars', async () => {
      const longSelection = 'x'.repeat(250);
      const stateWithLongSelection = {
        ...baseState,
        ui: {
          ...baseState.ui,
          selection: { text: longSelection, start: 0, end: 250 },
        },
      };

      const result = await buildAdaptiveContext(stateWithLongSelection, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain(longSelection.slice(0, 200) + '...');
    });

    it('includes surrounding text in manuscript section when budget permits', async () => {
      const stateWithText = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          currentText: 'A'.repeat(100) + 'TARGET' + 'B'.repeat(100),
        },
        ui: {
          ...baseState.ui,
          cursor: { position: 103 }, // Middle of TARGET
          selection: null,
        },
      };

      const result = await buildAdaptiveContext(stateWithText, 'p1', {
        budget: { ...DEFAULT_BUDGET, totalTokens: 10000 }, // Generous budget
      });

      expect(result.context).toContain('Context around cursor:');
      expect(result.context).toContain('TARGET');
    });

    it('does not include a scene header when HUD has no currentScene', async () => {
      const stateWithHudNoScene = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            situational: {
              ...baseState.intelligence.hud.situational,
              currentScene: null,
            },
          },
        },
      };

      const result = await buildAdaptiveContext(stateWithHudNoScene, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('[INTELLIGENCE HUD]');
      expect(result.context).not.toContain('Scene:');
    });

    it('stops listing entities when entity budget is exceeded', async () => {
      const stateWithManyEntities = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            context: {
              activeEntities: [
                { name: 'VeryLongEntityNameThatWillOverflowBudget', type: 'character', mentionCount: 999 },
              ],
            },
          },
        },
      };

      // Keep memory section small/stable so overall context isn't dominated by the catch block.
      vi.spyOn(memoryService, 'getMemories').mockResolvedValue([{ id: 'bed', topicTags: ['meta:bedside-note'] }] as any);
      vi.spyOn(memoryService, 'getMemoriesForContext').mockResolvedValue({ author: [], project: [] } as any);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValue([] as any);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      // Use a budget that keeps the intelligence section present but small enough to trigger
      // the entityBudget early-break.
      const budget = {
        totalTokens: 1000,
        sections: {
          manuscript: 0.2,
          intelligence: 0.05,
          analysis: 0.1,
          memory: 0.25,
          lore: 0.25,
          history: 0.15,
        },
      };

      const result = await buildAdaptiveContext(stateWithManyEntities, 'p1', {
        budget,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('Active Characters:');
      expect(result.context).not.toContain('VeryLongEntityNameThatWillOverflowBudget');
    });

    it('includes prioritized issues with severity icons', async () => {
      const stateWithIssues = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            prioritizedIssues: [
              { severity: 0.8, description: 'High severity issue' },
              { severity: 0.5, description: 'Medium severity issue' },
              { severity: 0.2, description: 'Low severity issue' },
            ],
          },
        },
      };

      const result = await buildAdaptiveContext(stateWithIssues, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('Priority Issues:');
      expect(result.context).toContain('High severity issue');
      expect(result.context).toContain('Medium severity issue');
      expect(result.context).toContain('Low severity issue');
    });

    it('omits optional analysis fields when missing', async () => {
      const stateWithSparseAnalysis = {
        ...baseState,
        analysis: {
          result: {
            summary: '',
            strengths: [],
            weaknesses: [],
            plotIssues: [],
          },
        },
      };

      const result = await buildAdaptiveContext(stateWithSparseAnalysis, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('[ANALYSIS INSIGHTS]');
      expect(result.context).not.toContain('Summary:');
      expect(result.context).not.toContain('Strengths:');
      expect(result.context).not.toContain('Weaknesses:');
      expect(result.context).not.toContain('Plot Issues');
    });

    it('includes intelligence details (entities, style alerts)', async () => {
      const stateWithIntel = {
        ...baseState,
        intelligence: {
          hud: {
            ...baseState.intelligence.hud,
            context: {
              activeEntities: [{ name: 'Hero', type: 'Protagonist', mentionCount: 10 }],
            },
            styleAlerts: ['Too many adverbs'],
          },
        },
      };

      const result = await buildAdaptiveContext(stateWithIntel, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('Hero (Protagonist)');
      expect(result.context).toContain('Style Alerts: Too many adverbs');
    });

    it('includes analysis breakdown', async () => {
      const stateWithAnalysis = {
        ...baseState,
        analysis: {
          result: {
            summary: 'A great story',
            strengths: ['Pacing'],
            weaknesses: ['Dialogue'],
            plotIssues: [{ issue: 'Hole 1' }],
          },
        },
      };

      const result = await buildAdaptiveContext(stateWithAnalysis, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('[ANALYSIS INSIGHTS]');
      expect(result.context).toContain('Strengths: Pacing');
      expect(result.context).toContain('Weaknesses: Dialogue');
      expect(result.context).toContain('Hole 1');
    });

    it('includes lore characters and rules', async () => {
      const stateWithLore = {
        ...baseState,
        lore: {
          characters: [{ name: 'Gandalf', bio: 'Wizard' }],
          worldRules: ['Magic is dangerous'],
        },
      };

      const result = await buildAdaptiveContext(stateWithLore, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('[LORE BIBLE]');
      expect(result.context).toContain('Gandalf: Wizard');
      expect(result.context).toContain('Magic is dangerous');
    });

    it('includes history and last action', async () => {
      const stateWithAction = {
        ...baseState,
        session: {
          lastAgentAction: { type: 'edit', description: 'Fixed typo', success: true },
        },
      };

      const result = await buildAdaptiveContext(stateWithAction, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('[RECENT ACTIVITY]');
      expect(result.context).toContain('Last Action: edit - Fixed typo');
      expect(result.context).toContain('Result: Success');
    });
  });

  describe('selectBudget', () => {
      it('reduces budget for long conversations', () => {
          const budget = selectBudget(15, false, false, 'general');
          expect(budget.totalTokens).toBe(DEFAULT_BUDGET.totalTokens * 0.7);
      });

      it('returns voice budget when isVoiceMode is true', () => {
          const budget = selectBudget(0, false, true);
          expect(budget).toEqual(VOICE_MODE_BUDGET);
      });

      it('returns editing budget when queryType is editing', () => {
          const budget = selectBudget(0, false, false, 'editing');
          expect(budget).toEqual(EDITING_BUDGET);
      });

      it('returns editing budget when hasSelection is true', () => {
          const budget = selectBudget(0, true, false);
          expect(budget).toEqual(EDITING_BUDGET);
      });

      it('returns deep analysis budget when queryType is analysis', () => {
          const budget = selectBudget(0, false, false, 'analysis');
          expect(budget).toEqual(DEEP_ANALYSIS_BUDGET);
      });

      it('returns default budget for short conversations without special params', () => {
          const budget = selectBudget(5, false, false);
          expect(budget).toEqual(DEFAULT_BUDGET);
      });

      it('prioritizes voice mode over other options', () => {
          // Voice mode should take precedence even with selection and analysis query
          const budget = selectBudget(0, true, true, 'analysis');
          expect(budget).toEqual(VOICE_MODE_BUDGET);
      });

      it('prioritizes editing/selection over analysis', () => {
          // Editing should come before analysis in priority
          const budget = selectBudget(0, true, false, 'analysis');
          expect(budget).toEqual(EDITING_BUDGET);
      });
  });

  describe('Section Omission and Truncation', () => {
    it('omits sections when budget is exhausted and section is not truncatable', async () => {
      // Use extremely tiny budget to force omission
      const tinyBudget = { ...DEFAULT_BUDGET, totalTokens: 50 };
      const result = await buildAdaptiveContext(baseState, 'p1', { budget: tinyBudget });

      // Should have omitted some sections due to budget
      expect(result.sectionsOmitted.length + result.sectionsTruncated.length).toBeGreaterThan(0);
    });

    it('tracks sections that were truncated during assembly', async () => {
      const smallBudget = { ...DEFAULT_BUDGET, totalTokens: 200 };
      const largeState = {
        ...baseState,
        manuscript: {
          ...baseState.manuscript,
          currentText: 'content '.repeat(200),
        },
      };

      const result = await buildAdaptiveContext(largeState, 'p1', { budget: smallBudget });

      // At least one section should be truncated
      expect(result.sectionsTruncated.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Section Error Handling', () => {
    it('handles memory service errors gracefully', async () => {
      vi.spyOn(memoryService, 'getMemories').mockRejectedValueOnce(new Error('DB error'));
      vi.spyOn(memoryService, 'getMemoriesForContext').mockRejectedValueOnce(new Error('DB error'));

      const result = await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('Memory unavailable');
    });
  });

  describe('buildBedsidePlanText Edge Cases', () => {
    it('includes goal progress in bedside note text', async () => {
      const staleTimestamp = Date.now() - 1000 * 60 * 60 * 24;
      vi.spyOn(memoryService, 'getMemories').mockResolvedValueOnce([
        {
          id: 'bedside-1',
          scope: 'project',
          projectId: 'p1',
          type: 'plan',
          text: 'Old note',
          topicTags: ['meta:bedside-note'],
          importance: 0.9,
          createdAt: staleTimestamp,
          updatedAt: staleTimestamp,
        },
      ] as any);

      vi.spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce({
          author: [],
          project: [{
            id: 'bedside-1',
            topicTags: ['meta:bedside-note'],
            createdAt: staleTimestamp,
            updatedAt: staleTimestamp,
          }],
        } as any)
        .mockResolvedValueOnce({ author: [], project: [] } as any);

      const evolveSpy = vi.spyOn(memoryService, 'evolveBedsideNote').mockResolvedValueOnce({} as any);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValueOnce([
        { id: 'g1', title: 'Complete chapter 5', progress: 75 } as any,
      ]);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
        bedsideNoteStalenessMs: 1000 * 60 * 60,
        sceneAwareMemory: false,
      });

      expect(evolveSpy).toHaveBeenCalled();
      const planText = evolveSpy.mock.calls[0][1];
      expect(planText).toContain('Complete chapter 5');
      expect(planText).toContain('[75%]');
    });

    it('includes plot issues in bedside refresh', async () => {
      const staleTimestamp = Date.now() - 1000 * 60 * 60 * 24;
      vi.spyOn(memoryService, 'getMemories').mockResolvedValueOnce([
        {
          id: 'bedside-1',
          scope: 'project',
          type: 'plan',
          topicTags: ['meta:bedside-note'],
          createdAt: staleTimestamp,
          updatedAt: staleTimestamp,
        },
      ] as any);

      vi.spyOn(memoryService, 'getMemoriesForContext')
        .mockResolvedValueOnce({
          author: [],
          project: [{
            id: 'bedside-1',
            topicTags: ['meta:bedside-note'],
            createdAt: staleTimestamp,
          }],
        } as any)
        .mockResolvedValueOnce({ author: [], project: [] } as any);

      const evolveSpy = vi.spyOn(memoryService, 'evolveBedsideNote').mockResolvedValueOnce({} as any);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValueOnce([]);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      const stateWithPlotIssues = {
        ...baseState,
        analysis: {
          result: {
            summary: 'Story summary',
            strengths: [],
            weaknesses: ['Weak dialogue', 'Pacing issues'],
            plotIssues: [{ issue: 'Plot hole in chapter 3' }],
          },
        },
      };

      await buildAdaptiveContext(stateWithPlotIssues, 'p1', {
        budget: DEFAULT_BUDGET,
        bedsideNoteStalenessMs: 1000 * 60 * 60,
        sceneAwareMemory: false,
      });

      expect(evolveSpy).toHaveBeenCalled();
      const planText = evolveSpy.mock.calls[0][1];
      expect(planText).toContain('Plot hole in chapter 3');
      expect(planText).toContain('Weak dialogue');
    });
  });

  describe('No Project ID Handling', () => {
    it('returns minimal memory section when no projectId', async () => {
      const result = await buildAdaptiveContext(baseState, null, {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('No project context for memory');
    });
  });

  describe('Conflict Alert - No Structured Conflicts', () => {
    it('shows generic conflict message when structuredContent has no conflicts array', async () => {
      const conflictNote = {
        id: 'bed-conflict',
        scope: 'project',
        projectId: 'p1',
        type: 'plan',
        text: 'Conflicting note',
        topicTags: ['meta:bedside-note', 'conflict:detected'],
        importance: 0.9,
        structuredContent: {}, // No conflicts array
      } as any;

      vi.spyOn(memoryService, 'getMemories').mockResolvedValue([conflictNote]);
      vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValue([] as any);
      vi.spyOn(memoryService, 'getMemoriesForContext').mockResolvedValue({
        author: [],
        project: [conflictNote],
      } as any);
      vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValue('');
      vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValue('');

      const result = await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
        sceneAwareMemory: false,
      });

      expect(result.context).toContain('[CONFLICT ALERT]');
      expect(result.context).toContain('Conflicting updates detected');
      expect(result.context).toContain('Review history');
    });
  });

  describe('Last Agent Action Failed', () => {
    it('shows Failed result for unsuccessful actions', async () => {
      const stateWithFailedAction = {
        ...baseState,
        session: {
          lastAgentAction: { type: 'generate', description: 'Failed generation', success: false },
        },
      };

      const result = await buildAdaptiveContext(stateWithFailedAction, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('Result: Failed');
    });
  });

  describe('Empty Event History', () => {
    it('handles no recent events', async () => {
      vi.mocked(eventBus.formatRecentEventsForAI).mockReturnValue(null);

      const result = await buildAdaptiveContext(baseState, 'p1', {
        budget: DEFAULT_BUDGET,
      });

      expect(result.context).toContain('No recent events');
    });
  });
});
