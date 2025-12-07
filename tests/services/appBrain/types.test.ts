import { describe, it, expect } from 'vitest';
import type {
  ManuscriptState,
  IntelligenceState,
  AnalysisState,
  LoreState,
  UIState,
  MicrophoneState,
  SessionState,
  PendingToolCall,
  AgentAction,
  AppBrainState,
  AppEventBase,
  AppEvent,
  EventHandler,
  NavigateToTextParams,
  UpdateManuscriptParams,
  RewriteSelectionParams,
  AppBrainActions,
  AgentContextOptions,
  AppBrainContext,
  ChapterIssueSummary,
  WatchedEntitySummary,
} from '@/services/appBrain/types';

describe('services/appBrain/types', () => {
  describe('ManuscriptState', () => {
    it('can construct a valid ManuscriptState object', () => {
      const state: ManuscriptState = {
        projectId: 'proj-1',
        projectTitle: 'My Novel',
        chapters: [],
        activeChapterId: null,
        currentText: '',
        branches: [],
        activeBranchId: null,
      };
      expect(state.projectId).toBe('proj-1');
      expect(state.chapters).toEqual([]);
    });

    it('supports optional fields', () => {
      const state: ManuscriptState = {
        projectId: 'proj-2',
        projectTitle: 'Story',
        chapters: [],
        activeChapterId: 'ch-1',
        activeArcId: 'arc-1',
        currentText: 'Hello world',
        branches: [],
        activeBranchId: 'br-1',
        setting: { timePeriod: '1920s', location: 'Paris' },
        arcs: [{ id: 'arc-1', title: 'Act One' }],
      };
      expect(state.setting?.timePeriod).toBe('1920s');
      expect(state.arcs).toHaveLength(1);
    });
  });

  describe('IntelligenceState', () => {
    it('can construct a valid IntelligenceState object', () => {
      const state: IntelligenceState = {
        hud: null,
        full: null,
        entities: null,
        timeline: null,
        style: null,
        heatmap: null,
        lastProcessedAt: Date.now(),
      };
      expect(state.lastProcessedAt).toBeGreaterThan(0);
    });
  });

  describe('AnalysisState', () => {
    it('can construct a valid AnalysisState object', () => {
      const state: AnalysisState = {
        result: null,
        status: {
          pacing: 'idle',
          characters: 'loading',
          plot: 'complete',
          setting: 'error',
        },
        inlineComments: [],
      };
      expect(state.status.pacing).toBe('idle');
      expect(state.status.plot).toBe('complete');
    });
  });

  describe('LoreState', () => {
    it('can construct a valid LoreState object', () => {
      const state: LoreState = {
        characters: [],
        worldRules: ['Magic is forbidden'],
        manuscriptIndex: null,
      };
      expect(state.worldRules).toContain('Magic is forbidden');
    });
  });

  describe('UIState', () => {
    it('can construct a valid UIState object', () => {
      const microphone: MicrophoneState = {
        status: 'idle',
        mode: 'text',
        lastTranscript: null,
        error: null,
      };
      const state: UIState = {
        cursor: { position: 100, scene: 'scene-1', paragraph: 'p-1' },
        selection: { start: 10, end: 20, text: 'selected' },
        activePanel: 'editor',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone,
      };
      expect(state.cursor.position).toBe(100);
      expect(state.selection?.text).toBe('selected');
    });
  });

  describe('SessionState', () => {
    it('can construct a valid SessionState object', () => {
      const pendingCall: PendingToolCall = {
        id: 'call-1',
        name: 'navigate',
        args: { query: 'test' },
        status: 'pending',
      };
      const action: AgentAction = {
        type: 'NAVIGATE',
        description: 'Navigated to chapter',
        timestamp: Date.now(),
        success: true,
      };
      const state: SessionState = {
        chatHistory: [],
        currentPersona: null,
        pendingToolCalls: [pendingCall],
        lastAgentAction: action,
        isProcessing: false,
      };
      expect(state.pendingToolCalls).toHaveLength(1);
      expect(state.lastAgentAction?.success).toBe(true);
    });
  });

  describe('AppBrainState', () => {
    it('can construct a valid AppBrainState object', () => {
      const state: AppBrainState = {
        manuscript: {
          projectId: null,
          projectTitle: '',
          chapters: [],
          activeChapterId: null,
          currentText: '',
          branches: [],
          activeBranchId: null,
        },
        intelligence: {
          hud: null,
          full: null,
          entities: null,
          timeline: null,
          style: null,
          heatmap: null,
          lastProcessedAt: 0,
        },
        analysis: {
          result: null,
          status: { pacing: 'idle', characters: 'idle', plot: 'idle', setting: 'idle' },
          inlineComments: [],
        },
        lore: {
          characters: [],
          worldRules: [],
          manuscriptIndex: null,
        },
        ui: {
          cursor: { position: 0, scene: null, paragraph: null },
          selection: null,
          activePanel: 'home',
          activeView: 'editor',
          isZenMode: false,
          activeHighlight: null,
          microphone: { status: 'idle', mode: 'text', lastTranscript: null, error: null },
        },
        session: {
          chatHistory: [],
          currentPersona: null,
          pendingToolCalls: [],
          lastAgentAction: null,
          isProcessing: false,
        },
      };
      expect(state.manuscript).toBeDefined();
      expect(state.intelligence).toBeDefined();
      expect(state.analysis).toBeDefined();
      expect(state.lore).toBeDefined();
      expect(state.ui).toBeDefined();
      expect(state.session).toBeDefined();
    });
  });

  describe('AppEvent types', () => {
    it('can construct various AppEvent types', () => {
      const selectionEvent: AppEvent = {
        timestamp: Date.now(),
        type: 'SELECTION_CHANGED',
        payload: { text: 'hello', start: 0, end: 5 },
      };
      expect(selectionEvent.type).toBe('SELECTION_CHANGED');

      const cursorEvent: AppEvent = {
        timestamp: Date.now(),
        type: 'CURSOR_MOVED',
        payload: { position: 100, scene: 'scene-1' },
      };
      expect(cursorEvent.type).toBe('CURSOR_MOVED');

      const chapterChanged: AppEvent = {
        timestamp: Date.now(),
        type: 'CHAPTER_CHANGED',
        payload: {
          projectId: 'proj-1',
          chapterId: 'ch-1',
          title: 'Chapter One',
          issues: [{ description: 'Plot hole', severity: 'warning' }],
          watchedEntities: [{ name: 'Sarah', reason: 'Main character', priority: 'high' }],
        },
      };
      expect(chapterChanged.type).toBe('CHAPTER_CHANGED');
    });

    it('supports all event types', () => {
      const eventTypes: AppEvent['type'][] = [
        'SELECTION_CHANGED',
        'CURSOR_MOVED',
        'CHAPTER_SWITCHED',
        'CHAPTER_CHANGED',
        'TEXT_CHANGED',
        'ANALYSIS_COMPLETED',
        'EDIT_MADE',
        'COMMENT_ADDED',
        'INTELLIGENCE_UPDATED',
        'TOOL_EXECUTED',
        'NAVIGATION_REQUESTED',
        'BRANCH_SWITCHED',
        'ANALYSIS_COMPLETE',
        'MEMORY_CREATED',
        'PANEL_SWITCHED',
        'LORE_UPDATED',
        'DOCUMENT_SAVED',
        'ZEN_MODE_TOGGLED',
      ];
      expect(eventTypes).toHaveLength(18);
    });
  });

  describe('Action parameter types', () => {
    it('can construct NavigateToTextParams', () => {
      const params: NavigateToTextParams = {
        query: 'Find Sarah',
        searchType: 'fuzzy',
        character: 'Sarah',
        chapter: 'ch-1',
      };
      expect(params.query).toBe('Find Sarah');
    });

    it('can construct UpdateManuscriptParams', () => {
      const params: UpdateManuscriptParams = {
        searchText: 'old text',
        replacementText: 'new text',
        description: 'Fixed typo',
      };
      expect(params.description).toBe('Fixed typo');
    });

    it('can construct RewriteSelectionParams', () => {
      const params: RewriteSelectionParams = {
        mode: 'tone_shift',
        targetTone: 'formal',
      };
      expect(params.mode).toBe('tone_shift');
    });
  });

  describe('ChapterIssueSummary and WatchedEntitySummary', () => {
    it('can construct ChapterIssueSummary', () => {
      const issue: ChapterIssueSummary = {
        description: 'Character inconsistency',
        severity: 'error',
      };
      expect(issue.severity).toBe('error');
    });

    it('can construct WatchedEntitySummary', () => {
      const entity: WatchedEntitySummary = {
        name: 'Marcus',
        reason: 'Antagonist',
        priority: 'medium',
      };
      expect(entity.priority).toBe('medium');
    });
  });

  describe('Context and Actions interfaces', () => {
    it('AgentContextOptions has expected shape', () => {
      const options: AgentContextOptions = {
        deepAnalysis: true,
      };
      expect(options.deepAnalysis).toBe(true);
    });

    it('EventHandler type is callable', () => {
      const handler: EventHandler = (event) => {
        expect(event.timestamp).toBeDefined();
      };
      handler({ timestamp: Date.now(), type: 'CURSOR_MOVED', payload: { position: 0, scene: null } });
    });
  });
});
