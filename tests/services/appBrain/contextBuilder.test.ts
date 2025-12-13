import { describe, it, expect, vi } from 'vitest';
import {
  buildAgentContext,
  buildAgentContextWithMemory,
  buildCompressedContext,
  buildNavigationContext,
  buildEditingContext,
  createContextBuilder,
  getSmartAgentContext,
  CHAT_CONTEXT_TEMPLATE,
  API_CONTEXT_TEMPLATE,
} from '@/services/appBrain/contextBuilder';
import { eventBus } from '@/services/appBrain/eventBus';
import * as memoryService from '@/services/memory';
import * as adaptiveContext from '@/services/appBrain/adaptiveContext';
import type { AppBrainState } from '@/services/appBrain/types';

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    formatRecentEventsForAI: vi.fn(() => 'Evt 1\nEvt 2'),
    getRecentEvents: vi.fn(() => [{ type: 'DOCUMENT_SAVED', timestamp: 1, payload: { chapterId: 'c1' } }] as any),
  },
}));

vi.mock('@/services/commands/history', () => ({
  getCommandHistory: () => ({
    formatForPrompt: vi.fn(() => 'Cmd 1\nCmd 2'),
  }),
}));

const baseState: AppBrainState = {
  manuscript: {
    projectId: 'p1',
    projectTitle: 'Novel',
    chapters: [
      { id: 'c1', title: 'One', content: 'Text 1', order: 0, updatedAt: 0 } as any,
      { id: 'c2', title: 'Two', content: 'Text 2', order: 1, updatedAt: 0 } as any,
    ],
    activeChapterId: 'c1',
    activeArcId: null,
    currentText: 'Current chapter text',
    branches: [{ id: 'b1', name: 'Alt', description: 'alt', createdAt: 0 } as any],
    activeBranchId: 'b1',
    setting: { timePeriod: 'Now', location: 'Here' },
    arcs: [],
  },
  intelligence: {
    hud: {
      situational: {
        tensionLevel: 'medium',
        pacing: 'steady',
        narrativePosition: { sceneIndex: 1, totalScenes: 3, percentComplete: 33 },
        currentScene: { type: 'intro', pov: 'Alice', location: 'Hall', startOffset: 0, endOffset: 10 },
        currentParagraph: { type: 'body', index: 0 },
      },
      context: {
        activeEntities: [
          { id: 'e1', name: 'Alice', type: 'character', mentionCount: 3 } as any,
          { id: 'e2', name: 'Bob', type: 'character', mentionCount: 1 } as any,
        ],
        activeRelationships: [
          { id: 'r1', source: 'e1', target: 'e2', type: 'ally' } as any,
        ],
        openPromises: [
          { id: 'p1', type: 'mystery', description: 'Who is the stranger?' } as any,
        ],
      },
      prioritizedIssues: [{ id: 'i1', description: 'Slow start', severity: 0.8 } as any],
      styleAlerts: ['Watch for repetition'],
      stats: {
        wordCount: 1000,
        readingTime: 5,
        dialoguePercent: 20,
        avgSentenceLength: 12,
      } as any,
    } as any,
    full: {
      structural: { scenes: [{ type: 'intro' }, { type: 'climax' }] } as any,
      cache: null as any,
      chunks: [] as any,
      metadata: null as any,
      issues: [] as any,
    } as any,
    entities: {
      nodes: [
        { id: 'e1', name: 'Alice', type: 'character', aliases: ['Al'], mentionCount: 3 } as any,
        { id: 'p1', name: 'Castle', type: 'place', aliases: [], mentionCount: 1 } as any,
      ],
      edges: [],
    } as any,
    timeline: null as any,
    style: null as any,
    heatmap: null as any,
    lastProcessedAt: 0,
  },
  analysis: {
    result: {
      summary: 'A solid start to the story',
      strengths: ['Strong voice', 'Clear POV'],
      weaknesses: ['Pacing is slow'],
      plotIssues: [
        { issue: 'Slow opening', suggestion: 'Start closer to the inciting incident' },
      ],
    } as any,
    status: {
      pacing: 'complete',
      characters: 'complete',
      plot: 'complete',
      setting: 'idle',
    },
    inlineComments: [{ id: 'c1', text: 'Tighten this', dismissed: false } as any],
  },
  lore: {
    characters: [{ name: 'Alice', bio: 'Hero of the tale', inconsistencies: [] }] as any,
    worldRules: ['Magic is rare'],
    manuscriptIndex: null as any,
  },
  ui: {
    cursor: { position: 10, scene: 'intro', paragraph: 'p1' },
    selection: { start: 0, end: 5, text: 'Hello world, this is a longish selection.' },
    activePanel: 'chat',
    activeView: 'editor',
    isZenMode: true,
    activeHighlight: null,
    microphone: {
      status: 'idle',
      mode: 'text',
      lastTranscript: 'Dictated note here that is somewhat long',
      error: null,
    },
  },
  session: {
    chatHistory: [],
    currentPersona: null,
    pendingToolCalls: [],
    lastAgentAction: {
      type: 'rewrite',
      description: 'Rewrote opening paragraph',
      timestamp: 1,
      success: true,
    },
    isProcessing: false,
  },
};

