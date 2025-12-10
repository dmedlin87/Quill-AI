/**
 * AppBrain Runtime Tests
 * 
 * Tests for the centralized lifecycle orchestrator.
 * Covers: startup, shutdown, project switching, and service coordination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAppBrainRuntime,
  startAppBrainRuntime,
  stopAppBrainRuntime,
  resetAppBrainForTests,
  eventBus,
  LogLevel,
  appBrainLogger,
} from '@/services/appBrain';
import { createMockAppBrainState } from '../../mocks/testFactories';

// Mock the memory and AI services
vi.mock('@/services/memory', () => ({
  evolveBedsideNote: vi.fn().mockResolvedValue(undefined),
  getMemoriesForContext: vi.fn().mockResolvedValue({ author: [], project: [] }),
  getActiveGoals: vi.fn().mockResolvedValue([]),
  getRelevantMemoriesForContext: vi.fn().mockResolvedValue({ author: [], project: [] }),
  formatMemoriesForPrompt: vi.fn().mockReturnValue(''),
  formatGoalsForPrompt: vi.fn().mockReturnValue(''),
}));

vi.mock('@/services/memory/dreaming', () => ({
  runDreamingCycle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/gemini/client', () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({ significant: false, suggestions: [], reasoning: '' }),
      }),
    },
  },
}));

describe('AppBrainRuntime', () => {
  const mockState = createMockAppBrainState();
  const mockGetState = vi.fn(() => mockState);
  const mockOnSuggestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAppBrainForTests();
    appBrainLogger.setLevel(LogLevel.SILENT); // Suppress logs during tests
  });

  afterEach(() => {
    resetAppBrainForTests();
  });

  describe('getAppBrainRuntime', () => {
    it('returns a singleton instance', () => {
      const runtime1 = getAppBrainRuntime();
      const runtime2 = getAppBrainRuntime();
      expect(runtime1).toBe(runtime2);
    });
  });

  describe('start', () => {
    it('starts the runtime with valid config', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
        onSuggestion: mockOnSuggestion,
      });

      const status = runtime.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.projectId).toBe('test-project');
    });

    it('logs warning when starting while already running', () => {
      const runtime = getAppBrainRuntime();
      appBrainLogger.setLevel(LogLevel.WARN);
      const warnSpy = vi.spyOn(console, 'warn');

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
      });

      runtime.start({
        projectId: 'another-project',
        getState: mockGetState,
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('configures event persistence based on config', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
        persistEvents: false,
      });

      // Emit an event and verify it doesn't persist (no localStorage call)
      // This is implicitly tested by not throwing when localStorage is unavailable
      eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

      expect(runtime.getStatus().isRunning).toBe(true);
    });
  });

  describe('stop', () => {
    it('stops the runtime and cleans up services', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
      });

      expect(runtime.getStatus().isRunning).toBe(true);

      runtime.stop();

      const status = runtime.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.projectId).toBe(null);
    });

    it('is safe to call stop when not running', () => {
      const runtime = getAppBrainRuntime();
      expect(() => runtime.stop()).not.toThrow();
    });
  });

  describe('restart', () => {
    it('restarts with same config', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
      });

      runtime.restart();

      expect(runtime.getStatus().isRunning).toBe(true);
      expect(runtime.getStatus().projectId).toBe('test-project');
    });

    it('restarts with new config', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'test-project',
        getState: mockGetState,
      });

      runtime.restart({ projectId: 'new-project' });

      expect(runtime.getStatus().projectId).toBe('new-project');
    });
  });

  describe('switchProject', () => {
    it('switches project without full restart', () => {
      const runtime = getAppBrainRuntime();

      runtime.start({
        projectId: 'project-1',
        getState: mockGetState,
      });

      runtime.switchProject('project-2');

      expect(runtime.getStatus().isRunning).toBe(true);
      expect(runtime.getStatus().projectId).toBe('project-2');
    });

    it('logs warning when switching while not running', () => {
      const runtime = getAppBrainRuntime();
      appBrainLogger.setLevel(LogLevel.WARN);
      const warnSpy = vi.spyOn(console, 'warn');

      runtime.switchProject('project-1');

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getConfig', () => {
    it('returns a copy of the config', () => {
      const runtime = getAppBrainRuntime();
      const originalConfig = {
        projectId: 'test-project',
        getState: mockGetState,
      };

      runtime.start(originalConfig);

      const config = runtime.getConfig();
      expect(config?.projectId).toBe('test-project');
      expect(config).not.toBe(originalConfig); // Should be a copy
    });

    it('returns null when not running', () => {
      const runtime = getAppBrainRuntime();
      expect(runtime.getConfig()).toBe(null);
    });
  });
});

describe('resetAppBrainForTests', () => {
  it('clears all singleton state', () => {
    const runtime = getAppBrainRuntime();
    const mockState = createMockAppBrainState();

    runtime.start({
      projectId: 'test-project',
      getState: () => mockState,
    });

    // Emit some events
    eventBus.emit({ type: 'TEXT_CHANGED', payload: { length: 100, delta: 10 } });

    resetAppBrainForTests();

    // After reset, runtime should not be running
    const newRuntime = getAppBrainRuntime();
    expect(newRuntime.getStatus().isRunning).toBe(false);

    // Event history should be cleared
    expect(eventBus.getRecentEvents()).toHaveLength(0);
  });
});
