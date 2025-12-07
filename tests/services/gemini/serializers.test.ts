import { describe, it, expect } from 'vitest';
import {
  buildInterviewInstruction,
  buildIntelligenceContext,
  PromptBuilder,
  buildAgentMessageContext,
} from '@/services/gemini/serializers';
import type { CharacterProfile } from '@/types';
import type { ManuscriptHUD } from '@/types/intelligence';
import type { MicrophoneState, UIState, AppEvent } from '@/services/appBrain/types';

describe('serializers', () => {
  describe('buildInterviewInstruction', () => {
    it('builds interview block with character info', () => {
      const character: CharacterProfile = {
        name: 'Sarah',
        bio: 'A detective in 1920s Paris',
        arc: 'From cynical to hopeful',
        arcStages: [],
        voiceTraits: 'Dry humor, formal speech',
        relationships: [
          { name: 'Marcus', type: 'rival', dynamic: 'Reluctant respect' },
        ],
        plotThreads: ['The missing painting', 'Her past in London'],
        developmentSuggestion: 'Show more vulnerability',
        inconsistencies: [],
      };

      const baseInstruction = 'You are an AI assistant. [FULL MANUSCRIPT CONTEXT]';
      const result = buildInterviewInstruction(baseInstruction, character);

      expect(result).toContain('[INTERVIEW MODE: Sarah]');
      expect(result).toContain('You are Sarah');
      expect(result).toContain('A detective in 1920s Paris');
      expect(result).toContain('From cynical to hopeful');
      expect(result).toContain('Dry humor, formal speech');
      expect(result).toContain('Marcus (rival): Reluctant respect');
      expect(result).toContain('The missing painting');
      expect(result).toContain('[FULL MANUSCRIPT CONTEXT]');
    });

    it('handles character with no relationships or plot threads', () => {
      const character: CharacterProfile = {
        name: 'Minor Character',
        bio: 'A shopkeeper',
        arc: '',
        arcStages: [],
        voiceTraits: '',
        relationships: [],
        plotThreads: [],
        developmentSuggestion: '',
        inconsistencies: [],
      };

      const result = buildInterviewInstruction('[FULL MANUSCRIPT CONTEXT]', character);

      expect(result).toContain('- None noted.');
    });

    it('uses default voice when voiceTraits is empty', () => {
      const character: CharacterProfile = {
        name: 'Test',
        bio: 'Bio',
        arc: 'Arc',
        arcStages: [],
        voiceTraits: '',
        relationships: [],
        plotThreads: [],
        developmentSuggestion: '',
        inconsistencies: [],
      };

      const result = buildInterviewInstruction('[FULL MANUSCRIPT CONTEXT]', character);

      expect(result).toContain('Voice: Consistent with bio');
    });
  });

  describe('buildIntelligenceContext', () => {
    const createMinimalHUD = (): ManuscriptHUD => ({
      situational: {
        currentScene: null,
        currentParagraph: null,
        narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
        tensionLevel: 'low',
        pacing: 'slow',
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
      stats: { wordCount: 0, readingTime: 0, dialoguePercent: 0, avgSentenceLength: 0 },
      lastFullProcess: Date.now(),
      processingTier: 'instant',
    });

    it('builds context from minimal HUD', () => {
      const hud = createMinimalHUD();
      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[INTELLIGENCE HUD');
      expect(result).toContain('[CURRENT POSITION]');
      expect(result).toContain('Pacing: slow');
      expect(result).toContain('[MANUSCRIPT METRICS]');
    });

    it('includes scene information when present', () => {
      const hud = createMinimalHUD();
      hud.situational.currentScene = {
        id: 'scene-1',
        startOffset: 0,
        endOffset: 500,
        type: 'dialogue',
        pov: 'Sarah',
        location: 'Cafe',
        timeMarker: null,
        tension: 0.6,
        dialogueRatio: 0.7,
      };
      hud.situational.tensionLevel = 'high';
      hud.situational.narrativePosition = { sceneIndex: 3, totalScenes: 10, percentComplete: 30 };

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('Scene Type: dialogue');
      expect(result).toContain('POV Character: Sarah');
      expect(result).toContain('Location: Cafe');
      expect(result).toContain('Tension: HIGH');
      expect(result).toContain('Dialogue Ratio: 70%');
      expect(result).toContain('Scene 3 of 10');
    });

    it('includes active entities', () => {
      const hud = createMinimalHUD();
      hud.context.activeEntities = [
        {
          id: 'ent-1',
          name: 'Sarah',
          type: 'character',
          aliases: ['the detective', 'S'],
          firstMention: 0,
          mentionCount: 15,
          mentions: [],
          attributes: {},
        },
      ];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[ACTIVE CHARACTERS/ENTITIES]');
      expect(result).toContain('Sarah (character) - 15 mentions');
      expect(result).toContain('[aliases: the detective, S]');
    });

    it('includes active relationships', () => {
      const hud = createMinimalHUD();
      hud.context.activeEntities = [
        { id: 'e1', name: 'Sarah', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
        { id: 'e2', name: 'Marcus', type: 'character', aliases: [], firstMention: 0, mentionCount: 1, mentions: [], attributes: {} },
      ];
      hud.context.activeRelationships = [
        { id: 'r1', source: 'e1', target: 'e2', type: 'interacts', coOccurrences: 5, sentiment: 0.3, chapters: [], evidence: [] },
      ];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[KEY RELATIONSHIPS IN SCENE]');
      expect(result).toContain('Sarah ←interacts→ Marcus (5 interactions)');
    });

    it('includes open promises', () => {
      const hud = createMinimalHUD();
      hud.context.openPromises = [
        {
          id: 'p1',
          type: 'foreshadowing',
          description: 'The locked door that was never explained',
          quote: 'The door remained locked',
          offset: 100,
          chapterId: 'ch-1',
          resolved: false,
        },
      ];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[OPEN PLOT THREADS');
      expect(result).toContain('[FORESHADOWING]');
    });

    it('includes recent events', () => {
      const hud = createMinimalHUD();
      hud.context.recentEvents = [
        {
          id: 'evt-1',
          description: 'Sarah discovered the letter',
          offset: 200,
          chapterId: 'ch-1',
          temporalMarker: 'that evening',
          relativePosition: 'after',
          dependsOn: [],
        },
      ];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[RECENT NARRATIVE EVENTS]');
      expect(result).toContain('Sarah discovered the letter');
      expect(result).toContain('(that evening)');
    });

    it('includes style alerts', () => {
      const hud = createMinimalHUD();
      hud.styleAlerts = ['Too many adverbs', 'Passive voice overuse'];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[STYLE ALERTS]');
      expect(result).toContain('Too many adverbs');
    });

    it('includes prioritized issues with severity icons', () => {
      const hud = createMinimalHUD();
      hud.prioritizedIssues = [
        { type: 'pacing_slow', description: 'Slow pacing in middle section', offset: 500, severity: 0.8 },
        { type: 'dialogue_heavy', description: 'Too much dialogue', offset: 600, severity: 0.5 },
        { type: 'filter_words', description: 'Filter words present', offset: 700, severity: 0.2 },
      ];

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('[PRIORITY ISSUES');
      expect(result).toContain('🔴'); // High severity
      expect(result).toContain('🟡'); // Medium severity
      expect(result).toContain('🟢'); // Low severity
    });

    it('includes manuscript metrics', () => {
      const hud = createMinimalHUD();
      hud.stats = {
        wordCount: 5000,
        readingTime: 20,
        dialoguePercent: 35,
        avgSentenceLength: 18,
      };

      const result = buildIntelligenceContext(hud);

      expect(result).toContain('Words: 5,000');
      expect(result).toContain('Reading: ~20 min');
      expect(result).toContain('Dialogue: 35%');
      expect(result).toContain('Avg Sentence: 18 words');
    });
  });

  describe('PromptBuilder', () => {
    it('builds basic prompt from template', () => {
      const template = 'Hello {{INTENSITY_MODIFIER}} {{LORE_CONTEXT}} {{ANALYSIS_CONTEXT}} {{MEMORY_CONTEXT}} {{FULL_MANUSCRIPT}}';
      const builder = new PromptBuilder(template);

      const result = builder.build();

      expect(result).not.toContain('{{');
      expect(result).toContain('No manuscript content loaded.');
    });

    it('chains setIntensity', () => {
      const template = '{{INTENSITY_MODIFIER}}';
      const result = new PromptBuilder(template)
        .setIntensity('Be very critical')
        .build();

      expect(result).toContain('Be very critical');
    });

    it('adds lore context when lore provided', () => {
      const template = '{{LORE_CONTEXT}}';
      const lore = {
        characters: [
          {
            name: 'Sarah',
            bio: 'A detective',
            arc: 'Growth arc',
            developmentSuggestion: 'More vulnerability',
            inconsistencies: [{ issue: 'Eye color changes' }],
          },
        ],
        worldRules: ['Magic is forbidden', 'Steam power is common'],
      };

      const result = new PromptBuilder(template)
        .addLore(lore as any)
        .build();

      expect(result).toContain('[LORE BIBLE');
      expect(result).toContain('Sarah');
      expect(result).toContain('Magic is forbidden');
    });

    it('handles undefined lore gracefully', () => {
      const template = '{{LORE_CONTEXT}}';
      const result = new PromptBuilder(template)
        .addLore(undefined)
        .build();

      expect(result).not.toContain('CHARACTERS');
    });

    it('adds analysis context when analysis provided', () => {
      const template = '{{ANALYSIS_CONTEXT}}';
      const analysis = {
        summary: 'Well-paced thriller',
        strengths: ['Strong dialogue', 'Good pacing'],
        weaknesses: ['Weak ending'],
        plotIssues: [{ issue: 'Plot hole in act 2', suggestion: 'Add explanation' }],
        characters: [{ name: 'Sarah', arc: 'Detective arc', developmentSuggestion: 'More depth' }],
      };

      const result = new PromptBuilder(template)
        .addAnalysis(analysis as any)
        .build();

      expect(result).toContain('[DEEP ANALYSIS');
      expect(result).toContain('Well-paced thriller');
      expect(result).toContain('Strong dialogue');
    });

    it('adds voice fingerprint in deep analysis mode', () => {
      const template = '{{ANALYSIS_CONTEXT}}';
      const analysis = {
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        plotIssues: [],
        characters: [],
      };
      const voiceFingerprint = {
        profiles: {
          sarah: {
            speakerName: 'Sarah',
            metrics: { latinateRatio: 0.3, contractionRatio: 0.2 },
            impression: 'Formal and measured',
          },
        },
      };

      const result = new PromptBuilder(template)
        .addAnalysis(analysis as any, voiceFingerprint as any, true)
        .build();

      expect(result).toContain('[DEEP ANALYSIS: VOICE FINGERPRINTS]');
      expect(result).toContain('Sarah: Formal and measured');
    });

    it('adds context with all options', () => {
      const template = '{{MEMORY_CONTEXT}} {{FULL_MANUSCRIPT}}';
      const hud: ManuscriptHUD = {
        situational: {
          currentScene: null,
          currentParagraph: null,
          narrativePosition: { sceneIndex: 0, totalScenes: 0, percentComplete: 0 },
          tensionLevel: 'low',
          pacing: 'slow',
        },
        context: { activeEntities: [], activeRelationships: [], openPromises: [], recentEvents: [] },
        styleAlerts: [],
        prioritizedIssues: [],
        recentChanges: [],
        stats: { wordCount: 100, readingTime: 1, dialoguePercent: 20, avgSentenceLength: 15 },
        lastFullProcess: Date.now(),
        processingTier: 'instant',
      };

      const result = new PromptBuilder(template)
        .addContext({
          fullManuscriptContext: 'Chapter 1: The Beginning...',
          memoryContext: 'Sarah likes tea',
          defaultMemoryContext: 'No memories',
          experienceModifier: 'Be helpful',
          autonomyModifier: 'Act autonomously',
          intelligenceHUD: hud,
        })
        .build();

      expect(result).toContain('Chapter 1: The Beginning...');
      expect(result).toContain('Sarah likes tea');
      expect(result).toContain('Be helpful');
      expect(result).toContain('Act autonomously');
      expect(result).toContain('[INTELLIGENCE HUD');
    });

    it('uses default memory context when memoryContext not provided', () => {
      const template = '{{MEMORY_CONTEXT}}';

      const result = new PromptBuilder(template)
        .addContext({
          defaultMemoryContext: 'Default memories here',
          experienceModifier: '',
          autonomyModifier: '',
        })
        .build();

      expect(result).toContain('Default memories here');
    });
  });

  describe('buildAgentMessageContext', () => {
    it('builds context with all components', () => {
      const microphone: MicrophoneState = {
        status: 'listening',
        mode: 'voice',
        lastTranscript: 'Hello agent',
        error: null,
      };

      const ui: UIState = {
        cursor: { position: 100, scene: 'scene-1', paragraph: 'p-1' },
        selection: { start: 50, end: 60, text: 'selected text here' },
        activePanel: 'editor',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone,
      };

      const recentEvents: AppEvent[] = [
        { timestamp: Date.now() - 1000, type: 'CURSOR_MOVED', payload: { position: 50, scene: null } },
        { timestamp: Date.now(), type: 'SELECTION_CHANGED', payload: { text: 'test', start: 0, end: 4 } },
      ];

      const result = buildAgentMessageContext({
        smartContext: 'Current chapter: Chapter 1',
        mode: 'voice',
        microphone,
        ui,
        recentEvents,
        userMessage: 'Help me fix this paragraph',
      });

      expect(result).toContain('[CURRENT CONTEXT]');
      expect(result).toContain('Current chapter: Chapter 1');
      expect(result).toContain('[INPUT MODE]');
      expect(result).toContain('Agent mode: voice');
      expect(result).toContain('Microphone: listening');
      expect(result).toContain('Hello agent');
      expect(result).toContain('[USER STATE]');
      expect(result).toContain('Cursor: 100');
      expect(result).toContain('selected text here');
      expect(result).toContain('[RECENT EVENTS]');
      expect(result).toContain('CURSOR_MOVED');
      expect(result).toContain('[USER REQUEST]');
      expect(result).toContain('Help me fix this paragraph');
    });

    it('handles no selection', () => {
      const microphone: MicrophoneState = {
        status: 'idle',
        mode: 'text',
        lastTranscript: null,
        error: null,
      };

      const ui: UIState = {
        cursor: { position: 0, scene: null, paragraph: null },
        selection: null,
        activePanel: 'home',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone,
      };

      const result = buildAgentMessageContext({
        smartContext: '',
        mode: 'text',
        microphone,
        ui,
        recentEvents: [],
        userMessage: 'Hello',
      });

      expect(result).toContain('Selection: None');
    });

    it('handles no recent events', () => {
      const microphone: MicrophoneState = {
        status: 'idle',
        mode: 'text',
        lastTranscript: null,
        error: null,
      };

      const ui: UIState = {
        cursor: { position: 0, scene: null, paragraph: null },
        selection: null,
        activePanel: 'home',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone,
      };

      const result = buildAgentMessageContext({
        smartContext: '',
        mode: 'text',
        microphone,
        ui,
        recentEvents: [],
        userMessage: 'Hello',
      });

      expect(result).toContain('[RECENT EVENTS]\nNone');
    });

    it('truncates long selection text', () => {
      const microphone: MicrophoneState = {
        status: 'idle',
        mode: 'text',
        lastTranscript: null,
        error: null,
      };

      const longText = 'A'.repeat(200);
      const ui: UIState = {
        cursor: { position: 0, scene: null, paragraph: null },
        selection: { start: 0, end: 200, text: longText },
        activePanel: 'editor',
        activeView: 'editor',
        isZenMode: false,
        activeHighlight: null,
        microphone,
      };

      const result = buildAgentMessageContext({
        smartContext: '',
        mode: 'text',
        microphone,
        ui,
        recentEvents: [],
        userMessage: 'Test',
      });

      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longText.length + 500);
    });
  });
});
