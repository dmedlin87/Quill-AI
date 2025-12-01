import { describe, it, expect } from 'vitest';
import {
  NAVIGATION_TOOLS,
  EDITING_TOOLS,
  ANALYSIS_TOOLS,
  UI_CONTROL_TOOLS,
  KNOWLEDGE_TOOLS,
  MEMORY_TOOLS,
  GENERATION_TOOLS,
  ALL_AGENT_TOOLS,
  VOICE_SAFE_TOOLS,
  QUICK_TOOLS,
  getToolsByCategory,
} from '@/services/gemini/agentTools';

const ALL_GROUPS = [
  NAVIGATION_TOOLS,
  EDITING_TOOLS,
  ANALYSIS_TOOLS,
  UI_CONTROL_TOOLS,
  KNOWLEDGE_TOOLS,
  GENERATION_TOOLS,
  MEMORY_TOOLS,
];

describe('agentTools', () => {
  it('ensures each tool has a basic schema', () => {
    for (const group of ALL_GROUPS) {
      for (const tool of group) {
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(typeof tool.description).toBe('string');
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('OBJECT');
      }
    }
  });

  it('ALL_AGENT_TOOLS aggregates all category tools without duplicates', () => {
    const expectedCount = ALL_GROUPS.reduce((sum, group) => sum + group.length, 0);
    expect(ALL_AGENT_TOOLS).toHaveLength(expectedCount);

    const names = ALL_AGENT_TOOLS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('VOICE_SAFE_TOOLS excludes destructive or high-risk tools', () => {
    const allowedSourceNames = new Set(
      [
        ...NAVIGATION_TOOLS,
        ...ANALYSIS_TOOLS,
        ...UI_CONTROL_TOOLS,
        ...KNOWLEDGE_TOOLS,
      ].map((t) => t.name),
    );

    const disallowedNames = new Set([
      ...EDITING_TOOLS,
      ...GENERATION_TOOLS,
      ...MEMORY_TOOLS,
    ].map((t) => t.name));

    disallowedNames.add('run_analysis');
    disallowedNames.add('highlight_text');

    for (const tool of VOICE_SAFE_TOOLS) {
      expect(allowedSourceNames.has(tool.name)).toBe(true);
      expect(disallowedNames.has(tool.name)).toBe(false);
    }
  });

  it('QUICK_TOOLS exposes a minimal, high-value subset', () => {
    const quickNames = QUICK_TOOLS.map((t) => t.name);

    expect(quickNames).toEqual([
      'navigate_to_text',
      'jump_to_chapter',
      'update_manuscript',
      'undo_last_change',
      'get_character_info',
    ]);

    for (const tool of QUICK_TOOLS) {
      expect(ALL_AGENT_TOOLS.some((t) => t.name === tool.name)).toBe(true);
    }
  });

  it('getToolsByCategory returns the correct groups', () => {
    expect(getToolsByCategory('navigation')).toBe(NAVIGATION_TOOLS);
    expect(getToolsByCategory('editing')).toBe(EDITING_TOOLS);
    expect(getToolsByCategory('analysis')).toBe(ANALYSIS_TOOLS);
    expect(getToolsByCategory('ui')).toBe(UI_CONTROL_TOOLS);
    expect(getToolsByCategory('knowledge')).toBe(KNOWLEDGE_TOOLS);
    expect(getToolsByCategory('generation')).toBe(GENERATION_TOOLS);
    expect(getToolsByCategory('memory')).toBe(MEMORY_TOOLS);
  });
});
