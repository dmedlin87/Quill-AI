import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFocusStore } from '@/features/layout/store/useFocusStore';

describe('useFocusStore', () => {
  beforeEach(() => {
    useFocusStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const state = useFocusStore.getState();
    expect(state.isSessionActive).toBe(false);
    expect(state.goalType).toBe('none');
    expect(state.startWordCount).toBe(0);
  });

  it('starts a session correctly', () => {
    const now = 1000;
    vi.setSystemTime(now);

    useFocusStore.getState().startSession({
      goalType: 'time',
      goalTarget: 30, // 30 mins
      currentWordCount: 500,
    });

    const state = useFocusStore.getState();
    expect(state.isSessionActive).toBe(true);
    expect(state.startTime).toBe(now);
    expect(state.endTime).toBe(now + 30 * 60 * 1000);
    expect(state.startWordCount).toBe(500);
    expect(state.currentWordCount).toBe(500);
  });

  it('updates word count during session', () => {
    useFocusStore.getState().startSession({
      goalType: 'words',
      goalTarget: 100,
      currentWordCount: 0,
    });

    useFocusStore.getState().updateCurrentWordCount(50);
    expect(useFocusStore.getState().currentWordCount).toBe(50);
  });

  it('ends session', () => {
    useFocusStore.getState().startSession({
        goalType: 'none',
        goalTarget: 0,
        currentWordCount: 0
    });

    useFocusStore.getState().endSession();
    expect(useFocusStore.getState().isSessionActive).toBe(false);
  });

  it('resets state', () => {
    useFocusStore.getState().startSession({
        goalType: 'time',
        goalTarget: 10,
        currentWordCount: 100
    });

    useFocusStore.getState().reset();
    const state = useFocusStore.getState();
    expect(state.isSessionActive).toBe(false);
    expect(state.startTime).toBeNull();
    expect(state.startWordCount).toBe(0);
  });
});
