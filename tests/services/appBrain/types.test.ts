import { describe, it, expect } from 'vitest';
import type {
  AppBrainState,
  AppEvent,
  MicrophoneState,
  ManuscriptState,
  IntelligenceState,
} from '@/services/appBrain/types';

const baseState: AppBrainState = {
  manuscript: {
    projectId: 'p1',
    projectTitle: 'Title',
    chapters: [],
    activeChapterId: null,
    currentText: '',
    branches: [],
    activeBranchId: null,
  } as ManuscriptState,
  intelligence: {
    hud: null,
    full: null,
    entities: null,
    timeline: null,
    style: null,
    heatmap: null,
    lastProcessedAt: Date.now(),
  } as IntelligenceState,
  analysis: {
    result: null,
    status: { pacing: 'idle', characters: 'idle', plot: 'idle', setting: 'idle' },
    inlineComments: [],
  },
  lore: { characters: [], worldRules: [], manuscriptIndex: null },
  ui: {
    cursor: { position: 0, scene: null, paragraph: null },
    selection: null,
    activePanel: 'none',
    activeView: 'editor',
    isZenMode: false,
    activeHighlight: null,
    microphone: { status: 'idle', mode: 'text', lastTranscript: null, error: null } as MicrophoneState,
  },
  session: {
    chatHistory: [],
    currentPersona: null,
    pendingToolCalls: [],
    lastAgentAction: null,
    isProcessing: false,
  },
};

describe('appBrain types', () => {
  it('constructs valid AppBrainState objects', () => {
    expect(baseState.manuscript.projectTitle).toBe('Title');
    expect(baseState.ui.microphone.mode).toBe('text');
  });

  it('supports discriminated AppEvent variants', () => {
    const events: AppEvent[] = [
      { timestamp: 1, type: 'SELECTION_CHANGED', payload: { text: 'x', start: 0, end: 1 } },
      { timestamp: 2, type: 'CURSOR_MOVED', payload: { position: 5, scene: null } },
      { timestamp: 3, type: 'BRANCH_SWITCHED', payload: { branchId: 'b1', name: 'branch' } },
      { timestamp: 4, type: 'PROACTIVE_SUGGESTION_ACTION', payload: { suggestionId: 's1', action: 'applied', suggestionCategory: 'plot' as any } },
    ];

    const descriptions = events.map((event) => {
      switch (event.type) {
        case 'SELECTION_CHANGED':
          return event.payload.text;
        case 'CURSOR_MOVED':
          return String(event.payload.position);
        case 'BRANCH_SWITCHED':
          return event.payload.branchId;
        case 'PROACTIVE_SUGGESTION_ACTION':
          return event.payload.action;
        default:
          return 'unknown';
      }
    });

    expect(descriptions).toEqual(['x', '5', 'b1', 'applied']);
  });
});