const minimalState: AppBrainState = {
  ...baseState,
  analysis: { ...baseState.analysis, result: null, inlineComments: [] },
  lore: { characters: [], worldRules: [], manuscriptIndex: null as any },
};

describe('contextBuilder - buildAgentContext', () => {
  it('builds a rich markdown context with manuscript, ui, hud, analysis, lore, events, history and session', () => {
    const ctx = buildAgentContext(baseState);

    expect(ctx).toContain('[MANUSCRIPT STATE]');
    expect(ctx).toContain('Project: Novel');
    expect(ctx).toContain('Active Chapter: "One"');
    expect(ctx).toContain('[CURRENT USER STATE]');
    expect(ctx).toContain('Cursor Position: 10 (intro scene)');
    expect(ctx).toContain('[INTELLIGENCE HUD]');
    expect(ctx).toContain('Tension: MEDIUM');
    expect(ctx).toContain('[ANALYSIS INSIGHTS]');
    expect(ctx).toContain('Summary: A solid start to the story');
    expect(ctx).toContain('[LORE BIBLE]');
    expect(ctx).toContain('Characters (1):');
    expect(ctx).toContain('[RECENT ACTIVITY]');
    expect(ctx).toContain('Evt 1');
    expect(ctx).toContain('[AGENT MEMORY]');
    expect(ctx).toContain('LAST AGENT ACTION');
    expect(ctx).toContain('[RECENT AGENT ACTIONS]');
    expect(ctx).toContain('Cmd 1');
  });

  it('omits optional sections when data is missing', () => {
    const ctx = buildAgentContext(minimalState);

    expect(ctx).toContain('[MANUSCRIPT STATE]');
    expect(ctx).toContain('[CURRENT USER STATE]');
    expect(ctx).not.toContain('[ANALYSIS INSIGHTS]');
    expect(ctx).not.toContain('[LORE BIBLE]');
  });

  it('serializes context as JSON when using the API template', () => {
    const json = buildAgentContext(baseState, undefined, API_CONTEXT_TEMPLATE);
    const parsed = JSON.parse(json) as Array<{ key: string; lines: string[] }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some(section => section.key === 'manuscript')).toBe(true);
  });

  it('renders an XML context when requested', () => {
    const xmlTemplate = { format: 'xml' as const };
    const xml = buildAgentContext(baseState, undefined, xmlTemplate);
    expect(xml).toContain('<section id="manuscript">');
    expect(xml).toContain('<title>MANUSCRIPT STATE</title>');
  });

  it('skips HUD and session data when those sections are absent', () => {
    const stateWithoutHud: AppBrainState = {
      ...baseState,
      intelligence: { ...baseState.intelligence, hud: null },
      session: { ...baseState.session, lastAgentAction: null },
    };

    const ctx = buildAgentContext(stateWithoutHud);
    expect(ctx).not.toContain('[INTELLIGENCE HUD]');
    expect(ctx).not.toContain('LAST AGENT ACTION');
  });

  it('includes voice fingerprint metrics when deep analysis is requested', () => {
    const stateWithVoice: AppBrainState = {
      ...baseState,
      intelligence: {
        ...baseState.intelligence,
        full: {
          ...baseState.intelligence.full,
          voice: {
            profiles: [
              {
                speakerName: 'Seth',
                impression: 'Confident',
                metrics: {
                  latinateRatio: 0.72,
                  contractionRatio: 0.18,
                },
              },
            ],
          },
        } as any,
      },
    };

    const ctx = buildAgentContext(stateWithVoice, { deepAnalysis: true });
    expect(ctx).toContain('DEEP ANALYSIS: VOICE FINGERPRINTS');
    expect(ctx).toContain('Seth');
  });
});

