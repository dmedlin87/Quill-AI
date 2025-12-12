import * as AgentFeature from '@/features/agent';

describe('features/agent index', () => {
  it('exports agent components and hooks', () => {
    expect(AgentFeature.ChatInterface).toBeDefined();
    expect(AgentFeature.ActivityFeed).toBeDefined();
    expect(AgentFeature.PersonaSelector).toBeDefined();
    expect(AgentFeature.AIPresenceOrb).toBeDefined();
    expect(AgentFeature.ProactiveSuggestions).toBeDefined();
    expect(AgentFeature.ProactiveSuggestionsBadge).toBeDefined();

    expect(AgentFeature.useAgenticEditor).toBeDefined();
    expect(AgentFeature.useAgentService).toBeDefined();
    expect(AgentFeature.useAgentOrchestrator).toBeDefined();
    expect(AgentFeature.useProactiveSuggestions).toBeDefined();
    expect(AgentFeature.useMemoryIntelligence).toBeDefined();
  });
});
