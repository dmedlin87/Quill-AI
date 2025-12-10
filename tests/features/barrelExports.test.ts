import { describe, it, expect } from 'vitest';

import { ChatInterface, useAgentOrchestrator } from '@/features/agent';
import { AnalysisProvider, BrainstormingPanel } from '@/features/analysis';
import { AppBrainProvider, EditorProvider, EngineProvider } from '@/features/core';
import { BrainActivityMonitor } from '@/features/debug';

describe('feature barrel exports', () => {
  it('exposes representative agent exports', () => {
    expect(typeof ChatInterface).toBe('function');
    expect(typeof useAgentOrchestrator).toBe('function');
  });

  it('exposes representative analysis exports', () => {
    expect(typeof AnalysisProvider).toBe('function');
    expect(typeof BrainstormingPanel).toBe('function');
  });

  it('exposes representative core exports', () => {
    expect(typeof EditorProvider).toBe('function');
    expect(typeof EngineProvider).toBe('function');
    expect(typeof AppBrainProvider).toBe('function');
  });

  it('exposes representative debug exports', () => {
    expect(typeof BrainActivityMonitor).toBe('function');
  });
});