describe('contextBuilder - coverage gaps', () => {
  it('handles alternate UI states (zen mode off, no scene, no transcript, zen off)', () => {
     const state: AppBrainState = {
        ...baseState,
        manuscript: {
           ...baseState.manuscript,
           activeChapterId: 'non-existent', // Active chapter not found
           activeBranchId: null, // On main
        },
        ui: {
           ...baseState.ui,
           isZenMode: false,
           cursor: { position: 5, scene: null as any, paragraph: null as any },
           microphone: { status: 'listening', lastTranscript: null, mode: 'voice', error: null },
           selection: null, // No selection
        },
        intelligence: {
           ...baseState.intelligence,
           hud: {
              ...baseState.intelligence.hud,
              prioritizedIssues: [
                 { id: 'i2', description: 'Med', severity: 0.5 } as any,
                 { id: 'i3', description: 'Low', severity: 0.2 } as any
              ],
              situational: {
                 ...baseState.intelligence.hud!.situational,
                 currentScene: null, // No scene info in HUD
              },
              context: {
                 activeEntities: [],
                 activeRelationships: [],
                 openPromises: [],
                 recentEvents: [],
              },
              styleAlerts: [],
           }
        }
     };

     const ctx = buildAgentContext(state);
     
     expect(ctx).not.toContain('Active Chapter: "'); // Chapter active but not found in list?
     expect(ctx).toContain('(on main)');
     expect(ctx).not.toContain('(Zen Mode)');
     expect(ctx).not.toContain('scene)'); // Cursor scene
     expect(ctx).not.toContain('(heard:');
     expect(ctx).toContain('Selection: None');
     
     expect(ctx).toContain('🟡 Med');
     expect(ctx).toContain('🟢 Low');
  });

  it('handles partial analysis results', () => {
     const state: AppBrainState = {
        ...baseState,
        analysis: {
           ...baseState.analysis,
           result: {
              summary: null,
              strengths: [],
              weaknesses: [],
              plotIssues: [],
           } as any
        }
     };
     
     const ctx = buildAgentContext(state);
     expect(ctx).not.toContain('[ANALYSIS INSIGHTS]');
     // Section omitted because all fields are empty
     expect(ctx).not.toContain('Summary:');
     expect(ctx).not.toContain('Strengths:');
  });

  it('handles lore inconsistencies', () => {
     const state: AppBrainState = {
        ...baseState,
        lore: {
           ...baseState.lore,
           characters: [
              { name: 'Bob', bio: 'Bio', inconsistencies: ['Age mismatch'] } as any
           ]
        }
     };
     
     const ctx = buildAgentContext(state);
     expect(ctx).toContain('⚠️ Has 1 inconsistencies');
  });

  it('truncates long selection and microphone transcript previews and omits empty activity/history', async () => {
    vi.mocked(eventBus.formatRecentEventsForAI).mockReturnValueOnce('');
    const historyMod = await import('@/services/commands/history');
    vi.spyOn(historyMod, 'getCommandHistory').mockReturnValueOnce({
      formatForPrompt: vi.fn(() => ''),
    } as any);

    const longSelection = 's'.repeat(160);
    const longTranscript = 't'.repeat(90);

    const state: AppBrainState = {
      ...baseState,
      manuscript: {
        ...baseState.manuscript,
        branches: [],
        activeBranchId: null,
        setting: null as any,
      },
      ui: {
        ...baseState.ui,
        selection: { start: 1, end: 2, text: longSelection } as any,
        microphone: { ...baseState.ui.microphone, lastTranscript: longTranscript } as any,
      },
      intelligence: {
        ...baseState.intelligence,
        hud: {
          ...baseState.intelligence.hud!,
          context: {
            ...baseState.intelligence.hud!.context,
            activeRelationships: [{ id: 'r1', source: 'missing', target: 'missing', type: 'ally' } as any],
          },
        } as any,
      },
      session: { ...baseState.session, lastAgentAction: null },
    };

    const ctx = buildAgentContext(state);
    expect(ctx).toContain('Selection: "');
    expect(ctx).toContain('(heard: "');
    expect(ctx).toContain('...'); // selection + transcript truncation markers
    expect(ctx).not.toContain('[RECENT ACTIVITY]');
    expect(ctx).not.toContain('[RECENT AGENT ACTIONS]');
  });
});

describe('contextBuilder - buildAgentContextWithMemory', () => {
  it('returns base context unchanged when projectId is null', async () => {
    const baseCtx = buildAgentContext(baseState);
    const result = await buildAgentContextWithMemory(baseState, null);
    expect(result).toBe(baseCtx);
  });

  it('replaces memory placeholder with formatted memories and goals in markdown', async () => {
    const getMemoriesForContext = vi
      .spyOn(memoryService, 'getMemoriesForContext')
      .mockResolvedValueOnce({ author: [], project: [] } as any);
    const getActiveGoals = vi
      .spyOn(memoryService, 'getActiveGoals')
      .mockResolvedValueOnce([{ title: 'Finish draft' }] as any);
    const formatMemoriesForPrompt = vi
      .spyOn(memoryService, 'formatMemoriesForPrompt')
      .mockReturnValue('[MEMS]');
    const formatGoalsForPrompt = vi
      .spyOn(memoryService, 'formatGoalsForPrompt')
      .mockReturnValue('[GOALS]\n- Finish draft');

    const result = await buildAgentContextWithMemory(baseState, 'p1', CHAT_CONTEXT_TEMPLATE);

    expect(getMemoriesForContext).toHaveBeenCalledWith('p1', { limit: 25 });
    expect(getActiveGoals).toHaveBeenCalledWith('p1');
    expect(result).toContain('[AGENT MEMORY]');
    expect(result).toContain('[MEMS]');
    expect(result).toContain('[GOALS]');
  });

  it('injects memory into JSON template and falls back when parsing fails', async () => {
    const getMemoriesForContext = vi
      .spyOn(memoryService, 'getMemoriesForContext')
      .mockResolvedValue({ author: [], project: [] } as any);
    const getActiveGoals = vi
      .spyOn(memoryService, 'getActiveGoals')
      .mockResolvedValue([] as any);
    const formatMemoriesForPrompt = vi
      .spyOn(memoryService, 'formatMemoriesForPrompt')
      .mockReturnValue('JSON_MEM');
    const formatGoalsForPrompt = vi
      .spyOn(memoryService, 'formatGoalsForPrompt')
      .mockReturnValue('G1\nG2');

    const ctxJson = await buildAgentContextWithMemory(baseState, 'p1', API_CONTEXT_TEMPLATE);
    const parsed = JSON.parse(ctxJson) as Array<{ key: string; lines: string[] }>;
    const memorySection = parsed.find(s => s.key === 'agent_memory');
    expect(memorySection?.lines[0]).toBe('JSON_MEM');
    expect(memorySection?.lines.join('\n')).toContain('G1');

    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new Error('parse failure');
    });

    const ctxJsonFallback = await buildAgentContextWithMemory(baseState, 'p1', API_CONTEXT_TEMPLATE);
    expect(parseSpy).toHaveBeenCalled();
    expect(ctxJsonFallback).toContain('"key": "agent_memory"');
    expect(ctxJsonFallback).toContain('JSON_MEM');

    parseSpy.mockRestore();
  });

  it('injects memory into XML template', async () => {
    vi.spyOn(memoryService, 'getMemoriesForContext').mockResolvedValueOnce({ author: [], project: [] } as any);
    vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValueOnce([] as any);
    vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValueOnce('XML_MEM');
    vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValueOnce('');

    const xmlTemplate = { format: 'xml' as const };
    const baseXml = buildAgentContext(baseState, undefined, xmlTemplate);
    const withMem = await buildAgentContextWithMemory(baseState, 'p1', xmlTemplate);

    expect(baseXml).not.toContain('XML_MEM');
    expect(withMem).toContain('<section id="agent_memory">');
    expect(withMem).toContain('<section id="agent_memory">');
    expect(withMem).toContain('XML_MEM');
  });

  it('handles memory service failures gracefully by leaving placeholder or warning', async () => {
    vi.spyOn(memoryService, 'getMemoriesForContext').mockRejectedValueOnce(new Error('Memory DB Fail'));
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await buildAgentContextWithMemory(baseState, 'p1', CHAT_CONTEXT_TEMPLATE);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load memory'), expect.any(Error));
    // Should still return base context with placeholder or similar partial result
    expect(result).not.toBe('');
    expect(result).toContain(baseState.manuscript.projectTitle);

    consoleSpy.mockRestore();
  });
});

describe('contextBuilder - derived contexts and builder', () => {
  it('builds compressed context with key markers', () => {
    const ctx = buildCompressedContext(baseState);
    expect(ctx).toContain('ch:One');
    expect(ctx).toContain('pos:10');
    expect(ctx).toContain('mic:idle');
    expect(ctx).toContain('tension:medium');
  });

  it('builds navigation context with chapters, characters, and scene types', () => {
    const ctx = buildNavigationContext(baseState);
    expect(ctx).toContain('[NAVIGATION CONTEXT]');
    expect(ctx).toContain('Chapters:');
    expect(ctx).toContain('→ 1. "One"');
    expect(ctx).toContain('Characters (searchable):');
    expect(ctx).toContain('Alice');
    expect(ctx).toContain('Scene types in chapter: intro, climax');
  });

  it('builds editing context with selection, style, and branch info', () => {
    const ctx = buildEditingContext(baseState);
    expect(ctx).toContain('[EDITING CONTEXT]');
    expect(ctx).toContain('Current chapter: "One"');
    expect(ctx).toContain('Text length:');
    expect(ctx).toContain('SELECTED TEXT:');
    expect(ctx).toContain('STYLE CONTEXT:');
    expect(ctx).toContain('On branch: "Alt"');
  });

  it('omits HUD-specific markers in compressed context when HUD is missing', () => {
    const ctx = buildCompressedContext({
      ...baseState,
      intelligence: { ...baseState.intelligence, hud: null },
    } as AppBrainState);

    expect(ctx).toContain('ch:One');
    expect(ctx).not.toContain('tension:');
    expect(ctx).not.toContain('words:');
  });

  it('builds navigation context even without intelligence entities or structural data', () => {
    const ctx = buildNavigationContext({
      ...baseState,
      intelligence: {
        ...baseState.intelligence,
        entities: null as any,
        full: { ...baseState.intelligence.full, structural: undefined },
      },
    } as AppBrainState);

    expect(ctx).toContain('[NAVIGATION CONTEXT]');
    expect(ctx).not.toContain('Characters (searchable):');
    expect(ctx).not.toContain('Scene types in chapter');
  });

  it('gracefully builds editing context without selection or branch info', () => {
    const ctx = buildEditingContext({
      ...baseState,
      manuscript: { ...baseState.manuscript, activeBranchId: null },
      ui: { ...baseState.ui, selection: null },
    } as AppBrainState);

    expect(ctx).not.toContain('SELECTED TEXT:');
    expect(ctx).not.toContain('On branch:');
  });

  it('creates a context builder bound to getState', async () => {
    const getState = vi.fn(() => baseState);
    const builder = createContextBuilder(getState);

    const agentCtx = builder.getAgentContext();
    expect(agentCtx).toContain('Project: Novel');

    const compressed = builder.getCompressedContext();
    expect(compressed).toContain('ch:One');

    const nav = builder.getNavigationContext();
    expect(nav).toContain('Chapters:');

    const edit = builder.getEditingContext();
    expect(edit).toContain('[EDITING CONTEXT]');

    const events = builder.getRecentEvents();
    expect(Array.isArray(events)).toBe(true);

    const memSpy = vi
      .spyOn(memoryService, 'getMemoriesForContext')
      .mockResolvedValueOnce({ author: [], project: [] } as any);
    vi.spyOn(memoryService, 'getActiveGoals').mockResolvedValueOnce([] as any);
    vi.spyOn(memoryService, 'formatMemoriesForPrompt').mockReturnValueOnce('X');
    vi.spyOn(memoryService, 'formatGoalsForPrompt').mockReturnValueOnce('');

    const withMem = await builder.getAgentContextWithMemory('p1');
    expect(withMem).toContain('AGENT MEMORY');
    expect(memSpy).toHaveBeenCalled();
  });
});

describe('contextBuilder - getSmartAgentContext', () => {
  it('builds relevance from state when not provided and calls adaptive context helpers', async () => {
    const selectProfileSpy = vi
      .spyOn(adaptiveContext, 'selectContextProfile')
      .mockReturnValue({ id: 'default-profile' } as any);
    const getBudgetSpy = vi
      .spyOn(adaptiveContext, 'getContextBudgetForModel')
      .mockReturnValue({ totalTokens: 1000 } as any);
    const buildAdaptiveSpy = vi
      .spyOn(adaptiveContext, 'buildAdaptiveContext')
      .mockResolvedValue({ context: 'CTX', tokenCount: 123 } as any);

    const result = await getSmartAgentContext(baseState, 'p1', { mode: 'text', queryType: 'editing' });

    expect(selectProfileSpy).toHaveBeenCalledWith({
      mode: 'text',
      hasSelection: true,
      queryType: 'editing',
    });
    expect(getBudgetSpy).toHaveBeenCalledWith('agent', { id: 'default-profile' });

    expect(buildAdaptiveSpy).toHaveBeenCalledTimes(1);
    const [, , callOpts] = buildAdaptiveSpy.mock.calls[0];
    expect(callOpts.budget).toEqual({ totalTokens: 1000 });
    expect(callOpts.relevance.activeChapterId).toBe('c1');
    expect(callOpts.relevance.activeEntityNames).toEqual(['Alice', 'Bob']);
    expect(callOpts.relevance.selectionKeywords.length).toBeGreaterThan(0);

    expect(result.context).toBe('CTX');
  });

  it('honors explicit relevance overrides and model role', async () => {
    vi.spyOn(adaptiveContext, 'selectContextProfile').mockReturnValue({ id: 'p' } as any);
    vi.spyOn(adaptiveContext, 'getContextBudgetForModel').mockReturnValue({ totalTokens: 500 } as any);
    const buildAdaptiveSpy = vi
      .spyOn(adaptiveContext, 'buildAdaptiveContext')
      .mockResolvedValue({ context: 'CTX2', tokenCount: 10 } as any);

    const result = await getSmartAgentContext(baseState, 'p1', {
      modelRole: 'analysis',
      profile: { id: 'custom' } as any,
      relevance: {
        activeEntityNames: ['Custom'],
        selectionKeywords: ['alpha'],
        activeChapterId: 'cx',
      },
    });

    const [, , callOpts] = buildAdaptiveSpy.mock.calls[0];
    expect(callOpts.relevance).toEqual({
      activeEntityNames: ['Custom'],
      selectionKeywords: ['alpha'],
      activeChapterId: 'cx',
    });

    expect(result.context).toBe('CTX2');
  });
});
